/**
 * 비용 계산 및 예측 유틸리티
 * 토큰 사용량을 기반으로 비용을 계산하고 월말 예상 비용을 예측합니다.
 */

import { db } from '@/lib/db';
import { tokenUsageLogs, llmModels, responseTimeLogs } from '@/drizzle/schema';
import { eq, sql, and, gte, lte, desc } from 'drizzle-orm';
import { logger } from '@/lib/logger';
import type {
  UsageOverview,
  DailyUsage,
  Forecast,
  ModelProvider,
  ModelId,
  FeatureType,
  TokenEfficiency,
  FeatureDistribution,
  CacheHitTrend,
  CacheCostComparison,
  HourlyUsageCell,
  ChannelUsage,
  ChunkDistribution,
  PipelineLatency,
} from './types';

/**
 * 기간별 사용량 개요 조회
 */
export async function getUsageOverview(
  period: 'today' | 'week' | 'month',
  tenantId?: string
): Promise<UsageOverview> {
  const now = new Date();
  let startDate: Date;

  switch (period) {
    case 'today':
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      break;
    case 'week':
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case 'month':
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
  }

  const conditions = [gte(tokenUsageLogs.createdAt, startDate)];
  if (tenantId) {
    conditions.push(eq(tokenUsageLogs.tenantId, tenantId));
  }

  // 전체 집계
  const [totals] = await db
    .select({
      totalTokens: sql<number>`COALESCE(SUM(${tokenUsageLogs.totalTokens}), 0)`,
      totalCostUsd: sql<number>`COALESCE(SUM(${tokenUsageLogs.totalCostUsd}), 0)`,
      inputTokens: sql<number>`COALESCE(SUM(${tokenUsageLogs.inputTokens}), 0)`,
      outputTokens: sql<number>`COALESCE(SUM(${tokenUsageLogs.outputTokens}), 0)`,
    })
    .from(tokenUsageLogs)
    .where(and(...conditions));

  // 모델별 집계
  const byModelRaw = await db
    .select({
      provider: tokenUsageLogs.modelProvider,
      modelId: tokenUsageLogs.modelId,
      inputTokens: sql<number>`COALESCE(SUM(${tokenUsageLogs.inputTokens}), 0)`,
      outputTokens: sql<number>`COALESCE(SUM(${tokenUsageLogs.outputTokens}), 0)`,
      totalCostUsd: sql<number>`COALESCE(SUM(${tokenUsageLogs.totalCostUsd}), 0)`,
    })
    .from(tokenUsageLogs)
    .where(and(...conditions))
    .groupBy(tokenUsageLogs.modelProvider, tokenUsageLogs.modelId);

  // 모델 표시 이름 조회
  const modelNames = await db
    .select({
      provider: llmModels.provider,
      modelId: llmModels.modelId,
      displayName: llmModels.displayName,
    })
    .from(llmModels);

  const modelNameMap = new Map<string, string>();
  for (const m of modelNames) {
    modelNameMap.set(`${m.provider}:${m.modelId}`, m.displayName);
  }

  const totalCost = totals.totalCostUsd || 0;
  const byModel = byModelRaw.map((m) => ({
    provider: m.provider as ModelProvider,
    modelId: m.modelId as ModelId,
    displayName: modelNameMap.get(`${m.provider}:${m.modelId}`) || m.modelId,
    inputTokens: m.inputTokens,
    outputTokens: m.outputTokens,
    totalCostUsd: m.totalCostUsd,
    percentage: totalCost > 0 ? (m.totalCostUsd / totalCost) * 100 : 0,
  }));

  // 기능별 집계
  const byFeatureRaw = await db
    .select({
      featureType: tokenUsageLogs.featureType,
      totalTokens: sql<number>`COALESCE(SUM(${tokenUsageLogs.totalTokens}), 0)`,
      totalCostUsd: sql<number>`COALESCE(SUM(${tokenUsageLogs.totalCostUsd}), 0)`,
    })
    .from(tokenUsageLogs)
    .where(and(...conditions))
    .groupBy(tokenUsageLogs.featureType);

  const byFeature = byFeatureRaw.map((f) => ({
    featureType: f.featureType as FeatureType,
    totalTokens: f.totalTokens,
    totalCostUsd: f.totalCostUsd,
    percentage: totalCost > 0 ? (f.totalCostUsd / totalCost) * 100 : 0,
  }));

  return {
    period,
    totalTokens: totals.totalTokens || 0,
    totalCostUsd: totalCost,
    inputTokens: totals.inputTokens || 0,
    outputTokens: totals.outputTokens || 0,
    byModel,
    byFeature,
  };
}

