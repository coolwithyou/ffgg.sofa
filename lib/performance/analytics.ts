/**
 * 응답 시간 분석 모듈
 * 대시보드 및 알림 시스템에서 사용하는 통계 조회 함수들
 */

import { db } from '@/lib/db';
import {
  responseTimeLogs,
  responseTimeStats,
  responseTimeThresholds,
  tenants,
  chatbots,
} from '@/drizzle/schema';
import { eq, and, gte, lt, desc, sql, isNull } from 'drizzle-orm';
import { logger } from '@/lib/logger';

// ============================================
// 타입 정의
// ============================================

export interface RealtimeStats {
  avgMs: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  requestCount: number;
  cacheHitRate: number;
}

export interface PerformanceOverview {
  current: RealtimeStats;
  comparison: {
    avgChangePercent: number;
    p95ChangePercent: number;
  };
}

export interface TrendDataPoint {
  periodStart: Date;
  avgMs: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  requestCount: number;
  cacheHitRate: number;
}

export interface LatencyBreakdown {
  llm: { avgMs: number; p95Ms: number };
  search: { avgMs: number; p95Ms: number };
  rewrite: { avgMs: number; p95Ms: number };
  other: { avgMs: number };
}

export interface ChatbotPerformance {
  chatbotId: string;
  chatbotName: string;
  tenantId: string;
  tenantName: string;
  avgMs: number;
  p95Ms: number;
  requestCount: number;
  cacheHitRate: number;
}

export interface ThresholdConfig {
  p95ThresholdMs: number;
  avgSpikeThreshold: number;
  alertEnabled: boolean;
  alertCooldownMinutes: number;
}

// ============================================
// 실시간 통계 조회
// ============================================

/**
 * 최근 1시간 실시간 통계 조회
 * PostgreSQL PERCENTILE_CONT 함수를 사용하여 정확한 백분위수 계산
 */
export async function getRealtimeStats(
  tenantId?: string,
  chatbotId?: string
): Promise<RealtimeStats> {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

  try {
    const conditions = [gte(responseTimeLogs.createdAt, oneHourAgo)];
    if (tenantId) conditions.push(eq(responseTimeLogs.tenantId, tenantId));
    if (chatbotId) conditions.push(eq(responseTimeLogs.chatbotId, chatbotId));

    const [result] = await db
      .select({
        avgMs: sql<number>`COALESCE(AVG(${responseTimeLogs.totalDurationMs}), 0)`,
        p50Ms: sql<number>`COALESCE(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ${responseTimeLogs.totalDurationMs}), 0)`,
        p95Ms: sql<number>`COALESCE(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY ${responseTimeLogs.totalDurationMs}), 0)`,
        p99Ms: sql<number>`COALESCE(PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY ${responseTimeLogs.totalDurationMs}), 0)`,
        requestCount: sql<number>`COUNT(*)`,
        cacheHitCount: sql<number>`COUNT(*) FILTER (WHERE ${responseTimeLogs.cacheHit} = true)`,
      })
      .from(responseTimeLogs)
      .where(and(...conditions));

    const requestCount = Number(result?.requestCount ?? 0);
    const cacheHitCount = Number(result?.cacheHitCount ?? 0);

    return {
      avgMs: Number(result?.avgMs ?? 0),
      p50Ms: Number(result?.p50Ms ?? 0),
      p95Ms: Number(result?.p95Ms ?? 0),
      p99Ms: Number(result?.p99Ms ?? 0),
      requestCount,
      cacheHitRate: requestCount > 0 ? cacheHitCount / requestCount : 0,
    };
  } catch (error) {
    logger.error('Failed to get realtime stats', error as Error);
    return {
      avgMs: 0,
      p50Ms: 0,
      p95Ms: 0,
      p99Ms: 0,
      requestCount: 0,
      cacheHitRate: 0,
    };
  }
}

