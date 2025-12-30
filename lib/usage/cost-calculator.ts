/**
 * 비용 계산 및 예측 유틸리티
 * 토큰 사용량을 기반으로 비용을 계산하고 월말 예상 비용을 예측합니다.
 */

import { db } from '@/lib/db';
import { tokenUsageLogs, llmModels } from '@/drizzle/schema';
import { eq, sql, and, gte, lte, desc } from 'drizzle-orm';
import { logger } from '@/lib/logger';
import type {
  UsageOverview,
  DailyUsage,
  Forecast,
  ModelProvider,
  ModelId,
  FeatureType,
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
