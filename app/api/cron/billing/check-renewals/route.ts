/**
 * 정기결제 체크 Cron API
 * [Billing System] 매일 오전 9시 실행 - 다음 날 결제 예정인 구독에 대해 결제 이벤트 발송
 *
 * Vercel Cron 설정:
 * { "path": "/api/cron/billing/check-renewals", "schedule": "0 0 * * *" }
 * (UTC 기준 0시 = KST 9시)
 */

import { NextRequest, NextResponse } from 'next/server';
import { eq, and, lte, isNotNull } from 'drizzle-orm';
import { db } from '@/lib/db';
import { subscriptions } from '@/drizzle/schema';
import { inngest } from '@/inngest/client';
import { logger } from '@/lib/logger';
import { addDays } from 'date-fns';

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
    const now = new Date();
    const tomorrow = addDays(now, 1);

    // 내일까지 결제 예정인 활성 구독 조회
    // - status: 'active' 또는 'past_due' (재시도 중인 것도 포함)
    // - nextPaymentDate가 내일 이전
    // - billingKey가 있는 구독만
    const dueSubscriptions = await db
      .select({
        id: subscriptions.id,
        tenantId: subscriptions.tenantId,
        planId: subscriptions.planId,
        nextPaymentDate: subscriptions.nextPaymentDate,
      })
      .from(subscriptions)
      .where(
        and(
          lte(subscriptions.nextPaymentDate, tomorrow),
          isNotNull(subscriptions.billingKey),
          // active 또는 past_due 상태만
          // past_due는 이미 재시도 중이므로 여기서는 active만 처리
          eq(subscriptions.status, 'active')
        )
      );

    logger.info('Billing renewal check started', {
      checkDate: now.toISOString(),
      foundSubscriptions: dueSubscriptions.length,
    });

    // 각 구독에 대해 결제 요청 이벤트 발송
    const results = {
      processed: 0,
      sent: 0,
      errors: 0,
    };

    for (const subscription of dueSubscriptions) {
      results.processed++;

      try {
        await inngest.send({
          name: 'billing/payment.requested',
          data: {
            subscriptionId: subscription.id,
            tenantId: subscription.tenantId,
            attempt: 1,
          },
        });

        results.sent++;

        logger.info('Payment request event sent', {
          subscriptionId: subscription.id,
          tenantId: subscription.tenantId,
          nextPaymentDate: subscription.nextPaymentDate,
        });
      } catch (error) {
        results.errors++;
        logger.error(
          'Failed to send payment request event',
          error instanceof Error ? error : undefined,
          {
            subscriptionId: subscription.id,
            tenantId: subscription.tenantId,
          }
        );
      }
    }

    const duration = Date.now() - startTime;

    logger.info('Billing renewal check completed', {
      ...results,
      duration,
    });

    return NextResponse.json({
      success: true,
      ...results,
      duration,
    });
  } catch (error) {
    logger.error('Billing renewal check failed', error as Error);

    return NextResponse.json(
      { error: 'Renewal check failed', message: (error as Error).message },
      { status: 500 }
    );
  }
}

// POST도 지원 (외부 스케줄러용)
export async function POST(request: NextRequest) {
  return GET(request);
}