/**
 * 성능 개요 조회 (현재 + 전일 비교)
 */
export async function getPerformanceOverview(
  tenantId?: string,
  chatbotId?: string
): Promise<PerformanceOverview> {
  const current = await getRealtimeStats(tenantId, chatbotId);

  // 전일 동시간대 통계
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const oneDayAgoEnd = new Date(oneDayAgo.getTime() + 60 * 60 * 1000);

  try {
    const conditions = [
      gte(responseTimeLogs.createdAt, oneDayAgo),
      lt(responseTimeLogs.createdAt, oneDayAgoEnd),
    ];
    if (tenantId) conditions.push(eq(responseTimeLogs.tenantId, tenantId));
    if (chatbotId) conditions.push(eq(responseTimeLogs.chatbotId, chatbotId));

    const [previous] = await db
      .select({
        avgMs: sql<number>`COALESCE(AVG(${responseTimeLogs.totalDurationMs}), 0)`,
        p95Ms: sql<number>`COALESCE(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY ${responseTimeLogs.totalDurationMs}), 0)`,
      })
      .from(responseTimeLogs)
      .where(and(...conditions));

    const prevAvg = Number(previous?.avgMs ?? 0);
    const prevP95 = Number(previous?.p95Ms ?? 0);

    return {
      current,
      comparison: {
        avgChangePercent: prevAvg > 0 ? ((current.avgMs - prevAvg) / prevAvg) * 100 : 0,
        p95ChangePercent: prevP95 > 0 ? ((current.p95Ms - prevP95) / prevP95) * 100 : 0,
      },
    };
  } catch (error) {
    logger.error('Failed to get performance overview', error as Error);
    return {
      current,
      comparison: { avgChangePercent: 0, p95ChangePercent: 0 },
    };
  }
}

// ============================================
// 추이 데이터 조회
// ============================================

/**
 * 응답 시간 추이 조회 (집계 테이블 사용)
 */
export async function getResponseTimeTrend(
  periodType: 'hourly' | 'daily',
  limit: number = 24,
  tenantId?: string,
  chatbotId?: string
): Promise<TrendDataPoint[]> {
  try {
    const conditions = [eq(responseTimeStats.periodType, periodType)];
    if (tenantId) conditions.push(eq(responseTimeStats.tenantId, tenantId));
    if (chatbotId) {
      conditions.push(eq(responseTimeStats.chatbotId, chatbotId));
    } else {
      // chatbotId가 없으면 전체 집계 (chatbotId IS NULL)
      conditions.push(isNull(responseTimeStats.chatbotId));
    }

    const results = await db
      .select({
        periodStart: responseTimeStats.periodStart,
        avgMs: responseTimeStats.totalAvgMs,
        p50Ms: responseTimeStats.totalP50Ms,
        p95Ms: responseTimeStats.totalP95Ms,
        p99Ms: responseTimeStats.totalP99Ms,
        requestCount: responseTimeStats.requestCount,
        cacheHitCount: responseTimeStats.cacheHitCount,
      })
      .from(responseTimeStats)
      .where(and(...conditions))
      .orderBy(desc(responseTimeStats.periodStart))
      .limit(limit);

    return results.map((r) => ({
      periodStart: r.periodStart,
      avgMs: r.avgMs ?? 0,
      p50Ms: r.p50Ms ?? 0,
      p95Ms: r.p95Ms ?? 0,
      p99Ms: r.p99Ms ?? 0,
      requestCount: r.requestCount ?? 0,
      cacheHitRate:
        (r.requestCount ?? 0) > 0 ? (r.cacheHitCount ?? 0) / (r.requestCount ?? 1) : 0,
    }));
  } catch (error) {
    logger.error('Failed to get response time trend', error as Error);
    return [];
  }
}

/**
 * 실시간 추이 조회 (원본 로그에서 직접 집계, 집계 테이블이 없을 때 사용)
 */