/**
 * 일별 사용량 추이 조회
 */
export async function getUsageTrend(
  days: number = 30,
  tenantId?: string
): Promise<DailyUsage[]> {
  const now = new Date();
  const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

  const conditions = [gte(tokenUsageLogs.createdAt, startDate)];
  if (tenantId) {
    conditions.push(eq(tokenUsageLogs.tenantId, tenantId));
  }

  // 일별 집계
  const dailyTotals = await db
    .select({
      date: sql<string>`DATE(${tokenUsageLogs.createdAt})`,
      totalTokens: sql<number>`COALESCE(SUM(${tokenUsageLogs.totalTokens}), 0)`,
      totalCostUsd: sql<number>`COALESCE(SUM(${tokenUsageLogs.totalCostUsd}), 0)`,
    })
    .from(tokenUsageLogs)
    .where(and(...conditions))
    .groupBy(sql`DATE(${tokenUsageLogs.createdAt})`)
    .orderBy(sql`DATE(${tokenUsageLogs.createdAt})`);

  // 일별 모델별 집계
  const dailyByModel = await db
    .select({
      date: sql<string>`DATE(${tokenUsageLogs.createdAt})`,
      modelKey: sql<string>`${tokenUsageLogs.modelProvider} || ':' || ${tokenUsageLogs.modelId}`,
      inputTokens: sql<number>`COALESCE(SUM(${tokenUsageLogs.inputTokens}), 0)`,
      outputTokens: sql<number>`COALESCE(SUM(${tokenUsageLogs.outputTokens}), 0)`,
      totalCostUsd: sql<number>`COALESCE(SUM(${tokenUsageLogs.totalCostUsd}), 0)`,
    })
    .from(tokenUsageLogs)
    .where(and(...conditions))
    .groupBy(
      sql`DATE(${tokenUsageLogs.createdAt})`,
      tokenUsageLogs.modelProvider,
      tokenUsageLogs.modelId
    );

  // 데이터 구조화
  const byModelMap = new Map<string, Map<string, DailyUsage['byModel'][string]>>();
  for (const row of dailyByModel) {
    if (!byModelMap.has(row.date)) {
      byModelMap.set(row.date, new Map());
    }
    byModelMap.get(row.date)!.set(row.modelKey, {
      inputTokens: row.inputTokens,
      outputTokens: row.outputTokens,
      totalCostUsd: row.totalCostUsd,
    });
  }

  return dailyTotals.map((day) => ({
    date: new Date(day.date),
    totalTokens: day.totalTokens,
    totalCostUsd: day.totalCostUsd,
    byModel: Object.fromEntries(byModelMap.get(day.date) || new Map()),
  }));
}

/**
 * 월말 비용 예측
 */
