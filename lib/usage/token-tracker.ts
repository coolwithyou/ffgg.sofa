/**
 * 토큰 사용량 추적 미들웨어
 * AI API 호출 시 자동으로 토큰 사용량을 로깅합니다.
 */

import { db } from '@/lib/db';
import { tokenUsageLogs, llmModels, tenantBudgetStatus } from '@/drizzle/schema';
import { eq, and, sql } from 'drizzle-orm';
import { logger } from '@/lib/logger';
import type { TokenUsageParams, ModelPrice, CostBreakdown } from './types';

// 모델 가격 캐시 (5분간 유지)
let modelPriceCache: Map<string, ModelPrice> | null = null;
let cacheExpiry: number = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5분

/**
 * 모델 가격 정보 조회 (캐싱 적용)
 */
export async function getModelPrices(): Promise<Map<string, ModelPrice>> {
  const now = Date.now();

  if (modelPriceCache && now < cacheExpiry) {
    return modelPriceCache;
  }

  try {
    const models = await db
      .select({
        provider: llmModels.provider,
        modelId: llmModels.modelId,
        displayName: llmModels.displayName,
        inputPricePerMillion: llmModels.inputPricePerMillion,
        outputPricePerMillion: llmModels.outputPricePerMillion,
        isEmbedding: llmModels.isEmbedding,
      })
      .from(llmModels)
      .where(eq(llmModels.isActive, true));

    const priceMap = new Map<string, ModelPrice>();
    for (const model of models) {
      const key = `${model.provider}:${model.modelId}`;
      priceMap.set(key, {
        provider: model.provider as ModelPrice['provider'],
        modelId: model.modelId as ModelPrice['modelId'],
        displayName: model.displayName,
        inputPricePerMillion: model.inputPricePerMillion,
        outputPricePerMillion: model.outputPricePerMillion,
        isEmbedding: model.isEmbedding ?? false,
      });
    }

    modelPriceCache = priceMap;
    cacheExpiry = now + CACHE_TTL_MS;

    return priceMap;
  } catch (error) {
    logger.error('Failed to fetch model prices', error as Error);
    // 캐시가 있으면 만료되어도 사용
    if (modelPriceCache) {
      return modelPriceCache;
    }
    throw error;
  }
}

/**
 * 토큰 비용 계산
 */
export function calculateCost(
  inputTokens: number,
  outputTokens: number,
  price: ModelPrice
): CostBreakdown {
  // 가격은 1M 토큰 당 USD
  const inputCostUsd = (inputTokens / 1_000_000) * price.inputPricePerMillion;
  const outputCostUsd = (outputTokens / 1_000_000) * price.outputPricePerMillion;

  return {
    inputCostUsd,
    outputCostUsd,
    totalCostUsd: inputCostUsd + outputCostUsd,
  };
}

/**
 * 토큰 사용량 추적 및 로깅
 * AI API 호출 후 이 함수를 호출하여 사용량을 기록합니다.
 *
 * 데이터 정합성을 보장하기 위해 트랜잭션 내에서 실행됩니다:
 * 1. tokenUsageLogs에 사용량 기록
 * 2. tenantBudgetStatus의 월간 누적 비용 업데이트
 */
export async function trackTokenUsage(params: TokenUsageParams): Promise<void> {
  const {
    tenantId,
    chatbotId,
    conversationId,
    modelProvider,
    modelId,
    featureType,
    inputTokens,
    outputTokens,
  } = params;

  try {
    // 모델 가격 조회 (트랜잭션 외부에서 실행 - 캐시 활용)
    const prices = await getModelPrices();
    const priceKey = `${modelProvider}:${modelId}`;
    const price = prices.get(priceKey);

    if (!price) {
      logger.warn('Model price not found, using zero cost', { priceKey });
    }

    // 비용 계산
    const cost = price
      ? calculateCost(inputTokens, outputTokens, price)
      : { inputCostUsd: 0, outputCostUsd: 0, totalCostUsd: 0 };

    const totalTokens = inputTokens + outputTokens;

    // 트랜잭션으로 원자적 실행 보장
    await db.transaction(async (tx) => {
      // 1. 토큰 사용량 로그 저장
      await tx.insert(tokenUsageLogs).values({
        tenantId,
        chatbotId: chatbotId ?? null,
        conversationId: conversationId ?? null,
        modelProvider,
        modelId,
        featureType,
        inputTokens,
        outputTokens,
        totalTokens,
        inputCostUsd: cost.inputCostUsd,
        outputCostUsd: cost.outputCostUsd,
        totalCostUsd: cost.totalCostUsd,
      });

      // 2. 테넌트 월간 사용량 업데이트 (upsert)
      await tx
        .insert(tenantBudgetStatus)
        .values({
          tenantId,
          currentMonthUsageUsd: cost.totalCostUsd,
        })
        .onConflictDoUpdate({
          target: tenantBudgetStatus.tenantId,
          set: {
            currentMonthUsageUsd: sql`${tenantBudgetStatus.currentMonthUsageUsd} + ${cost.totalCostUsd}`,
            updatedAt: sql`now()`,
          },
        });
    });

    logger.debug('Token usage tracked', {
      tenantId,
      modelProvider,
      modelId,
      featureType,
      inputTokens,
      outputTokens,
      totalCostUsd: cost.totalCostUsd,
    });
  } catch (error) {
    // 로깅 실패가 주요 기능을 방해하지 않도록 에러만 기록
    logger.error('Failed to track token usage', error as Error, {
      tenantId,
      modelProvider,
      modelId,
    });
  }
}

/**
 * 배치 토큰 사용량 추적 (임베딩 등 대량 처리용)
 */
export async function trackBatchTokenUsage(
  params: Omit<TokenUsageParams, 'inputTokens' | 'outputTokens'> & {
    totalTokens: number;
  }
): Promise<void> {
  const { totalTokens, ...rest } = params;

  // 임베딩은 input/output 구분이 없으므로 inputTokens로만 계산
  await trackTokenUsage({
    ...rest,
    inputTokens: totalTokens,
    outputTokens: 0,
  });
}

/**
 * 모델 가격 캐시 무효화 (관리자가 가격 수정 시 호출)
 */
export function invalidateModelPriceCache(): void {
  modelPriceCache = null;
  cacheExpiry = 0;
}

/**
 * 테넌트의 현재 월 사용량 조회
 */
export async function getCurrentMonthUsage(tenantId: string): Promise<number> {
  const result = await db
    .select({
      currentMonthUsageUsd: tenantBudgetStatus.currentMonthUsageUsd,
    })
    .from(tenantBudgetStatus)
    .where(eq(tenantBudgetStatus.tenantId, tenantId))
    .limit(1);

  return result[0]?.currentMonthUsageUsd ?? 0;
}

/**
 * 월초 사용량 리셋 (Cron job에서 호출)
 */
export async function resetMonthlyUsage(): Promise<void> {
  try {
    await db
      .update(tenantBudgetStatus)
      .set({
        currentMonthUsageUsd: 0,
        updatedAt: sql`now()`,
      });

    logger.info('Monthly usage reset completed');
  } catch (error) {
    logger.error('Failed to reset monthly usage', error as Error);
    throw error;
  }
}