export async function getRealtimeTrend(
  hours: number = 24,
  tenantId?: string,
  chatbotId?: string
): Promise<TrendDataPoint[]> {
  const startTime = new Date(Date.now() - hours * 60 * 60 * 1000);

  try {
    const conditions = [gte(responseTimeLogs.createdAt, startTime)];
    if (tenantId) conditions.push(eq(responseTimeLogs.tenantId, tenantId));
    if (chatbotId) conditions.push(eq(responseTimeLogs.chatbotId, chatbotId));

    const results = await db
      .select({
        periodStart: sql<Date>`date_trunc('hour', ${responseTimeLogs.createdAt})`,
        avgMs: sql<number>`AVG(${responseTimeLogs.totalDurationMs})`,
        p50Ms: sql<number>`PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ${responseTimeLogs.totalDurationMs})`,
        p95Ms: sql<number>`PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY ${responseTimeLogs.totalDurationMs})`,
        p99Ms: sql<number>`PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY ${responseTimeLogs.totalDurationMs})`,
        requestCount: sql<number>`COUNT(*)`,
        cacheHitCount: sql<number>`COUNT(*) FILTER (WHERE ${responseTimeLogs.cacheHit} = true)`,
      })
      .from(responseTimeLogs)
      .where(and(...conditions))
      .groupBy(sql`date_trunc('hour', ${responseTimeLogs.createdAt})`)
      .orderBy(desc(sql`date_trunc('hour', ${responseTimeLogs.createdAt})`));

    return results.map((r) => ({
      periodStart: r.periodStart,
      avgMs: Number(r.avgMs ?? 0),
      p50Ms: Number(r.p50Ms ?? 0),
      p95Ms: Number(r.p95Ms ?? 0),
      p99Ms: Number(r.p99Ms ?? 0),
      requestCount: Number(r.requestCount ?? 0),
      cacheHitRate:
        Number(r.requestCount ?? 0) > 0
          ? Number(r.cacheHitCount ?? 0) / Number(r.requestCount ?? 1)
          : 0,
    }));
  } catch (error) {
    logger.error('Failed to get realtime trend', error as Error);
    return [];
  }
}

// ============================================
// 단계별 지연 분석
// ============================================

/**
 * 최근 1시간 단계별 지연 분석
 */
export async function getLatencyBreakdown(
  tenantId?: string,
  chatbotId?: string
): Promise<LatencyBreakdown> {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

  try {
    const conditions = [
      gte(responseTimeLogs.createdAt, oneHourAgo),
      eq(responseTimeLogs.cacheHit, false), // 캐시 히트 제외
    ];
    if (tenantId) conditions.push(eq(responseTimeLogs.tenantId, tenantId));
    if (chatbotId) conditions.push(eq(responseTimeLogs.chatbotId, chatbotId));

    const [result] = await db
      .select({
        llmAvgMs: sql<number>`COALESCE(AVG(${responseTimeLogs.llmDurationMs}), 0)`,
        llmP95Ms: sql<number>`COALESCE(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY ${responseTimeLogs.llmDurationMs}), 0)`,
        searchAvgMs: sql<number>`COALESCE(AVG(${responseTimeLogs.searchDurationMs}), 0)`,
        searchP95Ms: sql<number>`COALESCE(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY ${responseTimeLogs.searchDurationMs}), 0)`,
        rewriteAvgMs: sql<number>`COALESCE(AVG(${responseTimeLogs.rewriteDurationMs}), 0)`,
        rewriteP95Ms: sql<number>`COALESCE(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY ${responseTimeLogs.rewriteDurationMs}), 0)`,
        totalAvgMs: sql<number>`COALESCE(AVG(${responseTimeLogs.totalDurationMs}), 0)`,
      })
      .from(responseTimeLogs)
      .where(and(...conditions));

    const llmAvg = Number(result?.llmAvgMs ?? 0);
    const searchAvg = Number(result?.searchAvgMs ?? 0);
    const rewriteAvg = Number(result?.rewriteAvgMs ?? 0);
    const totalAvg = Number(result?.totalAvgMs ?? 0);

    return {
      llm: {
        avgMs: llmAvg,
        p95Ms: Number(result?.llmP95Ms ?? 0),
      },
      search: {
        avgMs: searchAvg,
        p95Ms: Number(result?.searchP95Ms ?? 0),
      },
      rewrite: {
        avgMs: rewriteAvg,
        p95Ms: Number(result?.rewriteP95Ms ?? 0),
      },
      other: {
        avgMs: Math.max(0, totalAvg - llmAvg - searchAvg - rewriteAvg),
      },
    };
  } catch (error) {
    logger.error('Failed to get latency breakdown', error as Error);
    return {
      llm: { avgMs: 0, p95Ms: 0 },
      search: { avgMs: 0, p95Ms: 0 },
      rewrite: { avgMs: 0, p95Ms: 0 },
      other: { avgMs: 0 },
    };
  }
}

