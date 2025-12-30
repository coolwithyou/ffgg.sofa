/**
 * 응답 시간 알림 체크 모듈
 * P95 임계치 초과 및 응답 시간 급증을 감지합니다.
 */

import { db } from '@/lib/db';
import { responseTimeLogs, responseTimeThresholds, tenants, chatbots } from '@/drizzle/schema';
import { eq, sql, gte, and, isNull, desc, or } from 'drizzle-orm';
import { logger } from '@/lib/logger';
import type { ResponseTimeP95Alert, ResponseTimeSpikeAlert } from './types';
import { ALERT_SEVERITY_MAP, ALERT_MESSAGES } from './types';

/**
 * 기본 임계치 설정
 */
const DEFAULT_P95_THRESHOLD_MS = 3000; // 3초
const DEFAULT_SPIKE_THRESHOLD_PERCENT = 150; // 150% (1.5배)
const DEFAULT_ALERT_COOLDOWN_MINUTES = 60;

/**
 * 임계치 설정 조회 (캐스케이드: 챗봇 → 테넌트 → 전역)
 */
export async function getThreshold(
  tenantId: string,
  chatbotId?: string
): Promise<{
  p95ThresholdMs: number;
  avgSpikeThreshold: number;
  alertEnabled: boolean;
  alertCooldownMinutes: number;
}> {
  try {
    // 1. 챗봇별 설정 조회
    if (chatbotId) {
      const chatbotThreshold = await db
        .select()
        .from(responseTimeThresholds)
        .where(
          and(
            eq(responseTimeThresholds.tenantId, tenantId),
            eq(responseTimeThresholds.chatbotId, chatbotId)
          )
        )
        .limit(1);

      if (chatbotThreshold.length > 0) {
        const t = chatbotThreshold[0];
        return {
          p95ThresholdMs: t.p95ThresholdMs ?? DEFAULT_P95_THRESHOLD_MS,
          avgSpikeThreshold: t.avgSpikeThreshold ?? DEFAULT_SPIKE_THRESHOLD_PERCENT,
          alertEnabled: t.alertEnabled ?? true,
          alertCooldownMinutes: t.alertCooldownMinutes ?? DEFAULT_ALERT_COOLDOWN_MINUTES,
        };
      }
    }

    // 2. 테넌트별 설정 조회
    const tenantThreshold = await db
      .select()
      .from(responseTimeThresholds)
      .where(
        and(
          eq(responseTimeThresholds.tenantId, tenantId),
          isNull(responseTimeThresholds.chatbotId)
        )
      )
      .limit(1);

    if (tenantThreshold.length > 0) {
      const t = tenantThreshold[0];
      return {
        p95ThresholdMs: t.p95ThresholdMs ?? DEFAULT_P95_THRESHOLD_MS,
        avgSpikeThreshold: t.avgSpikeThreshold ?? DEFAULT_SPIKE_THRESHOLD_PERCENT,
        alertEnabled: t.alertEnabled ?? true,
        alertCooldownMinutes: t.alertCooldownMinutes ?? DEFAULT_ALERT_COOLDOWN_MINUTES,
      };
    }

    // 3. 전역 설정 조회
    const globalThreshold = await db
      .select()
      .from(responseTimeThresholds)
      .where(
        and(
          isNull(responseTimeThresholds.tenantId),
          isNull(responseTimeThresholds.chatbotId)
        )
      )
      .limit(1);

    if (globalThreshold.length > 0) {
      const t = globalThreshold[0];
      return {
        p95ThresholdMs: t.p95ThresholdMs ?? DEFAULT_P95_THRESHOLD_MS,
        avgSpikeThreshold: t.avgSpikeThreshold ?? DEFAULT_SPIKE_THRESHOLD_PERCENT,
        alertEnabled: t.alertEnabled ?? true,
        alertCooldownMinutes: t.alertCooldownMinutes ?? DEFAULT_ALERT_COOLDOWN_MINUTES,
      };
    }

    // 4. 기본값 반환
    return {
      p95ThresholdMs: DEFAULT_P95_THRESHOLD_MS,
      avgSpikeThreshold: DEFAULT_SPIKE_THRESHOLD_PERCENT,
      alertEnabled: true,
      alertCooldownMinutes: DEFAULT_ALERT_COOLDOWN_MINUTES,
    };
  } catch (error) {
    logger.error('Failed to get threshold', error as Error, { tenantId, chatbotId });
    return {
      p95ThresholdMs: DEFAULT_P95_THRESHOLD_MS,
      avgSpikeThreshold: DEFAULT_SPIKE_THRESHOLD_PERCENT,
      alertEnabled: true,
      alertCooldownMinutes: DEFAULT_ALERT_COOLDOWN_MINUTES,
    };
  }
}

