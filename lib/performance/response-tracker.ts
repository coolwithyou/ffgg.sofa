/**
 * 응답 시간 추적 모듈
 * 챗봇 응답 시간을 비동기로 기록하여 성능 모니터링에 활용합니다.
 *
 * lib/usage/token-tracker.ts 패턴을 따릅니다:
 * - Fire-and-Forget 패턴으로 메인 응답에 영향 없음
 * - 에러 발생 시 로깅만 하고 예외를 전파하지 않음
 */

import { db } from '@/lib/db';
import { responseTimeLogs } from '@/drizzle/schema';
import { logger } from '@/lib/logger';

/**
 * 응답 시간 추적 파라미터
 */
export interface ResponseTimeParams {
  tenantId: string;
  chatbotId?: string;
  conversationId?: string;
  channel: 'web' | 'kakao' | 'public_page';
  totalDurationMs: number;
  timings: Record<string, number>;
  cacheHit: boolean;
  chunksUsed: number;
  estimatedTokens: number;
}

/**
 * 정규화된 timings 키 매핑
 * service.ts의 키 형식을 DB 스키마 형식으로 변환
 */
function normalizeTimings(timings: Record<string, number>): Record<string, number> {
  const keyMapping: Record<string, string> = {
    '1_chatbot_lookup': 'chatbot_lookup',
    '2_session_lookup': 'session_lookup',
    '3_cache_lookup': 'cache_lookup',
    '4_history_lookup': 'history_lookup',
    '5_query_rewriting': 'query_rewriting',
    '6_hybrid_search': 'hybrid_search',
    '8_llm_generation': 'llm_generation',
    '9_message_save': 'message_save',
    '10_usage_log': 'usage_log',
    '11_cache_save': 'cache_save',
  };

  const normalized: Record<string, number> = {};
  for (const [key, value] of Object.entries(timings)) {
    const normalizedKey = keyMapping[key] ?? key;
    normalized[normalizedKey] = value;
  }
  return normalized;
}

/**
 * 응답 시간 비동기 저장
 * 메인 응답에 영향을 주지 않도록 에러만 로깅합니다.
 *
 * @example
 * // processChat 함수 끝에서 호출 (await 없이)
 * trackResponseTime({
 *   tenantId,
 *   chatbotId,
 *   channel,
 *   totalDurationMs: duration,
 *   timings,
 *   cacheHit: false,
 *   chunksUsed: searchResults.length,
 *   estimatedTokens,
 * }).catch(() => {});
 */
export async function trackResponseTime(params: ResponseTimeParams): Promise<void> {
  try {
    const {
      tenantId,
      chatbotId,
      conversationId,
      channel,
      totalDurationMs,
      timings,
      cacheHit,
      chunksUsed,
      estimatedTokens,
    } = params;

    // timings 키 정규화
    const normalizedTimings = normalizeTimings(timings);

    // 주요 단계 시간 추출 (인덱싱 및 집계용)
    const llmDurationMs = normalizedTimings['llm_generation'] ?? null;
    const searchDurationMs = normalizedTimings['hybrid_search'] ?? null;
    const rewriteDurationMs = normalizedTimings['query_rewriting'] ?? null;

    await db.insert(responseTimeLogs).values({
      tenantId,
      chatbotId: chatbotId ?? null,
      conversationId: conversationId ?? null,
      channel,
      totalDurationMs,
      timings: normalizedTimings,
      llmDurationMs,
      searchDurationMs,
      rewriteDurationMs,
      cacheHit,
      chunksUsed,
      estimatedTokens,
    });

    logger.debug('Response time tracked', {
      tenantId,
      totalDurationMs,
      cacheHit,
      llmDurationMs,
      searchDurationMs,
    });
  } catch (error) {
    // 추적 실패가 메인 기능을 방해하지 않도록 에러만 기록
    logger.error('Failed to track response time', error as Error, {
      tenantId: params.tenantId,
      totalDurationMs: params.totalDurationMs,
    });
  }
}

/**
 * 캐시 히트 응답 시간 추적
 * 캐시에서 응답을 반환할 때 사용합니다.
 */
export async function trackCacheHitResponseTime(params: {
  tenantId: string;
  chatbotId?: string;
  conversationId?: string;
  channel: 'web' | 'kakao' | 'public_page';
  totalDurationMs: number;
  cacheLookupMs: number;
}): Promise<void> {
  return trackResponseTime({
    tenantId: params.tenantId,
    chatbotId: params.chatbotId,
    conversationId: params.conversationId,
    channel: params.channel,
    totalDurationMs: params.totalDurationMs,
    timings: {
      cache_lookup: params.cacheLookupMs,
    },
    cacheHit: true,
    chunksUsed: 0,
    estimatedTokens: 0,
  });
}