export async function getForecast(tenantId?: string): Promise<Forecast> {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  // 현재 월 일수 및 남은 일수
  const totalDaysInMonth = Math.ceil(
    (nextMonthStart.getTime() - monthStart.getTime()) / (24 * 60 * 60 * 1000)
  );
  const daysPassed = Math.ceil(
    (now.getTime() - monthStart.getTime()) / (24 * 60 * 60 * 1000)
  );
  const daysRemaining = totalDaysInMonth - daysPassed;

  // 현재 월 사용량 조회
  const conditions = [
    gte(tokenUsageLogs.createdAt, monthStart),
    lte(tokenUsageLogs.createdAt, now),
  ];
  if (tenantId) {
    conditions.push(eq(tokenUsageLogs.tenantId, tenantId));
  }

  const [currentUsage] = await db
    .select({
      totalCostUsd: sql<number>`COALESCE(SUM(${tokenUsageLogs.totalCostUsd}), 0)`,
    })
    .from(tokenUsageLogs)
    .where(and(...conditions));

  const currentMonthUsage = currentUsage.totalCostUsd || 0;

  // 일평균 계산 (최소 1일)
  const effectiveDaysPassed = Math.max(daysPassed, 1);
  const dailyAverage = currentMonthUsage / effectiveDaysPassed;

  // 월말 예상 비용
  const projectedMonthlyUsage = dailyAverage * totalDaysInMonth;

  // 트렌드 분석 (최근 7일 vs 이전 7일)
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

  const recentConditions = [
    gte(tokenUsageLogs.createdAt, sevenDaysAgo),
    lte(tokenUsageLogs.createdAt, now),
  ];
  const previousConditions = [
    gte(tokenUsageLogs.createdAt, fourteenDaysAgo),
    lte(tokenUsageLogs.createdAt, sevenDaysAgo),
  ];

  if (tenantId) {
    recentConditions.push(eq(tokenUsageLogs.tenantId, tenantId));
    previousConditions.push(eq(tokenUsageLogs.tenantId, tenantId));
  }

  const [recentUsage] = await db
    .select({
      totalCostUsd: sql<number>`COALESCE(SUM(${tokenUsageLogs.totalCostUsd}), 0)`,
    })
    .from(tokenUsageLogs)
    .where(and(...recentConditions));

  const [previousUsage] = await db
    .select({
      totalCostUsd: sql<number>`COALESCE(SUM(${tokenUsageLogs.totalCostUsd}), 0)`,
    })
    .from(tokenUsageLogs)
    .where(and(...previousConditions));

  // 트렌드 결정
  let trend: Forecast['trend'] = 'stable';
  const recentCost = recentUsage.totalCostUsd || 0;
  const previousCost = previousUsage.totalCostUsd || 0;

  if (previousCost > 0) {
    const changeRatio = (recentCost - previousCost) / previousCost;
    if (changeRatio > 0.1) {
      trend = 'increasing';
    } else if (changeRatio < -0.1) {
      trend = 'decreasing';
    }
  }

  // 신뢰도 결정 (데이터가 많을수록 높음)
  let confidenceLevel: Forecast['confidenceLevel'] = 'low';
  if (daysPassed >= 20) {
    confidenceLevel = 'high';
  } else if (daysPassed >= 7) {
    confidenceLevel = 'medium';
  }

  return {
    currentMonthUsage,
    projectedMonthlyUsage,
    daysRemaining,
    dailyAverage,
    trend,
    confidenceLevel,
  };
}

/**
 * 테넌트별 사용량 순위 조회
 */
export async function getTopTenantsByUsage(
  period: 'today' | 'week' | 'month',
  limit: number = 10
): Promise<
  Array<{
    tenantId: string;
    totalTokens: number;
    totalCostUsd: number;
  }>
> {
  const now = new Date();
  let startDate: Date;

  switch (period) {
    case 'today':
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      break;
    case 'week':
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case 'month':
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
  }

  const results = await db
    .select({
      tenantId: tokenUsageLogs.tenantId,
      totalTokens: sql<number>`COALESCE(SUM(${tokenUsageLogs.totalTokens}), 0)`,
      totalCostUsd: sql<number>`COALESCE(SUM(${tokenUsageLogs.totalCostUsd}), 0)`,
    })
    .from(tokenUsageLogs)
    .where(gte(tokenUsageLogs.createdAt, startDate))
    .groupBy(tokenUsageLogs.tenantId)
    .orderBy(desc(sql`SUM(${tokenUsageLogs.totalCostUsd})`))
    .limit(limit);

  return results;
}

/**
 * 이상치 감지 (전일 대비 급증)
 */
export async function detectAnomalies(
  thresholdMultiplier: number = 2.0
): Promise<
  Array<{
    tenantId: string;
    todayCost: number;
    yesterdayCost: number;
    increaseRatio: number;
  }>
> {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterdayStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000);

  // 오늘 사용량
  const todayUsage = await db
    .select({
      tenantId: tokenUsageLogs.tenantId,
      totalCostUsd: sql<number>`COALESCE(SUM(${tokenUsageLogs.totalCostUsd}), 0)`,
    })
    .from(tokenUsageLogs)
    .where(gte(tokenUsageLogs.createdAt, todayStart))
    .groupBy(tokenUsageLogs.tenantId);

  // 어제 사용량
  const yesterdayUsage = await db
    .select({
      tenantId: tokenUsageLogs.tenantId,
      totalCostUsd: sql<number>`COALESCE(SUM(${tokenUsageLogs.totalCostUsd}), 0)`,
    })
    .from(tokenUsageLogs)
    .where(
      and(
        gte(tokenUsageLogs.createdAt, yesterdayStart),
        lte(tokenUsageLogs.createdAt, todayStart)
      )
    )
    .groupBy(tokenUsageLogs.tenantId);

  const yesterdayMap = new Map<string, number>();
  for (const y of yesterdayUsage) {
    yesterdayMap.set(y.tenantId, y.totalCostUsd);
  }

  const anomalies: Array<{
    tenantId: string;
    todayCost: number;
    yesterdayCost: number;
    increaseRatio: number;
  }> = [];

  for (const t of todayUsage) {
    const yesterdayCost = yesterdayMap.get(t.tenantId) || 0;
    if (yesterdayCost > 0) {
      const increaseRatio = t.totalCostUsd / yesterdayCost;
      if (increaseRatio >= thresholdMultiplier) {
        anomalies.push({
          tenantId: t.tenantId,
          todayCost: t.totalCostUsd,
          yesterdayCost,
          increaseRatio,
        });
      }
    }
  }

  return anomalies.sort((a, b) => b.increaseRatio - a.increaseRatio);
}

