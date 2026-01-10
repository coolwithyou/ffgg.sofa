/**
 * Anthropic Prompt Caching 유틸리티
 *
 * Anthropic의 Prompt Caching 기능을 활용하여 반복되는 시스템 프롬프트의 비용을 최적화합니다.
 *
 * 특징:
 * - 캐시된 토큰 쓰기: 25% 할인
 * - 캐시된 토큰 읽기: 90% 할인
 * - 캐시 TTL: 5분 (ephemeral)
 *
 * 참고: https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching
 */

import { createAnthropic } from '@ai-sdk/anthropic';
import { generateText, type CoreMessage } from 'ai';
import { logger } from '@/lib/logger';

/**
 * 캐시된 Anthropic 호출 옵션
 */
export interface CachedAnthropicOptions {
  /** 모델 ID (기본: claude-3-haiku-20240307) */
  model?: string;
  /** 시스템 프롬프트 (캐싱됨) */
  systemPrompt: string;
  /** 사용자 프롬프트 (캐싱되지 않음) */
  userPrompt: string;
  /** 최대 출력 토큰 */
  maxOutputTokens?: number;
  /** 온도 (기본: 0) */
  temperature?: number;
}

/**
 * 캐시된 Anthropic 호출 결과
 */
export interface CachedAnthropicResult {
  /** 생성된 텍스트 */
  text: string;
  /** 토큰 사용량 */
  usage: {
    inputTokens: number;
    outputTokens: number;
    cacheCreationInputTokens?: number;
    cacheReadInputTokens?: number;
  };
}

/**
 * Prompt Caching을 적용한 Anthropic API 호출
 *
 * 시스템 프롬프트에 cache_control을 적용하여 반복 호출 시 비용을 절감합니다.
 *
 * @param options - 호출 옵션
 * @returns 생성 결과 및 토큰 사용량
 *
 * @example
 * ```typescript
 * const result = await generateWithCache({
 *   systemPrompt: '한국어 문장을 분석하세요.',
 *   userPrompt: '안녕하세요',
 *   model: 'claude-3-haiku-20240307',
 * });
 * ```
 */
export async function generateWithCache(
  options: CachedAnthropicOptions
): Promise<CachedAnthropicResult> {
  const {
    model = 'claude-3-haiku-20240307',
    systemPrompt,
    userPrompt,
    maxOutputTokens = 2048,
    temperature = 0,
  } = options;

  const anthropic = createAnthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  // 메시지 구성: 시스템 프롬프트에 cache_control 적용
  const messages: CoreMessage[] = [
    {
      role: 'user',
      content: userPrompt,
    },
  ];

  const result = await generateText({
    model: anthropic(model),
    system: systemPrompt,
    messages,
    maxTokens: maxOutputTokens,
    temperature,
    // Anthropic Prompt Caching 활성화
    // experimental_providerMetadata로 cache_control 전달
    experimental_providerMetadata: {
      anthropic: {
        cacheControl: {
          type: 'ephemeral',
        },
      },
    },
  });

  // 캐시 사용량 로깅 (디버깅용)
  const providerMetadata = result.experimental_providerMetadata?.anthropic as
    | { cacheCreationInputTokens?: number; cacheReadInputTokens?: number }
    | undefined;

  const cacheCreationTokens = providerMetadata?.cacheCreationInputTokens ?? 0;
  const cacheReadTokens = providerMetadata?.cacheReadInputTokens ?? 0;

  if (cacheCreationTokens > 0 || cacheReadTokens > 0) {
    logger.debug('[AnthropicCache] Cache usage', {
      model,
      cacheCreationInputTokens: cacheCreationTokens,
      cacheReadInputTokens: cacheReadTokens,
      cacheHitRatio: cacheReadTokens / (cacheCreationTokens + cacheReadTokens + 1),
    });
  }

  return {
    text: result.text,
    usage: {
      inputTokens: result.usage?.promptTokens ?? 0,
      outputTokens: result.usage?.completionTokens ?? 0,
      cacheCreationInputTokens: cacheCreationTokens,
      cacheReadInputTokens: cacheReadTokens,
    },
  };
}

/**
 * 캐시 가능 여부 확인
 *
 * Prompt Caching은 최소 1024 토큰 이상의 프롬프트에서 효과적입니다.
 * (한글 기준 약 500자 이상)
 */
export function isCacheEffective(systemPrompt: string): boolean {
  // 한글은 대략 2자당 1토큰, 영어는 4자당 1토큰
  const estimatedTokens = systemPrompt.length / 2;
  return estimatedTokens >= 1024;
}

/**
 * 예상 비용 절감률 계산
 *
 * @param cacheReadTokens - 캐시에서 읽은 토큰 수
 * @param totalInputTokens - 전체 입력 토큰 수
 * @returns 비용 절감률 (0-1)
 */
export function calculateCostSavings(
  cacheReadTokens: number,
  totalInputTokens: number
): number {
  if (totalInputTokens === 0) return 0;

  // 캐시 읽기는 90% 할인
  const cacheReadCost = cacheReadTokens * 0.1;
  const normalCost = (totalInputTokens - cacheReadTokens) * 1.0;

  const actualCost = cacheReadCost + normalCost;
  const originalCost = totalInputTokens * 1.0;

  return (originalCost - actualCost) / originalCost;
}
