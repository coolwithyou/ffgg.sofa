/**
 * RAG 평가 엔진
 *
 * 기존 RAG 파이프라인을 활용하여 평가를 수행합니다.
 * 각 평가 항목에 대해 검색 → 생성 → 메트릭 평가를 실행합니다.
 */

import { hybridSearch, hybridSearchMultiDataset } from '../retrieval';
import { generateResponse } from '../generator';
import { rewriteQuery } from '../query-rewriter';
import { logger } from '@/lib/logger';

import {
  evaluateFaithfulness,
  evaluateAnswerRelevancy,
  evaluateContextPrecision,
  evaluateContextRecall,
} from './metrics';

import type {
  EvaluationDataset,
  EvaluationItem,
  EvaluationReport,
  EvaluationOptions,
  ItemEvaluationResult,
  MetricScores,
  MetricAnalysis,
  QuestionType,
  QuestionTypeStats,
  MetricName,
} from './types';

const DEFAULT_OPTIONS: Required<Omit<EvaluationOptions, 'onProgress' | 'compareWithoutRewriting'>> = {
  evaluationModel: 'gemini-2.5-flash-lite',
  maxChunks: 5,
  metrics: ['faithfulness', 'answerRelevancy', 'contextPrecision', 'contextRecall'],
  concurrency: 3,
  temperature: 0.3,
};

/**
 * RAG 평가 엔진 클래스
 */
export class RagEvaluator {
  private options: Required<Omit<EvaluationOptions, 'onProgress' | 'compareWithoutRewriting'>> &
    Pick<EvaluationOptions, 'onProgress' | 'compareWithoutRewriting'>;

  constructor(options: EvaluationOptions = {}) {
    this.options = {
      ...DEFAULT_OPTIONS,
      ...options,
    };
  }