// ============================================================
// AI 인사이트 대시보드 쿼리 함수
// ============================================================

/**
 * 모델별 토큰 효율성 분석
 * 입력/출력 토큰 비율과 비용 효율성을 계산합니다.
 */
export async function getTokenEfficiencyByModel(
  period: 'week' | 'month'
): Promise<TokenEfficiency[]> {
  const now = new Date();
  const startDate =
    period === 'week'
      ? new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      : new Date(now.getFullYear(), now.getMonth(), 1);

  // 모델 표시 이름 조회
  const modelNames = await db
    .select({
      provider: llmModels.provider,
      modelId: llmModels.modelId,
      displayName: llmModels.displayName,
    })
    .from(llmModels);

  const modelNameMap = new Map<string, string>();
  for (const m of modelNames) {
    modelNameMap.set(`${m.provider}:${m.modelId}`, m.displayName);
  }

  const results = await db
    .select({
      modelId: tokenUsageLogs.modelId,
      avgInputTokens: sql<number>`AVG(${tokenUsageLogs.inputTokens})`,
      avgOutputTokens: sql<number>`AVG(${tokenUsageLogs.outputTokens})`,
      totalCost: sql<number>`COALESCE(SUM(${tokenUsageLogs.totalCostUsd}), 0)`,
      requestCount: sql<number>`COUNT(*)`,
      totalInput: sql<number>`COALESCE(SUM(${tokenUsageLogs.inputTokens}), 0)`,
      totalOutput: sql<number>`COALESCE(SUM(${tokenUsageLogs.outputTokens}), 0)`,
    })
    .from(tokenUsageLogs)
    .where(gte(tokenUsageLogs.createdAt, startDate))
    .groupBy(tokenUsageLogs.modelId);

  return results.map((r) => ({
    modelId: r.modelId as ModelId,
    displayName: modelNameMap.get(`openai:${r.modelId}`) ||
      modelNameMap.get(`google:${r.modelId}`) ||
      modelNameMap.get(`anthropic:${r.modelId}`) ||
      r.modelId,
    avgInputTokens: Math.round(r.avgInputTokens || 0),
    avgOutputTokens: Math.round(r.avgOutputTokens || 0),
    totalCost: r.totalCost,
    requestCount: r.requestCount,
    ioRatio: r.totalInput > 0 ? r.totalOutput / r.totalInput : 0,
  }));
}

/**
 * Feature별 토큰 분포
 * 기능별 토큰 사용량 비율을 분석합니다.
 */
export async function getTokenUsageByFeature(
  period: 'week' | 'month'
): Promise<FeatureDistribution[]> {
  const now = new Date();
  const startDate =
    period === 'week'
      ? new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      : new Date(now.getFullYear(), now.getMonth(), 1);

  const results = await db
    .select({
      featureType: tokenUsageLogs.featureType,
      inputTokens: sql<number>`COALESCE(SUM(${tokenUsageLogs.inputTokens}), 0)`,
      outputTokens: sql<number>`COALESCE(SUM(${tokenUsageLogs.outputTokens}), 0)`,
      totalTokens: sql<number>`COALESCE(SUM(${tokenUsageLogs.totalTokens}), 0)`,
    })
    .from(tokenUsageLogs)
    .where(gte(tokenUsageLogs.createdAt, startDate))
    .groupBy(tokenUsageLogs.featureType);

  const totalTokens = results.reduce((sum, r) => sum + r.totalTokens, 0);

  return results.map((r) => ({
    featureType: r.featureType as FeatureType,
    inputTokens: r.inputTokens,
    outputTokens: r.outputTokens,
    totalTokens: r.totalTokens,
    percentage: totalTokens > 0 ? (r.totalTokens / totalTokens) * 100 : 0,
  }));
}

/**
 * 일별 캐시 히트율 추이
 * responseTimeLogs에서 캐시 효율성을 시계열로 분석합니다.
 */
