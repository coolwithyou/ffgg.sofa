/**
 * 웹훅 로그 정리 Cron API
 * [Billing System] 매주 일요일 새벽 3시 실행 - 90일 이상 된 웹훅 로그 삭제
 *
 * PIPA(개인정보보호법) 준수:
 * - 웹훅 로그 보관 기간: 90일 (운영 목적, 최소 보관)
 * - 결제 내역(payments)은 전자금융거래법에 따라 5년 보관
 *
 * Vercel Cron 설정:
 * { "path": "/api/cron/billing/cleanup-webhook-logs", "schedule": "0 18 * * 0" }
 * (UTC 기준 일요일 18시 = KST 월요일 3시)
 */

import { NextRequest, NextResponse } from 'next/server';
import { lt } from 'drizzle-orm';
import { db } from '@/lib/db';
import { billingWebhookLogs } from '@/drizzle/schema';
import { logger } from '@/lib/logger';
import { subDays } from 'date-fns';

// Cron 보안 키 (환경변수로 설정)
const CRON_SECRET = process.env.CRON_SECRET;

// 웹훅 로그 보관 기간 (일)
const WEBHOOK_LOG_RETENTION_DAYS = 90;

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
    const threshold = subDays(new Date(), WEBHOOK_LOG_RETENTION_DAYS);

    logger.info('Webhook log cleanup started', {
      threshold: threshold.toISOString(),
      retentionDays: WEBHOOK_LOG_RETENTION_DAYS,
    });

    // 90일 이상 된 웹훅 로그 삭제
    const deleteResult = await db
      .delete(billingWebhookLogs)
      .where(lt(billingWebhookLogs.createdAt, threshold))
      .returning({ id: billingWebhookLogs.id });

    const deletedCount = deleteResult.length;
    const duration = Date.now() - startTime;

    logger.info('Webhook log cleanup completed', {
      deletedCount,
      duration,
    });

    return NextResponse.json({
      success: true,
      deletedCount,
      retentionDays: WEBHOOK_LOG_RETENTION_DAYS,
      duration,
    });
  } catch (error) {
    logger.error('Webhook log cleanup failed', error as Error);

    return NextResponse.json(
      { error: 'Cleanup failed', message: (error as Error).message },
      { status: 500 }
    );
  }
}

// POST도 지원 (외부 스케줄러용)
export async function POST(request: NextRequest) {
  return GET(request);
}
