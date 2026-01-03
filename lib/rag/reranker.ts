/**
 * LLM 기반 Re-ranking 모듈
 * Gemini Flash를 사용하여 검색 결과를 관련성 기준으로 재순위화
 */

import { generateText } from 'ai';
import { google } from '@ai-sdk/google';
import { openai } from '@ai-sdk/openai';
import { logger } from '@/lib/logger';
import { trackTokenUsage } from '@/lib/usage/token-tracker';
import type { SearchResult } from './retrieval';

/**
 * Re-ranking 옵션
 */
export interface RerankOptions {
  /** 반환할 최대 결과 수 (기본: 5) */
  topK?: number;
  /** 문서당 최대 문자 수 (기본: 300) */
  maxCharsPerDoc?: number;
  /** 토큰 추적용 컨텍스트 */
  trackingContext?: {
    tenantId: string;
    chatbotId?: string;
    conversationId?: string;
  };
}

/**
 * Re-ranking 결과
 */
export interface RerankResult {
  /** 재순위화된 검색 결과 */
  results: SearchResult[];
  /** Re-ranking에 사용된 토큰 수 */
  tokensUsed?: {
    input: number;
    output: number;
  };
}

/**
 * LLM 응답에서 파싱된 점수
 */
interface ParsedScore {
  index: number;
  score: number;
  reasoning?: string;
}

/**
 * Re-ranking 시스템 프롬프트
 */
const RERANK_SYSTEM_PROMPT = `당신은 검색 결과의 관련성을 평가하는 전문가입니다.

## 작업
주어진 질문에 대해 각 문서의 관련성을 1-10 점수로 평가하세요.

## 평가 기준
- 10: 질문에 직접적이고 완전한 답변 제공
- 7-9: 질문에 관련된 유용한 정보 포함
- 4-6: 부분적으로 관련있지만 직접적 답변 아님
- 1-3: 거의 관련 없음

## 응답 형식
반드시 JSON 배열로만 응답하세요. 설명이나 다른 텍스트 없이 JSON만 출력하세요.
[{"index": 0, "score": 8}, {"index": 1, "score": 5}, ...]`;

/**
 * LLM 기반 Re-ranking 수행
 *
 * @param query - 사용자 질문
 * @param results - 검색 결과 (보통 15개)
 * @param options - Re-ranking 옵션
 * @returns 재순위화된 검색 결과 (보통 5개)
 */
export async function rerankWithLLM(
  query: string,
  results: SearchResult[],
  options: RerankOptions = {}
): Promise<RerankResult> {
  const {
    topK = 5,
    maxCharsPerDoc = 300,
    trackingContext,
  } = options;

  // 결과가 없거나 적으면 그대로 반환
  if (results.length === 0) {
    return { results: [] };
  }

  if (results.length <= topK) {
    return { results };
  }

  const startTime = Date.now();

  try {
    // 문서 목록 구성 (토큰 절약을 위해 내용 자르기)
    const documentsText = results
      .map((r, i) => {
        const content = r.content.length > maxCharsPerDoc
          ? r.content.slice(0, maxCharsPerDoc) + '...'
          : r.content;
        return `[${i}] ${content}`;
      })
      .join('\n\n');

    const userPrompt = `## 질문
${query}

## 문서 목록
${documentsText}

## 평가 결과 (JSON 배열):`;

    // LLM 호출
    const llmResult = await generateWithFallback(
      RERANK_SYSTEM_PROMPT,
      userPrompt,
      { maxTokens: 500, temperature: 0 }
    );

    // 응답 파싱
    const scores = parseScores(llmResult.text, results.length);

    // 점수 기반 재정렬
    const rerankedResults = scores
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
      .map((s) => ({
        ...results[s.index],
        // 원본 점수는 유지하고, rerankScore 추가
        metadata: {
          ...results[s.index].metadata,
          rerankScore: s.score,
          originalScore: results[s.index].score,
        },
      }));

    const duration = Date.now() - startTime;
    logger.info('[Reranker] Re-ranking completed', {
      query: query.slice(0, 50),
      inputCount: results.length,
      outputCount: rerankedResults.length,
      duration,
      topScores: scores.slice(0, 3).map(s => ({ index: s.index, score: s.score })),
      tokensUsed: llmResult.tokensUsed,
    });

    // 토큰 사용량 추적
    if (trackingContext?.tenantId && llmResult.tokensUsed) {
      trackTokenUsage({
        tenantId: trackingContext.tenantId,
        chatbotId: trackingContext.chatbotId,
        conversationId: trackingContext.conversationId,
        modelProvider: llmResult.provider,
        modelId: llmResult.model,
        featureType: 'rerank',
        inputTokens: llmResult.tokensUsed.input,
        outputTokens: llmResult.tokensUsed.output,
      }).catch((err) => {
        logger.warn('Failed to track rerank token usage', { error: err });
      });
    }

    return {
      results: rerankedResults,
      tokensUsed: llmResult.tokensUsed,
    };
  } catch (error) {
    // Re-ranking 실패 시 원본 결과의 상위 topK개 반환
    logger.warn('[Reranker] Re-ranking failed, returning original results', {
      error: error instanceof Error ? error.message : String(error),
      query: query.slice(0, 50),
    });

    return {
      results: results.slice(0, topK),
    };
  }
}

