/**
 * Context Precision 메트릭
 *
 * 검색된 청크들이 질문에 관련있는지 평가합니다.
 * Precision@K를 계산하여 검색 품질을 측정합니다.
 *
 * 평가 방법:
 * 1. 각 청크의 질문 관련성을 LLM으로 평가
 * 2. Precision@K 계산 (K = 1, 3, 5)
 * 3. 평균 Precision을 최종 점수로 사용
 */

import { generateWithFallback } from '../../generator';
import { logger } from '@/lib/logger';
import type { MetricResult, ContextPrecisionAnalysis, RetrievedChunk } from '../types';

/** 청크 관련성 평가 프롬프트 */
const EVALUATE_CHUNK_SYSTEM_PROMPT = `당신은 검색 결과의 관련성을 평가하는 전문가입니다.

## 작업
주어진 질문에 대해 검색된 청크가 얼마나 관련있는지 평가하세요.

## 판단 기준
- "relevant": 질문에 답변하는 데 직접적으로 유용한 정보 포함
- "partial": 부분적으로 관련있거나 배경 정보만 제공
- "irrelevant": 질문과 관련 없는 정보

## 출력 형식
JSON 형식으로 출력하세요:
{"verdict": "relevant|partial|irrelevant", "reason": "판단 근거"}`;

/**
 * 단일 청크 관련성 평가
 */
async function evaluateChunkRelevance(
  question: string,
  chunk: string
): Promise<{ isRelevant: boolean; relevanceReason?: string }> {
  const userPrompt = `## 질문
${question}

## 검색된 청크
${chunk}

## 평가 결과 (JSON)`;

  try {
    const response = await generateWithFallback(EVALUATE_CHUNK_SYSTEM_PROMPT, userPrompt, {
      temperature: 0.1,
      maxTokens: 200,
    });

    // JSON 파싱
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      logger.warn('Failed to extract JSON from chunk relevance response', { response });
      return { isRelevant: false };
    }

    const parsed = JSON.parse(jsonMatch[0]) as { verdict?: string; reason?: string };

    // "relevant"만 관련있는 것으로 처리 (partial은 0.5로 처리할 수도 있지만 단순화)
    return {
      isRelevant: parsed.verdict === 'relevant',
      relevanceReason: parsed.reason,
    };
  } catch (error) {
    logger.error('Failed to evaluate chunk relevance', error as Error);
    return { isRelevant: false };
  }
}

/**
 * Precision@K 계산
 *
 * @param relevantFlags - 각 순위별 관련성 여부
 * @param k - 상위 K개까지 고려
 * @returns Precision@K 값
 */
function calculatePrecisionAtK(relevantFlags: boolean[], k: number): number {
  const topK = relevantFlags.slice(0, k);
  if (topK.length === 0) return 0;

  const relevantCount = topK.filter((r) => r).length;
  return relevantCount / topK.length;
}

/**
 * Context Precision 메트릭 평가
 *
 * @param question - 원본 질문
 * @param chunks - 검색된 청크들
 * @returns 점수 (0-1)와 상세 분석 결과
 */
export async function evaluateContextPrecision(
  question: string,
  chunks: RetrievedChunk[]
): Promise<MetricResult<ContextPrecisionAnalysis>> {
  // 청크가 없으면 점수 0
  if (chunks.length === 0) {
    return {
      score: 0,
      analysis: {
        rankedChunks: [],
        precisionAtK: { 1: 0, 3: 0, 5: 0 },
      },
    };
  }

  // 각 청크 관련성 평가 (병렬)
  const evaluationResults = await Promise.all(
    chunks.map(async (chunk, index) => {
      const result = await evaluateChunkRelevance(question, chunk.content);
      return {
        chunkId: chunk.chunkId,
        rank: index + 1,
        isRelevant: result.isRelevant,
        relevanceReason: result.relevanceReason,
      };
    })
  );

  // Precision@K 계산
  const relevantFlags = evaluationResults.map((r) => r.isRelevant);
  const precisionAtK = {
    1: calculatePrecisionAtK(relevantFlags, 1),
    3: calculatePrecisionAtK(relevantFlags, 3),
    5: calculatePrecisionAtK(relevantFlags, 5),
  };

  // 평균 Precision을 최종 점수로 사용 (P@1에 가중치)
  // 상위 결과가 더 중요하므로 가중 평균 사용
  const score = precisionAtK[1] * 0.5 + precisionAtK[3] * 0.3 + precisionAtK[5] * 0.2;

  return {
    score,
    analysis: {
      rankedChunks: evaluationResults,
      precisionAtK,
    },
  };
}