/**
 * P95 임계치 체크
 * 최근 1시간 동안의 P95 응답 시간이 임계치를 초과하는지 확인
 */
export async function checkP95Thresholds(): Promise<ResponseTimeP95Alert[]> {
  const alerts: ResponseTimeP95Alert[] = [];

  try {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    // 테넌트별/챗봇별 P95 계산
    const p95Results = await db
      .select({
        tenantId: responseTimeLogs.tenantId,
        tenantName: tenants.name,
        chatbotId: responseTimeLogs.chatbotId,
        chatbotName: chatbots.name,
        p95Ms: sql<number>`PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY ${responseTimeLogs.totalDurationMs})`,
        requestCount: sql<number>`COUNT(*)`,
      })
      .from(responseTimeLogs)
      .innerJoin(tenants, eq(responseTimeLogs.tenantId, tenants.id))
      .leftJoin(chatbots, eq(responseTimeLogs.chatbotId, chatbots.id))
      .where(
        and(
          gte(responseTimeLogs.createdAt, oneHourAgo),
          eq(responseTimeLogs.cacheHit, false) // 캐시 히트는 제외
        )
      )
      .groupBy(
        responseTimeLogs.tenantId,
        tenants.name,
        responseTimeLogs.chatbotId,
        chatbots.name
      );

    for (const result of p95Results) {
      // 최소 요청 수 체크 (10건 미만이면 스킵)
      if (Number(result.requestCount) < 10) continue;

      const threshold = await getThreshold(result.tenantId, result.chatbotId ?? undefined);

      if (!threshold.alertEnabled) continue;

      const p95Ms = Number(result.p95Ms);

      if (p95Ms > threshold.p95ThresholdMs) {
        const data = {
          chatbotName: result.chatbotName,
          p95Ms: p95Ms.toFixed(0),
          thresholdMs: threshold.p95ThresholdMs,
        };

        alerts.push({
          tenantId: result.tenantId,
          tenantName: result.tenantName,
          type: 'response_time_p95',
          severity: ALERT_SEVERITY_MAP.response_time_p95,
          threshold: threshold.p95ThresholdMs,
          actualValue: p95Ms,
          message: ALERT_MESSAGES.response_time_p95(data),
          chatbotId: result.chatbotId ?? undefined,
          chatbotName: result.chatbotName ?? undefined,
          p95Ms,
          thresholdMs: threshold.p95ThresholdMs,
          createdAt: new Date(),
        });
      }
    }

    logger.info('P95 threshold check completed', {
      checkedCount: p95Results.length,
      alertCount: alerts.length,
    });

    return alerts;
  } catch (error) {
    logger.error('Failed to check P95 thresholds', error as Error);
    return [];
  }
}

/**
 * 응답 시간 급증 감지
 * 현재 1시간 평균과 이전 1시간 평균을 비교
 */