/**
 * LLM 응답에서 점수 파싱
 */
function parseScores(response: string, expectedCount: number): ParsedScore[] {
  try {
    // JSON 배열 추출 (응답에 다른 텍스트가 포함될 수 있음)
    const jsonMatch = response.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new Error('No JSON array found in response');
    }

    const parsed = JSON.parse(jsonMatch[0]) as Array<{
      index: number;
      score: number;
      reasoning?: string;
    }>;

    // 유효한 점수만 필터링
    const validScores: ParsedScore[] = parsed
      .filter(
        (item) =>
          typeof item.index === 'number' &&
          typeof item.score === 'number' &&
          item.index >= 0 &&
          item.index < expectedCount &&
          item.score >= 1 &&
          item.score <= 10
      )
      .map((item) => ({
        index: item.index,
        score: item.score,
        reasoning: item.reasoning,
      }));

    // 누락된 인덱스에 대해 기본 점수 부여
    const seenIndices = new Set(validScores.map((s) => s.index));
    for (let i = 0; i < expectedCount; i++) {
      if (!seenIndices.has(i)) {
        validScores.push({ index: i, score: 3 }); // 평가되지 않은 문서는 낮은 점수
      }
    }

    return validScores;
  } catch (error) {
    logger.warn('[Reranker] Failed to parse scores, using fallback', {
      error: error instanceof Error ? error.message : String(error),
      response: response.slice(0, 200),
    });

    // 파싱 실패 시 원본 순서 기반 점수 부여
    return Array.from({ length: expectedCount }, (_, i) => ({
      index: i,
      score: 10 - i, // 원본 순서 유지 (첫 번째가 가장 높은 점수)
    }));
  }
}

/**
 * 폴백 전략을 적용한 LLM 호출
 */
async function generateWithFallback(
  systemPrompt: string,
  userPrompt: string,
  options: { maxTokens?: number; temperature?: number }
): Promise<{
  text: string;
  provider: 'google' | 'openai';
  model: string;
  tokensUsed?: { input: number; output: number };
}> {
  // Gemini 우선 시도
  if (process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    try {
      const result = await generateText({
        model: google('gemini-2.5-flash-lite'),
        system: systemPrompt,
        prompt: userPrompt,
        maxOutputTokens: options.maxTokens || 500,
        temperature: options.temperature ?? 0,
      });

      return {
        text: result.text,
        provider: 'google',
        model: 'gemini-2.5-flash-lite',
        tokensUsed: {
          input: result.usage?.inputTokens ?? 0,
          output: result.usage?.outputTokens ?? 0,
        },
      };
    } catch (error) {
      logger.warn('[Reranker] Gemini failed, trying OpenAI fallback', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // OpenAI 폴백
  if (process.env.OPENAI_API_KEY) {
    const result = await generateText({
      model: openai('gpt-4o-mini'),
      system: systemPrompt,
      prompt: userPrompt,
      maxOutputTokens: options.maxTokens || 500,
      temperature: options.temperature ?? 0,
    });

    return {
      text: result.text,
      provider: 'openai',
      model: 'gpt-4o-mini',
      tokensUsed: {
        input: result.usage?.inputTokens ?? 0,
        output: result.usage?.outputTokens ?? 0,
      },
    };
  }

  throw new Error('No LLM provider available for re-ranking');
}

/**
 * Re-ranking이 필요한지 판단
 *
 * @param results - 검색 결과
 * @param threshold - 점수 임계값 (기본: 0.7)
 * @returns Re-ranking 필요 여부
 */
export function shouldRerank(
  results: SearchResult[],
  threshold: number = 0.7
): boolean {
  if (results.length <= 3) {
    // 결과가 적으면 Re-ranking 불필요
    return false;
  }

  // 상위 결과의 Dense 점수가 낮거나 점수 차이가 작으면 Re-ranking 권장
  const topDenseScore = results[0]?.denseScore ?? results[0]?.score ?? 0;

  if (topDenseScore < threshold) {
    // 상위 결과도 점수가 낮으면 Re-ranking으로 더 나은 결과 선별 시도
    return true;
  }

  // 상위 5개의 점수 분산이 낮으면 (유사한 점수) Re-ranking 권장
  const top5Scores = results.slice(0, 5).map(r => r.denseScore ?? r.score);
  const scoreRange = Math.max(...top5Scores) - Math.min(...top5Scores);

  if (scoreRange < 0.1) {
    // 점수 차이가 거의 없으면 LLM이 더 정교하게 판단
    return true;
  }

  return false;
}