  /**
   * 전체 평가 세트 실행
   */
  async evaluate(dataset: EvaluationDataset): Promise<EvaluationReport> {
    const startTime = Date.now();
    const results: ItemEvaluationResult[] = [];

    logger.info('Starting RAG evaluation', {
      datasetName: dataset.name,
      totalItems: dataset.items.length,
      metrics: this.options.metrics,
    });

    // 순차 처리 (병렬 처리는 rate limit 고려 필요)
    for (let i = 0; i < dataset.items.length; i++) {
      const item = dataset.items[i];

      try {
        const result = await this.evaluateItem(item, dataset.tenantId, dataset.datasetIds);
        results.push(result);

        this.options.onProgress?.(i + 1, dataset.items.length, item);

        logger.debug('Item evaluated', {
          itemId: item.id,
          scores: result.scores,
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error('Failed to evaluate item', error as Error, { itemId: item.id });

        // 콘솔에도 에러 출력 (디버깅용)
        console.error(`\n❌ [${item.id}] 평가 실패: ${errorMessage}`);

        // 실패한 항목도 결과에 포함 (점수 0, 에러 메시지 포함)
        results.push(this.createFailedResult(item, errorMessage));
        this.options.onProgress?.(i + 1, dataset.items.length, item);
      }
    }

    const totalDuration = Date.now() - startTime;

    logger.info('RAG evaluation completed', {
      datasetName: dataset.name,
      totalItems: dataset.items.length,
      duration: totalDuration,
    });

    return this.generateReport(dataset, results, totalDuration);
  }

  /**
   * 단일 항목 평가
   */
  private async evaluateItem(
    item: EvaluationItem,
    tenantId: string,
    datasetIds?: string[]
  ): Promise<ItemEvaluationResult> {
    const startTime = Date.now();

    // 1. Query Rewriting (후속 질문인 경우)
    let searchQuery = item.question;
    let rewrittenQuery: string | undefined;

    if (item.conversationHistory && item.conversationHistory.length > 0) {
      const history = item.conversationHistory.map((m) => ({
        role: m.role,
        content: m.content,
        timestamp: new Date().toISOString(),
      }));

      try {
        rewrittenQuery = await rewriteQuery(item.question, history);
        if (rewrittenQuery !== item.question) {
          searchQuery = rewrittenQuery;
        }
      } catch (error) {
        logger.warn('Query rewriting failed in evaluation', {
          itemId: item.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // 2. Retrieval
    const chunks =
      datasetIds && datasetIds.length > 0
        ? await hybridSearchMultiDataset(tenantId, datasetIds, searchQuery, this.options.maxChunks)
        : await hybridSearch(tenantId, searchQuery, this.options.maxChunks);

    const retrievedChunks = chunks.map((c) => ({
      chunkId: c.chunkId,
      content: c.content,
      score: c.score,
    }));

    // 검색 결과 없음 경고
    if (chunks.length === 0) {
      logger.warn('No chunks retrieved for evaluation item', {
        itemId: item.id,
        tenantId,
        searchQuery,
        datasetIds,
      });
    }

    // 3. Generation
    const answer = await generateResponse(item.question, chunks, {
      temperature: this.options.temperature,
    });

    // 4. 메트릭 평가
    const context = chunks.map((c) => c.content).join('\n\n---\n\n');
    const { scores, analysis } = await this.evaluateMetrics(item, answer, context, retrievedChunks);

    return {
      itemId: item.id,
      question: item.question,
      questionType: item.questionType,
      rewrittenQuery,
      retrievedChunks,
      generatedAnswer: answer,
      scores,
      analysis,
      executionTime: Date.now() - startTime,
    };
  }

  /**
   * 메트릭 평가 실행
   */
  private async evaluateMetrics(
    item: EvaluationItem,
    answer: string,
    context: string,
    retrievedChunks: Array<{ chunkId: string; content: string; score: number }>
  ): Promise<{ scores: MetricScores; analysis: MetricAnalysis }> {
    const metrics = this.options.metrics;
    const scores: MetricScores = {
      faithfulness: 0,
      answerRelevancy: 0,
      contextPrecision: 0,
    };
    const analysis: MetricAnalysis = {};

    // 각 메트릭을 개별적으로 평가하여 하나의 실패가 전체에 영향주지 않도록 함
    const safeEvaluate = async <T>(
      name: string,
      fn: () => Promise<T | null>
    ): Promise<T | null> => {
      try {
        return await fn();
      } catch (error) {
        logger.error(`Failed to evaluate ${name}`, error as Error, { itemId: item.id });
        return null;
      }
    };

    // 병렬 평가 (각 메트릭 에러 격리)
    const [faithfulness, answerRelevancy, contextPrecision, contextRecall] = await Promise.all([
      metrics.includes('faithfulness')
        ? safeEvaluate('faithfulness', () => evaluateFaithfulness(answer, context))
        : null,
      metrics.includes('answerRelevancy')
        ? safeEvaluate('answerRelevancy', () => evaluateAnswerRelevancy(item.question, answer))
        : null,
      metrics.includes('contextPrecision')
        ? safeEvaluate('contextPrecision', () => evaluateContextPrecision(item.question, retrievedChunks))
        : null,
      metrics.includes('contextRecall')
        ? safeEvaluate('contextRecall', () =>
            evaluateContextRecall(item.groundTruth, context, item.groundTruthChunks, retrievedChunks)
          )
        : null,
    ]);

    if (faithfulness) {
      scores.faithfulness = faithfulness.score;
      analysis.faithfulness = faithfulness.analysis;
    }

    if (answerRelevancy) {
      scores.answerRelevancy = answerRelevancy.score;
      analysis.answerRelevancy = answerRelevancy.analysis;
    }

    if (contextPrecision) {
      scores.contextPrecision = contextPrecision.score;
      analysis.contextPrecision = contextPrecision.analysis;
    }

    if (contextRecall) {
      scores.contextRecall = contextRecall.score;
      analysis.contextRecall = contextRecall.analysis;
    }

    return { scores, analysis };
  }

  /**
   * 실패한 항목 결과 생성
   */
  private createFailedResult(item: EvaluationItem, errorMessage?: string): ItemEvaluationResult {
    return {
      itemId: item.id,
      question: item.question,
      questionType: item.questionType,
      retrievedChunks: [],
      generatedAnswer: errorMessage ? `[Evaluation Failed: ${errorMessage}]` : '[Evaluation Failed]',
      scores: {
        faithfulness: 0,
        answerRelevancy: 0,
        contextPrecision: 0,
        contextRecall: 0,
      },
      analysis: {},
      executionTime: 0,
    };
  }

  /**
   * 평가 리포트 생성
   */
  private generateReport(
    dataset: EvaluationDataset,
    results: ItemEvaluationResult[],
    totalDuration: number
  ): EvaluationReport {
    // 전체 평균 계산
    const avgScores = this.calculateAverageScores(results);

    // 질문 유형별 통계
    const byQuestionType = this.calculateByQuestionType(results);

    // Query Rewriting 효과 분석
    const queryRewritingImpact = this.calculateQueryRewritingImpact(results);

    return {
      datasetName: dataset.name,
      datasetVersion: dataset.version,
      evaluatedAt: new Date().toISOString(),
      summary: {
        totalItems: results.length,
        avgFaithfulness: avgScores.faithfulness,
        avgAnswerRelevancy: avgScores.answerRelevancy,
        avgContextPrecision: avgScores.contextPrecision,
        avgContextRecall: avgScores.contextRecall,
        byQuestionType,
        queryRewritingImpact,
      },
      results,
      executionMetadata: {
        totalDuration,
        totalTokenUsage: {
          retrieval: 0,
          generation: 0,
          evaluation: 0,
        },
        evaluationModel: this.options.evaluationModel,
      },
    };
  }

  /**
   * 전체 평균 점수 계산
   */
  private calculateAverageScores(results: ItemEvaluationResult[]): MetricScores {
    if (results.length === 0) {
      return { faithfulness: 0, answerRelevancy: 0, contextPrecision: 0, contextRecall: 0 };
    }

    const sum = results.reduce(
      (acc, r) => ({
        faithfulness: acc.faithfulness + r.scores.faithfulness,
        answerRelevancy: acc.answerRelevancy + r.scores.answerRelevancy,
        contextPrecision: acc.contextPrecision + r.scores.contextPrecision,
        contextRecall: acc.contextRecall + (r.scores.contextRecall ?? 0),
      }),
      { faithfulness: 0, answerRelevancy: 0, contextPrecision: 0, contextRecall: 0 }
    );

    const count = results.length;
    const recallCount = results.filter((r) => r.scores.contextRecall !== undefined).length;

    return {
      faithfulness: sum.faithfulness / count,
      answerRelevancy: sum.answerRelevancy / count,
      contextPrecision: sum.contextPrecision / count,
      contextRecall: recallCount > 0 ? sum.contextRecall / recallCount : undefined,
    };
  }

  /**
   * 질문 유형별 통계 계산
   */
  private calculateByQuestionType(
    results: ItemEvaluationResult[]
  ): Partial<Record<QuestionType, QuestionTypeStats>> {
    const grouped = new Map<QuestionType, ItemEvaluationResult[]>();

    for (const result of results) {
      const existing = grouped.get(result.questionType) || [];
      existing.push(result);
      grouped.set(result.questionType, existing);
    }

    const stats: Partial<Record<QuestionType, QuestionTypeStats>> = {};

    for (const [type, items] of grouped) {
      const avgScores = this.calculateAverageScores(items);
      stats[type] = {
        count: items.length,
        avgFaithfulness: avgScores.faithfulness,
        avgAnswerRelevancy: avgScores.answerRelevancy,
        avgContextPrecision: avgScores.contextPrecision,
        avgContextRecall: avgScores.contextRecall,
      };
    }

    return stats;
  }

  /**
   * Query Rewriting 효과 분석
   */
  private calculateQueryRewritingImpact(
    results: ItemEvaluationResult[]
  ): { itemsWithRewriting: number; avgScoreImprovement: number } | undefined {
    const withRewriting = results.filter((r) => r.rewrittenQuery && r.rewrittenQuery !== r.question);

    if (withRewriting.length === 0) {
      return undefined;
    }

    // 후속 질문 타입의 평균 점수와 전체 평균 비교
    const followupResults = results.filter((r) => r.questionType === 'followup');
    const otherResults = results.filter((r) => r.questionType !== 'followup');

    if (followupResults.length === 0 || otherResults.length === 0) {
      return {
        itemsWithRewriting: withRewriting.length,
        avgScoreImprovement: 0,
      };
    }

    const followupAvg =
      followupResults.reduce((sum, r) => sum + r.scores.answerRelevancy, 0) / followupResults.length;
    const otherAvg = otherResults.reduce((sum, r) => sum + r.scores.answerRelevancy, 0) / otherResults.length;

    return {
      itemsWithRewriting: withRewriting.length,
      avgScoreImprovement: followupAvg - otherAvg, // 양수면 후속 질문도 잘 처리
    };
  }
}

/**
 * 편의 함수: 단일 평가 실행
 */
export async function evaluateDataset(
  dataset: EvaluationDataset,
  options?: EvaluationOptions
): Promise<EvaluationReport> {
  const evaluator = new RagEvaluator(options);
  return evaluator.evaluate(dataset);
}