export async function getCacheHitRateTrend(
  days: number = 30
): Promise<CacheHitTrend[]> {
  const now = new Date();
  const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

  const results = await db
    .select({
      date: sql<string>`DATE(${responseTimeLogs.createdAt})`,
      hitCount: sql<number>`SUM(CASE WHEN ${responseTimeLogs.cacheHit} = true THEN 1 ELSE 0 END)`,
      totalCount: sql<number>`COUNT(*)`,
    })
    .from(responseTimeLogs)
    .where(gte(responseTimeLogs.createdAt, startDate))
    .groupBy(sql`DATE(${responseTimeLogs.createdAt})`)
    .orderBy(sql`DATE(${responseTimeLogs.createdAt})`);

  return results.map((r) => ({
    date: r.date,
    hitCount: r.hitCount,
    totalCount: r.totalCount,
    hitRate: r.totalCount > 0 ? (r.hitCount / r.totalCount) * 100 : 0,
  }));
}

/**
 * 캐시 비용 비교
 * 캐시 히트/미스 요청 수와 추정 절감 비용을 분석합니다.
 */
export async function getCacheCostComparison(
  period: 'week' | 'month'
): Promise<CacheCostComparison> {
  const now = new Date();
  const startDate =
    period === 'week'
      ? new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      : new Date(now.getFullYear(), now.getMonth(), 1);

  // 캐시 히트/미스 카운트
  const [cacheStats] = await db
    .select({
      cachedRequests: sql<number>`SUM(CASE WHEN ${responseTimeLogs.cacheHit} = true THEN 1 ELSE 0 END)`,
      nonCachedRequests: sql<number>`SUM(CASE WHEN ${responseTimeLogs.cacheHit} = false THEN 1 ELSE 0 END)`,
      cachedTokens: sql<number>`COALESCE(SUM(CASE WHEN ${responseTimeLogs.cacheHit} = true THEN ${responseTimeLogs.estimatedTokens} ELSE 0 END), 0)`,
    })
    .from(responseTimeLogs)
    .where(gte(responseTimeLogs.createdAt, startDate));

  // 비캐시 요청의 평균 비용 계산 (tokenUsageLogs에서)
  const [avgCost] = await db
    .select({
      avgCostPerRequest: sql<number>`COALESCE(AVG(${tokenUsageLogs.totalCostUsd}), 0)`,
    })
    .from(tokenUsageLogs)
    .where(
      and(
        gte(tokenUsageLogs.createdAt, startDate),
        eq(tokenUsageLogs.featureType, 'chat')
      )
    );

  // 캐시된 요청 수 × 평균 비용 = 추정 절감액
  const estimatedSavings =
    (cacheStats?.cachedRequests || 0) * (avgCost?.avgCostPerRequest || 0);

  return {
    cachedRequests: cacheStats?.cachedRequests || 0,
    nonCachedRequests: cacheStats?.nonCachedRequests || 0,
    estimatedSavings,
  };
}

/**
 * 시간대별 사용량 (Heatmap용)
 * 요일×시간 조합별 사용량을 분석합니다.
 */
export async function getUsageByDayHour(
  days: number = 30
): Promise<HourlyUsageCell[]> {
  const now = new Date();
  const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

  const results = await db
    .select({
      dayOfWeek: sql<number>`EXTRACT(DOW FROM ${tokenUsageLogs.createdAt})`,
      hour: sql<number>`EXTRACT(HOUR FROM ${tokenUsageLogs.createdAt})`,
      count: sql<number>`COUNT(*)`,
      cost: sql<number>`COALESCE(SUM(${tokenUsageLogs.totalCostUsd}), 0)`,
    })
    .from(tokenUsageLogs)
    .where(gte(tokenUsageLogs.createdAt, startDate))
    .groupBy(
      sql`EXTRACT(DOW FROM ${tokenUsageLogs.createdAt})`,
      sql`EXTRACT(HOUR FROM ${tokenUsageLogs.createdAt})`
    );

  // 최대값 찾아서 intensity 정규화
  const maxCount = Math.max(...results.map((r) => r.count), 1);

  return results.map((r) => ({
    dayOfWeek: r.dayOfWeek,
    hour: r.hour,
    count: r.count,
    cost: r.cost,
    intensity: r.count / maxCount,
  }));
}

/**
 * 채널별 사용량 추이
 * 웹/카카오 채널별 일간 사용량을 분석합니다.
 */
