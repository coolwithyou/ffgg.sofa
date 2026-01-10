'use server';

/**
 * 사용량 대시보드 서버 액션
 */

import { validateSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { tenants } from '@/drizzle/schema';
import { eq } from 'drizzle-orm';
import {
  getUsageOverview,
  getUsageTrend,
  getForecast,
  getTopTenantsByUsage,
  detectAnomalies,
  // 인사이트 대시보드 쿼리 함수
  getTokenEfficiencyByModel,
  getTokenUsageByFeature,
  getCacheHitRateTrend,
  getCacheCostComparison,
  getUsageByDayHour,
  getUsageByChannel,
  getChunkDistribution,
  getPipelineLatency,
} from '@/lib/usage/cost-calculator';
import { getAllTenantBudgetStatuses } from '@/lib/tier/budget-limits';
import type {
  UsageOverview,
  DailyUsage,
  Forecast,
  BudgetStatus,
  InsightsDashboardData,
} from '@/lib/usage/types';

// 쿼리 타임아웃 설정 (밀리초)
const QUERY_TIMEOUT_MS = 5000;

/**
 * 타임아웃이 있는 Promise 래퍼
 * 쿼리가 지정된 시간 내에 완료되지 않으면 기본값을 반환합니다.
 */
async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  defaultValue: T
): Promise<T> {
  return new Promise((resolve) => {
    const timeoutId = setTimeout(() => {
      console.warn(`Query timed out after ${timeoutMs}ms, returning default value`);
      resolve(defaultValue);
    }, timeoutMs);

    promise
      .then((result) => {
        clearTimeout(timeoutId);
        resolve(result);
      })
      .catch((error) => {
        clearTimeout(timeoutId);
        console.error('Query failed:', error);
        resolve(defaultValue);
      });
  });
}

// 기본값 상수
const DEFAULT_USAGE_OVERVIEW: UsageOverview = {
  period: 'today',
  totalTokens: 0,
  totalCostUsd: 0,
  inputTokens: 0,
  outputTokens: 0,
  byModel: [],
  byFeature: [],
};

const DEFAULT_FORECAST: Forecast = {
  currentMonthUsage: 0,
  projectedMonthlyUsage: 0,
  daysRemaining: 0,
  dailyAverage: 0,
  trend: 'stable',
  confidenceLevel: 'low',
};

export interface UsageDashboardData {
  overview: {
    today: UsageOverview;
    month: UsageOverview;
  };
  trend: DailyUsage[];
  forecast: Forecast;
  topTenants: Array<{
    tenantId: string;
    tenantName: string;
    totalTokens: number;
    totalCostUsd: number;
  }>;
  budgetStatuses: BudgetStatus[];
  anomalies: Array<{
    tenantId: string;
    tenantName: string;
    todayCost: number;
    yesterdayCost: number;
    increaseRatio: number;
  }>;
}

/**
 * 사용량 대시보드 데이터 조회
 */
export async function getUsageDashboardData(): Promise<UsageDashboardData | null> {
  const session = await validateSession();
  if (!session || (session.role !== 'internal_operator' && session.role !== 'admin')) {
    return null;
  }

  try {
    // 병렬로 데이터 조회
    const [todayOverview, monthOverview, trend, forecast, topTenantRaw, budgetStatuses, anomaliesRaw] =
      await Promise.all([
        getUsageOverview('today'),
        getUsageOverview('month'),
        getUsageTrend(30),
        getForecast(),
        getTopTenantsByUsage('month', 10),
        getAllTenantBudgetStatuses(),
        detectAnomalies(2.0),
      ]);

    // 테넌트 이름 조회
    const tenantIds = [
      ...new Set([
        ...topTenantRaw.map((t) => t.tenantId),
        ...anomaliesRaw.map((a) => a.tenantId),
      ]),
    ];

    const tenantNames = new Map<string, string>();
    if (tenantIds.length > 0) {
      const tenantRecords = await db
        .select({ id: tenants.id, name: tenants.name })
        .from(tenants);

      for (const t of tenantRecords) {
        tenantNames.set(t.id, t.name);
      }
    }

    return {
      overview: {
        today: todayOverview,
        month: monthOverview,
      },
      trend,
      forecast,
      topTenants: topTenantRaw.map((t) => ({
        ...t,
        tenantName: tenantNames.get(t.tenantId) || 'Unknown',
      })),
      budgetStatuses,
      anomalies: anomaliesRaw.map((a) => ({
        ...a,
        tenantName: tenantNames.get(a.tenantId) || 'Unknown',
      })),
    };
  } catch (error) {
    console.error('Failed to get usage dashboard data:', error);
    return null;
  }
}

/**
 * 특정 기간의 사용량 개요 조회
 */
export async function getUsageOverviewAction(
  period: 'today' | 'week' | 'month'
): Promise<UsageOverview | null> {
  const session = await validateSession();
  if (!session || (session.role !== 'internal_operator' && session.role !== 'admin')) {
    return null;
  }

  try {
    return await getUsageOverview(period);
  } catch (error) {
    console.error('Failed to get usage overview:', error);
    return null;
  }
}

/**
 * 사용량 트렌드 조회
 */
