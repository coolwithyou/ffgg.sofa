'use server';

/**
 * 성능 모니터링 Server Actions
 * 응답 시간 대시보드용 데이터 조회 및 설정 관리
 */

import {
  getPerformanceOverview,
  getResponseTimeTrend,
  getRealtimeTrend,
  getLatencyBreakdown,
  getTopSlowChatbots,
  getThreshold,
  saveThreshold,
  type ThresholdConfig,
} from '@/lib/performance/analytics';
import { checkAllResponseTimeAlerts } from '@/lib/alerts/response-time-checker';
import { db } from '@/lib/db';
import { chatbots, tenants } from '@/drizzle/schema';
import { eq } from 'drizzle-orm';

export interface PerformanceDashboardData {
  overview: {
    avgMs: number;
    p50Ms: number;
    p95Ms: number;
    p99Ms: number;
    requestCount: number;
    cacheHitRate: number;
    trend: 'up' | 'down' | 'stable';
    trendPercent: number;
  };
  trendData: Array<{
    periodStart: string;
    avgMs: number;
    p95Ms: number;
    requestCount: number;
  }>;
  realtimeTrend: Array<{
    periodStart: string;
    avgMs: number;
    p95Ms: number;
    requestCount: number;
  }>;
  breakdown: {
    llmAvgMs: number;
    searchAvgMs: number;
    rewriteAvgMs: number;
    otherAvgMs: number;
  };
  slowChatbots: Array<{
    chatbotId: string;
    chatbotName: string | null;
    tenantName: string;
    avgMs: number;
    p95Ms: number;
    requestCount: number;
  }>;
  activeAlerts: Array<{
    tenantId: string;
    tenantName: string;
    type: string;
    severity: string;
    message: string;
  }>;
}

/**
 * 성능 대시보드 전체 데이터 조회
 */
export async function getPerformanceDashboardData(
  tenantId?: string
): Promise<PerformanceDashboardData | null> {
  try {
    const [overview, trendData, realtimeTrend, breakdown, slowChatbots, alerts] = await Promise.all([
      getPerformanceOverview(tenantId),
      getResponseTimeTrend('hourly', 24, tenantId),
      getRealtimeTrend(24, tenantId),
      getLatencyBreakdown(tenantId),
      getTopSlowChatbots(10, tenantId),
      checkAllResponseTimeAlerts(),
    ]);

    // 트렌드 계산
    const trendPercent = Math.abs(overview.comparison.avgChangePercent);
    const trend: 'up' | 'down' | 'stable' =
      overview.comparison.avgChangePercent > 5
        ? 'up'
        : overview.comparison.avgChangePercent < -5
        ? 'down'
        : 'stable';

    return {
      overview: {
        avgMs: overview.current.avgMs,
        p50Ms: overview.current.p50Ms,
        p95Ms: overview.current.p95Ms,
        p99Ms: overview.current.p99Ms,
        requestCount: overview.current.requestCount,
        cacheHitRate: overview.current.cacheHitRate * 100,
        trend,
        trendPercent,
      },
      trendData: trendData.map((t) => ({
        periodStart: t.periodStart.toISOString(),
        avgMs: t.avgMs,
        p95Ms: t.p95Ms,
        requestCount: t.requestCount,
      })),
      realtimeTrend: realtimeTrend.map((t) => ({
        periodStart: t.periodStart.toISOString(),
        avgMs: t.avgMs,
        p95Ms: t.p95Ms,
        requestCount: t.requestCount,
      })),
      breakdown: {
        llmAvgMs: breakdown.llm.avgMs,
        searchAvgMs: breakdown.search.avgMs,
        rewriteAvgMs: breakdown.rewrite.avgMs,
        otherAvgMs: breakdown.other.avgMs,
      },
      slowChatbots: slowChatbots.map((c) => ({
        chatbotId: c.chatbotId,
        chatbotName: c.chatbotName,
        tenantName: c.tenantName,
        avgMs: c.avgMs,
        p95Ms: c.p95Ms,
        requestCount: c.requestCount,
      })),
      activeAlerts: alerts.map((a) => ({
        tenantId: a.tenantId,
        tenantName: a.tenantName,
        type: a.type,
        severity: a.severity,
        message: a.message,
      })),
    };
  } catch (error) {
    console.error('Failed to get performance dashboard data:', error);
    return null;
  }
}

/**
 * 챗봇별 상세 성능 데이터 조회
 */
export async function getChatbotPerformance(chatbotId: string) {
  try {
    // 챗봇 정보 조회
    const chatbot = await db
      .select({
        id: chatbots.id,
        name: chatbots.name,
        tenantId: chatbots.tenantId,
        tenantName: tenants.name,
      })
      .from(chatbots)
      .innerJoin(tenants, eq(chatbots.tenantId, tenants.id))
      .where(eq(chatbots.id, chatbotId))
      .limit(1);

    if (chatbot.length === 0) return null;

    // 성능 데이터 조회
    const overview = await getPerformanceOverview(chatbot[0].tenantId, chatbotId);
    const trend = await getResponseTimeTrend('hourly', 24, chatbot[0].tenantId, chatbotId);
    const breakdown = await getLatencyBreakdown(chatbot[0].tenantId, chatbotId);

    return {
      chatbot: chatbot[0],
      overview,
      trend,
      breakdown,
    };
  } catch (error) {
    console.error('Failed to get chatbot performance:', error);
    return null;
  }
}

/**
 * 임계치 설정 조회
 */
export async function getThresholdSettings(tenantId?: string, chatbotId?: string) {
  return getThreshold(tenantId, chatbotId);
}

/**
 * 임계치 설정 저장
 */
export async function saveThresholdSettings(
  tenantId: string | null,
  chatbotId: string | null,
  settings: ThresholdConfig
) {
  await saveThreshold(settings, tenantId ?? undefined, chatbotId ?? undefined);
  return { success: true };
}