// ============================================
// 챗봇별 성능 조회
// ============================================

/**
 * 느린 챗봇 목록 조회 (P95 기준 내림차순)
 */
export async function getTopSlowChatbots(
  limit: number = 10,
  tenantId?: string
): Promise<ChatbotPerformance[]> {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

  try {
    const conditions = [gte(responseTimeLogs.createdAt, oneHourAgo)];
    if (tenantId) conditions.push(eq(responseTimeLogs.tenantId, tenantId));

    const results = await db
      .select({
        chatbotId: responseTimeLogs.chatbotId,
        chatbotName: chatbots.name,
        tenantId: responseTimeLogs.tenantId,
        tenantName: tenants.name,
        avgMs: sql<number>`AVG(${responseTimeLogs.totalDurationMs})`,
        p95Ms: sql<number>`PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY ${responseTimeLogs.totalDurationMs})`,
        requestCount: sql<number>`COUNT(*)`,
        cacheHitCount: sql<number>`COUNT(*) FILTER (WHERE ${responseTimeLogs.cacheHit} = true)`,
      })
      .from(responseTimeLogs)
      .innerJoin(tenants, eq(responseTimeLogs.tenantId, tenants.id))
      .leftJoin(chatbots, eq(responseTimeLogs.chatbotId, chatbots.id))
      .where(and(...conditions))
      .groupBy(
        responseTimeLogs.chatbotId,
        chatbots.name,
        responseTimeLogs.tenantId,
        tenants.name
      )
      .orderBy(
        desc(
          sql`PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY ${responseTimeLogs.totalDurationMs})`
        )
      )
      .limit(limit);

    return results.map((r) => ({
      chatbotId: r.chatbotId ?? 'unknown',
      chatbotName: r.chatbotName ?? '기본 챗봇',
      tenantId: r.tenantId,
      tenantName: r.tenantName,
      avgMs: Number(r.avgMs ?? 0),
      p95Ms: Number(r.p95Ms ?? 0),
      requestCount: Number(r.requestCount ?? 0),
      cacheHitRate:
        Number(r.requestCount ?? 0) > 0
          ? Number(r.cacheHitCount ?? 0) / Number(r.requestCount ?? 1)
          : 0,
    }));
  } catch (error) {
    logger.error('Failed to get top slow chatbots', error as Error);
    return [];
  }
}

// ============================================
// 임계치 설정 조회/관리
// ============================================

/**
 * 임계치 설정 조회 (캐스케이드: 챗봇 → 테넌트 → 전역)
 */