export async function getUsageByChannel(
  days: number = 30
): Promise<ChannelUsage[]> {
  const now = new Date();
  const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

  const results = await db
    .select({
      date: sql<string>`DATE(${responseTimeLogs.createdAt})`,
      web: sql<number>`SUM(CASE WHEN ${responseTimeLogs.channel} = 'web' THEN 1 ELSE 0 END)`,
      kakao: sql<number>`SUM(CASE WHEN ${responseTimeLogs.channel} = 'kakao' THEN 1 ELSE 0 END)`,
      total: sql<number>`COUNT(*)`,
    })
    .from(responseTimeLogs)
    .where(gte(responseTimeLogs.createdAt, startDate))
    .groupBy(sql`DATE(${responseTimeLogs.createdAt})`)
    .orderBy(sql`DATE(${responseTimeLogs.createdAt})`);

  return results.map((r) => ({
    date: r.date,
    web: r.web,
    kakao: r.kakao,
    total: r.total,
  }));
}

/**
 * 청크 수 분포
 * RAG 검색에서 사용된 청크 수 분포를 분석합니다.
 */
export async function getChunkDistribution(): Promise<ChunkDistribution[]> {
  const now = new Date();
  const startDate = new Date(now.getFullYear(), now.getMonth(), 1);

  // 범위별 집계
  const results = await db
    .select({
      range: sql<string>`
        CASE
          WHEN ${responseTimeLogs.chunksUsed} <= 2 THEN '1-2'
          WHEN ${responseTimeLogs.chunksUsed} <= 4 THEN '3-4'
          WHEN ${responseTimeLogs.chunksUsed} <= 6 THEN '5-6'
          WHEN ${responseTimeLogs.chunksUsed} <= 8 THEN '7-8'
          ELSE '9+'
        END
      `,
      count: sql<number>`COUNT(*)`,
    })
    .from(responseTimeLogs)
    .where(gte(responseTimeLogs.createdAt, startDate))
    .groupBy(sql`
      CASE
        WHEN ${responseTimeLogs.chunksUsed} <= 2 THEN '1-2'
        WHEN ${responseTimeLogs.chunksUsed} <= 4 THEN '3-4'
        WHEN ${responseTimeLogs.chunksUsed} <= 6 THEN '5-6'
        WHEN ${responseTimeLogs.chunksUsed} <= 8 THEN '7-8'
        ELSE '9+'
      END
    `);

  const totalCount = results.reduce((sum, r) => sum + r.count, 0);

  // 범위 순서대로 정렬
  const rangeOrder = ['1-2', '3-4', '5-6', '7-8', '9+'];
  const sortedResults = rangeOrder.map((range) => {
    const found = results.find((r) => r.range === range);
    return {
      range,
      count: found?.count || 0,
      percentage:
        totalCount > 0 ? ((found?.count || 0) / totalCount) * 100 : 0,
    };
  });

  return sortedResults;
}

/**
 * 파이프라인 지연시간
 * RAG 파이프라인 각 단계별 평균 지연시간을 분석합니다.
 */
export async function getPipelineLatency(): Promise<PipelineLatency> {
  const now = new Date();
  const startDate = new Date(now.getFullYear(), now.getMonth(), 1);

  const [result] = await db
    .select({
      llmAvgMs: sql<number>`COALESCE(AVG(${responseTimeLogs.llmDurationMs}), 0)`,
      searchAvgMs: sql<number>`COALESCE(AVG(${responseTimeLogs.searchDurationMs}), 0)`,
      rewriteAvgMs: sql<number>`COALESCE(AVG(${responseTimeLogs.rewriteDurationMs}), 0)`,
      totalAvgMs: sql<number>`COALESCE(AVG(${responseTimeLogs.totalDurationMs}), 0)`,
    })
    .from(responseTimeLogs)
    .where(gte(responseTimeLogs.createdAt, startDate));

  const llmAvgMs = Math.round(result?.llmAvgMs || 0);
  const searchAvgMs = Math.round(result?.searchAvgMs || 0);
  const rewriteAvgMs = Math.round(result?.rewriteAvgMs || 0);
  const totalAvgMs = Math.round(result?.totalAvgMs || 0);

  // 기타 = 전체 - (LLM + 검색 + 재작성)
  const otherAvgMs = Math.max(0, totalAvgMs - llmAvgMs - searchAvgMs - rewriteAvgMs);

  return {
    llmAvgMs,
    searchAvgMs,
    rewriteAvgMs,
    otherAvgMs,
    totalAvgMs,
  };
}
