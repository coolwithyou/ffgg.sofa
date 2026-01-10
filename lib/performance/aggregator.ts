/**
 * 응답 시간 집계 모듈
 * Cron Job에서 호출하여 시간별/일별 통계를 집계합니다.
 */

import { db } from '@/lib/db';
import { responseTimeLogs, responseTimeStats } from '@/drizzle/schema';
import { sql, and, gte, lt, eq, isNull } from 'drizzle-orm';
import { logger } from '@/lib/logger';

/**
 * 시간별 통계 집계
 * Cron: 매 시간 5분에 실행 (5 * * * *)
 *
 * 이전 시간의 데이터를 테넌트+챗봇별로 집계하여 저장합니다.
 */
export async function aggregateHourlyStats(): Promise<{
  processed: number;
  errors: number;
}> {
  const now = new Date();
  // 이전 정시 (예: 현재 14:05이면 13:00)
  const hourStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    now.getHours() - 1
  );
  const hourEnd = new Date(hourStart.getTime() + 60 * 60 * 1000);

  logger.info('Starting hourly aggregation', {
    periodStart: hourStart.toISOString(),
    periodEnd: hourEnd.toISOString(),
  });

  let processed = 0;
  let errors = 0;

  try {
    // 테넌트+챗봇별 집계
    const stats = await db
      .select({
        tenantId: responseTimeLogs.tenantId,
        chatbotId: responseTimeLogs.chatbotId,
        requestCount: sql<number>`COUNT(*)`,
        cacheHitCount: sql<number>`COUNT(*) FILTER (WHERE ${responseTimeLogs.cacheHit} = true)`,
        totalAvgMs: sql<number>`AVG(${responseTimeLogs.totalDurationMs})`,
        totalP50Ms: sql<number>`PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ${responseTimeLogs.totalDurationMs})`,
        totalP95Ms: sql<number>`PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY ${responseTimeLogs.totalDurationMs})`,
        totalP99Ms: sql<number>`PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY ${responseTimeLogs.totalDurationMs})`,
        totalMinMs: sql<number>`MIN(${responseTimeLogs.totalDurationMs})`,
        totalMaxMs: sql<number>`MAX(${responseTimeLogs.totalDurationMs})`,
        llmAvgMs: sql<number>`AVG(${responseTimeLogs.llmDurationMs})`,
        llmP95Ms: sql<number>`PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY ${responseTimeLogs.llmDurationMs})`,
        searchAvgMs: sql<number>`AVG(${responseTimeLogs.searchDurationMs})`,
        searchP95Ms: sql<number>`PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY ${responseTimeLogs.searchDurationMs})`,
      })
      .from(responseTimeLogs)
      .where(
        and(
          gte(responseTimeLogs.createdAt, hourStart),
          lt(responseTimeLogs.createdAt, hourEnd)
        )
      )
      .groupBy(responseTimeLogs.tenantId, responseTimeLogs.chatbotId);

    // 각 집계 결과를 upsert
    for (const stat of stats) {
      try {
        await db
          .insert(responseTimeStats)
          .values({
            tenantId: stat.tenantId,
            chatbotId: stat.chatbotId,
            periodType: 'hourly',
            periodStart: hourStart,
            requestCount: Number(stat.requestCount),
            cacheHitCount: Number(stat.cacheHitCount),
            totalAvgMs: stat.totalAvgMs,
            totalP50Ms: stat.totalP50Ms,
            totalP95Ms: stat.totalP95Ms,
            totalP99Ms: stat.totalP99Ms,
            totalMinMs: stat.totalMinMs ? Number(stat.totalMinMs) : null,
            totalMaxMs: stat.totalMaxMs ? Number(stat.totalMaxMs) : null,
            llmAvgMs: stat.llmAvgMs,
            llmP95Ms: stat.llmP95Ms,
            searchAvgMs: stat.searchAvgMs,
            searchP95Ms: stat.searchP95Ms,
          })
          .onConflictDoUpdate({
            target: [
              responseTimeStats.tenantId,
              responseTimeStats.chatbotId,
              responseTimeStats.periodType,
              responseTimeStats.periodStart,
            ],
            set: {
              requestCount: Number(stat.requestCount),
              cacheHitCount: Number(stat.cacheHitCount),
              totalAvgMs: stat.totalAvgMs,
              totalP50Ms: stat.totalP50Ms,
              totalP95Ms: stat.totalP95Ms,
              totalP99Ms: stat.totalP99Ms,
              totalMinMs: stat.totalMinMs ? Number(stat.totalMinMs) : null,
              totalMaxMs: stat.totalMaxMs ? Number(stat.totalMaxMs) : null,
              llmAvgMs: stat.llmAvgMs,
              llmP95Ms: stat.llmP95Ms,
              searchAvgMs: stat.searchAvgMs,
              searchP95Ms: stat.searchP95Ms,
              updatedAt: new Date(),
            },
          });

        processed++;
      } catch (error) {
        logger.error('Failed to save hourly stat', error as Error, {
          tenantId: stat.tenantId,
          chatbotId: stat.chatbotId,
        });
        errors++;
      }
    }

    // 테넌트별 전체 집계 (chatbotId = NULL)
    const tenantStats = await db
      .select({
        tenantId: responseTimeLogs.tenantId,
        requestCount: sql<number>`COUNT(*)`,
        cacheHitCount: sql<number>`COUNT(*) FILTER (WHERE ${responseTimeLogs.cacheHit} = true)`,
        totalAvgMs: sql<number>`AVG(${responseTimeLogs.totalDurationMs})`,
        totalP50Ms: sql<number>`PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ${responseTimeLogs.totalDurationMs})`,
        totalP95Ms: sql<number>`PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY ${responseTimeLogs.totalDurationMs})`,
        totalP99Ms: sql<number>`PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY ${responseTimeLogs.totalDurationMs})`,
        totalMinMs: sql<number>`MIN(${responseTimeLogs.totalDurationMs})`,
        totalMaxMs: sql<number>`MAX(${responseTimeLogs.totalDurationMs})`,
        llmAvgMs: sql<number>`AVG(${responseTimeLogs.llmDurationMs})`,
        llmP95Ms: sql<number>`PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY ${responseTimeLogs.llmDurationMs})`,
        searchAvgMs: sql<number>`AVG(${responseTimeLogs.searchDurationMs})`,
        searchP95Ms: sql<number>`PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY ${responseTimeLogs.searchDurationMs})`,
      })
      .from(responseTimeLogs)
      .where(
        and(
          gte(responseTimeLogs.createdAt, hourStart),
          lt(responseTimeLogs.createdAt, hourEnd)
        )
      )
      .groupBy(responseTimeLogs.tenantId);

    for (const stat of tenantStats) {
      try {
        await db
          .insert(responseTimeStats)
          .values({
            tenantId: stat.tenantId,
            chatbotId: null, // 테넌트 전체 집계
            periodType: 'hourly',
            periodStart: hourStart,
            requestCount: Number(stat.requestCount),
            cacheHitCount: Number(stat.cacheHitCount),
            totalAvgMs: stat.totalAvgMs,
            totalP50Ms: stat.totalP50Ms,
            totalP95Ms: stat.totalP95Ms,
            totalP99Ms: stat.totalP99Ms,
            totalMinMs: stat.totalMinMs ? Number(stat.totalMinMs) : null,
            totalMaxMs: stat.totalMaxMs ? Number(stat.totalMaxMs) : null,
            llmAvgMs: stat.llmAvgMs,
            llmP95Ms: stat.llmP95Ms,
            searchAvgMs: stat.searchAvgMs,
            searchP95Ms: stat.searchP95Ms,
          })
          .onConflictDoUpdate({
            target: [
              responseTimeStats.tenantId,
              responseTimeStats.chatbotId,
              responseTimeStats.periodType,
              responseTimeStats.periodStart,
            ],
            set: {
              requestCount: Number(stat.requestCount),
              cacheHitCount: Number(stat.cacheHitCount),
              totalAvgMs: stat.totalAvgMs,
              totalP50Ms: stat.totalP50Ms,
              totalP95Ms: stat.totalP95Ms,
              totalP99Ms: stat.totalP99Ms,
              totalMinMs: stat.totalMinMs ? Number(stat.totalMinMs) : null,
              totalMaxMs: stat.totalMaxMs ? Number(stat.totalMaxMs) : null,
              llmAvgMs: stat.llmAvgMs,
              llmP95Ms: stat.llmP95Ms,
              searchAvgMs: stat.searchAvgMs,
              searchP95Ms: stat.searchP95Ms,
              updatedAt: new Date(),
            },
          });

        processed++;
      } catch (error) {
        logger.error('Failed to save tenant hourly stat', error as Error, {
          tenantId: stat.tenantId,
        });
        errors++;
      }
    }

    logger.info('Hourly aggregation completed', {
      processed,
      errors,
      periodStart: hourStart.toISOString(),
    });

    return { processed, errors };
  } catch (error) {
    logger.error('Hourly aggregation failed', error as Error);
    throw error;
  }
}