export async function getUsageTrendAction(days: number = 30): Promise<DailyUsage[] | null> {
  const session = await validateSession();
  if (!session || (session.role !== 'internal_operator' && session.role !== 'admin')) {
    return null;
  }

  try {
    return await getUsageTrend(days);
  } catch (error) {
    console.error('Failed to get usage trend:', error);
    return null;
  }
}

/**
 * 월말 예측 조회
 */
export async function getForecastAction(): Promise<Forecast | null> {
  const session = await validateSession();
  if (!session || (session.role !== 'internal_operator' && session.role !== 'admin')) {
    return null;
  }

  try {
    return await getForecast();
  } catch (error) {
    console.error('Failed to get forecast:', error);
    return null;
  }
}

/**
 * AI 인사이트 통합 대시보드 데이터 조회
 * 기존 사용량 데이터 + 심층 분석 인사이트를 포함합니다.
 * 각 쿼리는 타임아웃 보호가 적용되어 느린 쿼리로 인한 페이지 행을 방지합니다.
 */
export async function getInsightsDashboardData(): Promise<InsightsDashboardData | null> {
  const session = await validateSession();
  if (!session || (session.role !== 'internal_operator' && session.role !== 'admin')) {
    return null;
  }

  try {
    // ========================================
    // 배치 1: 기존 대시보드 데이터 (7개 쿼리)
    // 커넥션 풀 고갈 방지를 위해 배치 분할
    // ========================================
    const [
      todayOverview,
      monthOverview,
      trend,
      forecast,
      topTenantRaw,
      budgetStatuses,
      anomaliesRaw,
    ] = await Promise.all([
      withTimeout(getUsageOverview('today'), QUERY_TIMEOUT_MS, DEFAULT_USAGE_OVERVIEW),
      withTimeout(
        getUsageOverview('month'),
        QUERY_TIMEOUT_MS,
        { ...DEFAULT_USAGE_OVERVIEW, period: 'month' as const }
      ),
      withTimeout(getUsageTrend(30), QUERY_TIMEOUT_MS, []),
      withTimeout(getForecast(), QUERY_TIMEOUT_MS, DEFAULT_FORECAST),
      withTimeout(getTopTenantsByUsage('month', 10), QUERY_TIMEOUT_MS, []),
      withTimeout(getAllTenantBudgetStatuses(), QUERY_TIMEOUT_MS, []),
      withTimeout(detectAnomalies(2.0), QUERY_TIMEOUT_MS, []),
    ]);

    // ========================================
    // 배치 2: 인사이트 데이터 (8개 쿼리)
    // 배치 1 완료 후 순차 실행
    // ========================================
    const [
      tokenEfficiency,
      featureDistribution,
      cacheHitTrend,
      cacheCostComparison,
      usageHeatmap,
      channelUsage,
      chunkDistribution,
      pipelineLatency,
    ] = await Promise.all([
      withTimeout(getTokenEfficiencyByModel('month'), QUERY_TIMEOUT_MS, []),
      withTimeout(getTokenUsageByFeature('month'), QUERY_TIMEOUT_MS, []),
      withTimeout(getCacheHitRateTrend(30), QUERY_TIMEOUT_MS, []),
      withTimeout(getCacheCostComparison('month'), QUERY_TIMEOUT_MS, {
        cachedRequests: 0,
        nonCachedRequests: 0,
        estimatedSavings: 0,
      }),
      withTimeout(getUsageByDayHour(30), QUERY_TIMEOUT_MS, []),
      withTimeout(getUsageByChannel(30), QUERY_TIMEOUT_MS, []),
      withTimeout(getChunkDistribution(), QUERY_TIMEOUT_MS, []),
      withTimeout(getPipelineLatency(), QUERY_TIMEOUT_MS, {
        llmAvgMs: 0,
        searchAvgMs: 0,
        rewriteAvgMs: 0,
        otherAvgMs: 0,
        totalAvgMs: 0,
      }),
    ]);

    // 테넌트 이름 조회
    const tenantIds = [
      ...new Set([
        ...topTenantRaw.map((t) => t.tenantId),
        ...anomaliesRaw.map((a) => a.tenantId),
      ]),
    ];

    const tenantNames = new Map<string, string>();
    if (tenantIds.length > 0) {
      const tenantRecords = await db
        .select({ id: tenants.id, name: tenants.name })
        .from(tenants);

      for (const t of tenantRecords) {
        tenantNames.set(t.id, t.name);
      }
    }

    return {
      // 기존 대시보드 데이터
      overview: {
        today: todayOverview,
        month: monthOverview,
      },
      trend,
      forecast,
      topTenants: topTenantRaw.map((t) => ({
        ...t,
        tenantName: tenantNames.get(t.tenantId) || 'Unknown',
      })),
      budgetStatuses,
      anomalies: anomaliesRaw.map((a) => ({
        ...a,
        tenantName: tenantNames.get(a.tenantId) || 'Unknown',
      })),
      // 새로운 인사이트 데이터
      tokenEfficiency,
      featureDistribution,
      cacheHitTrend,
      cacheCostComparison,
      usageHeatmap,
      channelUsage,
      chunkDistribution,
      pipelineLatency,
    };
  } catch (error) {
    console.error('Failed to get insights dashboard data:', error);
    return null;
  }
}