export async function checkResponseTimeSpike(): Promise<ResponseTimeSpikeAlert[]> {
  const alerts: ResponseTimeSpikeAlert[] = [];

  try {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);

    // 현재 시간대와 이전 시간대 평균 비교
    const spikeResults = await db
      .select({
        tenantId: responseTimeLogs.tenantId,
        tenantName: tenants.name,
        chatbotId: responseTimeLogs.chatbotId,
        chatbotName: chatbots.name,
        currentAvgMs: sql<number>`AVG(${responseTimeLogs.totalDurationMs}) FILTER (WHERE ${responseTimeLogs.createdAt} >= ${oneHourAgo})`,
        previousAvgMs: sql<number>`AVG(${responseTimeLogs.totalDurationMs}) FILTER (WHERE ${responseTimeLogs.createdAt} >= ${twoHoursAgo} AND ${responseTimeLogs.createdAt} < ${oneHourAgo})`,
        currentCount: sql<number>`COUNT(*) FILTER (WHERE ${responseTimeLogs.createdAt} >= ${oneHourAgo})`,
        previousCount: sql<number>`COUNT(*) FILTER (WHERE ${responseTimeLogs.createdAt} >= ${twoHoursAgo} AND ${responseTimeLogs.createdAt} < ${oneHourAgo})`,
      })
      .from(responseTimeLogs)
      .innerJoin(tenants, eq(responseTimeLogs.tenantId, tenants.id))
      .leftJoin(chatbots, eq(responseTimeLogs.chatbotId, chatbots.id))
      .where(
        and(
          gte(responseTimeLogs.createdAt, twoHoursAgo),
          eq(responseTimeLogs.cacheHit, false) // 캐시 히트는 제외
        )
      )
      .groupBy(
        responseTimeLogs.tenantId,
        tenants.name,
        responseTimeLogs.chatbotId,
        chatbots.name
      );

    for (const result of spikeResults) {
      const currentCount = Number(result.currentCount);
      const previousCount = Number(result.previousCount);
      const currentAvgMs = Number(result.currentAvgMs);
      const previousAvgMs = Number(result.previousAvgMs);

      // 최소 요청 수 체크 (각 시간대 5건 이상)
      if (currentCount < 5 || previousCount < 5) continue;

      // 이전 평균이 너무 작으면 스킵 (100ms 미만)
      if (previousAvgMs < 100) continue;

      const threshold = await getThreshold(result.tenantId, result.chatbotId ?? undefined);

      if (!threshold.alertEnabled) continue;

      const increasePercent = ((currentAvgMs - previousAvgMs) / previousAvgMs) * 100;

      if (increasePercent >= threshold.avgSpikeThreshold - 100) {
        const data = {
          chatbotName: result.chatbotName,
          currentAvgMs: currentAvgMs.toFixed(0),
          previousAvgMs: previousAvgMs.toFixed(0),
          increasePercent: increasePercent.toFixed(0),
        };

        alerts.push({
          tenantId: result.tenantId,
          tenantName: result.tenantName,
          type: 'response_time_spike',
          severity: ALERT_SEVERITY_MAP.response_time_spike,
          threshold: threshold.avgSpikeThreshold,
          actualValue: increasePercent,
          message: ALERT_MESSAGES.response_time_spike(data),
          chatbotId: result.chatbotId ?? undefined,
          chatbotName: result.chatbotName ?? undefined,
          currentAvgMs,
          previousAvgMs,
          increasePercent,
          createdAt: new Date(),
        });
      }
    }

    logger.info('Response time spike check completed', {
      checkedCount: spikeResults.length,
      alertCount: alerts.length,
    });

    return alerts;
  } catch (error) {
    logger.error('Failed to check response time spike', error as Error);
    return [];
  }
}

/**
 * 모든 응답 시간 관련 알림 체크
 */
export async function checkAllResponseTimeAlerts(): Promise<
  (ResponseTimeP95Alert | ResponseTimeSpikeAlert)[]
> {
  const [p95Alerts, spikeAlerts] = await Promise.all([
    checkP95Thresholds(),
    checkResponseTimeSpike(),
  ]);

  return [...p95Alerts, ...spikeAlerts];
}