/**
 * 일별 통계 집계
 * Cron: 매일 새벽 1시 실행 (0 1 * * *)
 *
 * 이전 날의 시간별 통계를 합산하여 일별 통계를 생성합니다.
 */
export async function aggregateDailyStats(): Promise<{
  processed: number;
  errors: number;
}> {
  const now = new Date();
  // 어제 0시 ~ 24시
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

  logger.info('Starting daily aggregation', {
    periodStart: dayStart.toISOString(),
    periodEnd: dayEnd.toISOString(),
  });

  let processed = 0;
  let errors = 0;

  try {
    // 원본 로그에서 직접 일별 집계 (시간별 집계를 합산하는 것보다 정확)
    const stats = await db
      .select({
        tenantId: responseTimeLogs.tenantId,
        chatbotId: responseTimeLogs.chatbotId,
        requestCount: sql<number>`COUNT(*)`,
        cacheHitCount: sql<number>`COUNT(*) FILTER (WHERE ${responseTimeLogs.cacheHit} = true)`,
        totalAvgMs: sql<number>`AVG(${responseTimeLogs.totalDurationMs})`,
        totalP50Ms: sql<number>`PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ${responseTimeLogs.totalDurationMs})`,
        totalP95Ms: sql<number>`PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY ${responseTimeLogs.totalDurationMs})`,
        totalP99Ms: sql<number>`PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY ${responseTimeLogs.totalDurationMs})`,
        totalMinMs: sql<number>`MIN(${responseTimeLogs.totalDurationMs})`,
        totalMaxMs: sql<number>`MAX(${responseTimeLogs.totalDurationMs})`,
        llmAvgMs: sql<number>`AVG(${responseTimeLogs.llmDurationMs})`,
        llmP95Ms: sql<number>`PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY ${responseTimeLogs.llmDurationMs})`,
        searchAvgMs: sql<number>`AVG(${responseTimeLogs.searchDurationMs})`,
        searchP95Ms: sql<number>`PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY ${responseTimeLogs.searchDurationMs})`,
      })
      .from(responseTimeLogs)
      .where(
        and(
          gte(responseTimeLogs.createdAt, dayStart),
          lt(responseTimeLogs.createdAt, dayEnd)
        )
      )
      .groupBy(responseTimeLogs.tenantId, responseTimeLogs.chatbotId);

    for (const stat of stats) {
      try {
        await db
          .insert(responseTimeStats)
          .values({
            tenantId: stat.tenantId,
            chatbotId: stat.chatbotId,
            periodType: 'daily',
            periodStart: dayStart,
            requestCount: Number(stat.requestCount),
            cacheHitCount: Number(stat.cacheHitCount),
            totalAvgMs: stat.totalAvgMs,
            totalP50Ms: stat.totalP50Ms,
            totalP95Ms: stat.totalP95Ms,
            totalP99Ms: stat.totalP99Ms,
            totalMinMs: stat.totalMinMs ? Number(stat.totalMinMs) : null,
            totalMaxMs: stat.totalMaxMs ? Number(stat.totalMaxMs) : null,
            llmAvgMs: stat.llmAvgMs,
            llmP95Ms: stat.llmP95Ms,
            searchAvgMs: stat.searchAvgMs,
            searchP95Ms: stat.searchP95Ms,
          })
          .onConflictDoUpdate({
            target: [
              responseTimeStats.tenantId,
              responseTimeStats.chatbotId,
              responseTimeStats.periodType,
              responseTimeStats.periodStart,
            ],
            set: {
              requestCount: Number(stat.requestCount),
              cacheHitCount: Number(stat.cacheHitCount),
              totalAvgMs: stat.totalAvgMs,
              totalP50Ms: stat.totalP50Ms,
              totalP95Ms: stat.totalP95Ms,
              totalP99Ms: stat.totalP99Ms,
              totalMinMs: stat.totalMinMs ? Number(stat.totalMinMs) : null,
              totalMaxMs: stat.totalMaxMs ? Number(stat.totalMaxMs) : null,
              llmAvgMs: stat.llmAvgMs,
              llmP95Ms: stat.llmP95Ms,
              searchAvgMs: stat.searchAvgMs,
              searchP95Ms: stat.searchP95Ms,
              updatedAt: new Date(),
            },
          });

        processed++;
      } catch (error) {
        logger.error('Failed to save daily stat', error as Error, {
          tenantId: stat.tenantId,
          chatbotId: stat.chatbotId,
        });
        errors++;
      }
    }

    // 테넌트별 전체 일별 집계
    const tenantStats = await db
      .select({
        tenantId: responseTimeLogs.tenantId,
        requestCount: sql<number>`COUNT(*)`,
        cacheHitCount: sql<number>`COUNT(*) FILTER (WHERE ${responseTimeLogs.cacheHit} = true)`,
        totalAvgMs: sql<number>`AVG(${responseTimeLogs.totalDurationMs})`,
        totalP50Ms: sql<number>`PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ${responseTimeLogs.totalDurationMs})`,
        totalP95Ms: sql<number>`PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY ${responseTimeLogs.totalDurationMs})`,
        totalP99Ms: sql<number>`PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY ${responseTimeLogs.totalDurationMs})`,
        totalMinMs: sql<number>`MIN(${responseTimeLogs.totalDurationMs})`,
        totalMaxMs: sql<number>`MAX(${responseTimeLogs.totalDurationMs})`,
        llmAvgMs: sql<number>`AVG(${responseTimeLogs.llmDurationMs})`,
        llmP95Ms: sql<number>`PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY ${responseTimeLogs.llmDurationMs})`,
        searchAvgMs: sql<number>`AVG(${responseTimeLogs.searchDurationMs})`,
        searchP95Ms: sql<number>`PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY ${responseTimeLogs.searchDurationMs})`,
      })
      .from(responseTimeLogs)
      .where(
        and(
          gte(responseTimeLogs.createdAt, dayStart),
          lt(responseTimeLogs.createdAt, dayEnd)
        )
      )
      .groupBy(responseTimeLogs.tenantId);

    for (const stat of tenantStats) {
      try {
        await db
          .insert(responseTimeStats)
          .values({
            tenantId: stat.tenantId,
            chatbotId: null,
            periodType: 'daily',
            periodStart: dayStart,
            requestCount: Number(stat.requestCount),
            cacheHitCount: Number(stat.cacheHitCount),
            totalAvgMs: stat.totalAvgMs,
            totalP50Ms: stat.totalP50Ms,
            totalP95Ms: stat.totalP95Ms,
            totalP99Ms: stat.totalP99Ms,
            totalMinMs: stat.totalMinMs ? Number(stat.totalMinMs) : null,
            totalMaxMs: stat.totalMaxMs ? Number(stat.totalMaxMs) : null,
            llmAvgMs: stat.llmAvgMs,
            llmP95Ms: stat.llmP95Ms,
            searchAvgMs: stat.searchAvgMs,
            searchP95Ms: stat.searchP95Ms,
          })
          .onConflictDoUpdate({
            target: [
              responseTimeStats.tenantId,
              responseTimeStats.chatbotId,
              responseTimeStats.periodType,
              responseTimeStats.periodStart,
            ],
            set: {
              requestCount: Number(stat.requestCount),
              cacheHitCount: Number(stat.cacheHitCount),
              totalAvgMs: stat.totalAvgMs,
              totalP50Ms: stat.totalP50Ms,
              totalP95Ms: stat.totalP95Ms,
              totalP99Ms: stat.totalP99Ms,
              totalMinMs: stat.totalMinMs ? Number(stat.totalMinMs) : null,
              totalMaxMs: stat.totalMaxMs ? Number(stat.totalMaxMs) : null,
              llmAvgMs: stat.llmAvgMs,
              llmP95Ms: stat.llmP95Ms,
              searchAvgMs: stat.searchAvgMs,
              searchP95Ms: stat.searchP95Ms,
              updatedAt: new Date(),
            },
          });

        processed++;
      } catch (error) {
        logger.error('Failed to save tenant daily stat', error as Error, {
          tenantId: stat.tenantId,
        });
        errors++;
      }
    }

    logger.info('Daily aggregation completed', {
      processed,
      errors,
      periodStart: dayStart.toISOString(),
    });

    return { processed, errors };
  } catch (error) {
    logger.error('Daily aggregation failed', error as Error);
    throw error;
  }
}

/**
 * 오래된 로그 정리
 * Cron: 매일 새벽 2시 실행 (0 2 * * *)
 *
 * 기본 30일 이전의 개별 로그를 삭제합니다.
 * (집계 통계는 유지)
 */
export async function cleanupOldLogs(retentionDays: number = 30): Promise<number> {
  const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

  logger.info('Starting log cleanup', {
    retentionDays,
    cutoffDate: cutoffDate.toISOString(),
  });

  try {
    const result = await db
      .delete(responseTimeLogs)
      .where(lt(responseTimeLogs.createdAt, cutoffDate));

    const deletedCount = result.count ?? 0;

    logger.info('Log cleanup completed', {
      deletedCount,
      cutoffDate: cutoffDate.toISOString(),
    });

    return deletedCount;
  } catch (error) {
    logger.error('Log cleanup failed', error as Error);
    throw error;
  }
}
