/**
 * 응답 시간 집계 Cron API
 * 매시 5분에 실행되어 이전 시간의 통계를 집계합니다.
 *
 * Vercel Cron 설정 예시 (vercel.json):
 * { "path": "/api/cron/aggregate-response-time", "schedule": "5 * * * *" }
 */

import { NextRequest, NextResponse } from 'next/server';
import { aggregateHourlyStats, cleanupOldLogs } from '@/lib/performance/aggregator';
import { logger } from '@/lib/logger';

// Cron 보안 키 (환경변수로 설정)
const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(request: NextRequest) {
  try {
    // Vercel Cron 또는 Authorization 헤더로 인증
    const authHeader = request.headers.get('authorization');
    const cronHeader = request.headers.get('x-vercel-cron');

    if (CRON_SECRET && !cronHeader) {
      if (authHeader !== `Bearer ${CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    const startTime = Date.now();

    // 이전 시간 집계 (aggregateHourlyStats가 내부적으로 이전 시간을 계산)
    const result = await aggregateHourlyStats();

    // 7일 이상 된 개별 로그 정리
    const deletedLogs = await cleanupOldLogs(7);

    const duration = Date.now() - startTime;

    logger.info('Response time aggregation cron completed', {
      processed: result.processed,
      errors: result.errors,
      deletedLogs,
      duration,
    });

    return NextResponse.json({
      success: true,
      processed: result.processed,
      errors: result.errors,
      deletedLogs,
      duration,
    });
  } catch (error) {
    logger.error('Response time aggregation cron failed', error as Error);

    return NextResponse.json(
      { error: 'Aggregation failed', message: (error as Error).message },
      { status: 500 }
    );
  }
}

// POST도 지원 (외부 스케줄러용)
export async function POST(request: NextRequest) {
  return GET(request);
}