export async function getThreshold(
  tenantId?: string,
  chatbotId?: string
): Promise<ThresholdConfig> {
  const defaultConfig: ThresholdConfig = {
    p95ThresholdMs: 3000,
    avgSpikeThreshold: 150,
    alertEnabled: true,
    alertCooldownMinutes: 60,
  };

  try {
    // 1. 챗봇별 설정 확인
    if (chatbotId && tenantId) {
      const [chatbotThreshold] = await db
        .select()
        .from(responseTimeThresholds)
        .where(
          and(
            eq(responseTimeThresholds.tenantId, tenantId),
            eq(responseTimeThresholds.chatbotId, chatbotId)
          )
        )
        .limit(1);

      if (chatbotThreshold) {
        return {
          p95ThresholdMs: chatbotThreshold.p95ThresholdMs ?? defaultConfig.p95ThresholdMs,
          avgSpikeThreshold:
            chatbotThreshold.avgSpikeThreshold ?? defaultConfig.avgSpikeThreshold,
          alertEnabled: chatbotThreshold.alertEnabled ?? defaultConfig.alertEnabled,
          alertCooldownMinutes:
            chatbotThreshold.alertCooldownMinutes ?? defaultConfig.alertCooldownMinutes,
        };
      }
    }

    // 2. 테넌트별 설정 확인
    if (tenantId) {
      const [tenantThreshold] = await db
        .select()
        .from(responseTimeThresholds)
        .where(
          and(
            eq(responseTimeThresholds.tenantId, tenantId),
            isNull(responseTimeThresholds.chatbotId)
          )
        )
        .limit(1);

      if (tenantThreshold) {
        return {
          p95ThresholdMs: tenantThreshold.p95ThresholdMs ?? defaultConfig.p95ThresholdMs,
          avgSpikeThreshold:
            tenantThreshold.avgSpikeThreshold ?? defaultConfig.avgSpikeThreshold,
          alertEnabled: tenantThreshold.alertEnabled ?? defaultConfig.alertEnabled,
          alertCooldownMinutes:
            tenantThreshold.alertCooldownMinutes ?? defaultConfig.alertCooldownMinutes,
        };
      }
    }

    // 3. 전역 설정 확인
    const [globalThreshold] = await db
      .select()
      .from(responseTimeThresholds)
      .where(
        and(
          isNull(responseTimeThresholds.tenantId),
          isNull(responseTimeThresholds.chatbotId)
        )
      )
      .limit(1);

    if (globalThreshold) {
      return {
        p95ThresholdMs: globalThreshold.p95ThresholdMs ?? defaultConfig.p95ThresholdMs,
        avgSpikeThreshold:
          globalThreshold.avgSpikeThreshold ?? defaultConfig.avgSpikeThreshold,
        alertEnabled: globalThreshold.alertEnabled ?? defaultConfig.alertEnabled,
        alertCooldownMinutes:
          globalThreshold.alertCooldownMinutes ?? defaultConfig.alertCooldownMinutes,
      };
    }

    // 4. 기본값 반환
    return defaultConfig;
  } catch (error) {
    logger.error('Failed to get threshold', error as Error);
    return defaultConfig;
  }
}

/**
 * 임계치 설정 저장/업데이트
 */
export async function saveThreshold(
  config: Partial<ThresholdConfig>,
  tenantId?: string,
  chatbotId?: string
): Promise<void> {
  try {
    const values = {
      tenantId: tenantId ?? null,
      chatbotId: chatbotId ?? null,
      p95ThresholdMs: config.p95ThresholdMs,
      avgSpikeThreshold: config.avgSpikeThreshold,
      alertEnabled: config.alertEnabled,
      alertCooldownMinutes: config.alertCooldownMinutes,
      updatedAt: new Date(),
    };

    await db
      .insert(responseTimeThresholds)
      .values(values)
      .onConflictDoUpdate({
        target: [responseTimeThresholds.tenantId, responseTimeThresholds.chatbotId],
        set: {
          ...config,
          updatedAt: new Date(),
        },
      });

    logger.info('Threshold saved', { tenantId, chatbotId, config });
  } catch (error) {
    logger.error('Failed to save threshold', error as Error);
    throw error;
  }
}
