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
} from '@/lib/usage/cost-calculator';
import { getAllTenantBudgetStatuses } from '@/lib/tier/budget-limits';
import type { UsageOverview, DailyUsage, Forecast, BudgetStatus } from '@/lib/usage/types';

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
