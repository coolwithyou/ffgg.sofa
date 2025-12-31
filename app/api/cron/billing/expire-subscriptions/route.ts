/**
 * 구독 만료 처리 Cron API
 * [Billing System] 매일 오전 10시 실행 - 유예 기간 초과 구독 만료 처리
 *
 * 처리 대상:
 * 1. past_due 상태이고 유예 기간(7일) 초과한 구독
 * 2. cancelAtPeriodEnd=true이고 currentPeriodEnd가 지난 구독
 *
 * Vercel Cron 설정:
 * { "path": "/api/cron/billing/expire-subscriptions", "schedule": "0 1 * * *" }
 * (UTC 기준 1시 = KST 10시)
 */

import { NextRequest, NextResponse } from 'next/server';
import { eq, and, lte, lt, or } from 'drizzle-orm';
import { db } from '@/lib/db';
import { subscriptions } from '@/drizzle/schema';
import { inngest } from '@/inngest/client';
import { billingEnv } from '@/lib/config/billing-env';
import { logger } from '@/lib/logger';
import { subDays } from 'date-fns';

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
    const gracePeriodThreshold = subDays(now, billingEnv.billing.gracePeriodDays);

    const results = {
      processed: 0,
      expired: 0,
      cancelled: 0,
      errors: 0,
    };

    // 1. past_due 상태이고 유예 기간 초과한 구독 만료 처리
    const pastDueSubscriptions = await db
      .select({
        id: subscriptions.id,
        tenantId: subscriptions.tenantId,
        updatedAt: subscriptions.updatedAt,
      })
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.status, 'past_due'),
          // updatedAt이 유예 기간 이전인 경우 (past_due 상태가 된 지 7일 이상)
          lt(subscriptions.updatedAt, gracePeriodThreshold)
        )
      );

    logger.info('Checking past_due subscriptions for expiration', {
      found: pastDueSubscriptions.length,
      gracePeriodDays: billingEnv.billing.gracePeriodDays,
    });

    for (const subscription of pastDueSubscriptions) {
      results.processed++;

      try {
        // 구독 만료 이벤트 발송 (Inngest가 처리)
        await inngest.send({
          name: 'billing/subscription.expired',
          data: {
            subscriptionId: subscription.id,
            tenantId: subscription.tenantId,
            reason: `Payment failed after ${billingEnv.billing.gracePeriodDays} days grace period`,
          },
        });

        results.expired++;

        logger.info('Subscription expired event sent (past_due)', {
          subscriptionId: subscription.id,
          tenantId: subscription.tenantId,
        });
      } catch (error) {
        results.errors++;
        logger.error(
          'Failed to send subscription expired event',
          error instanceof Error ? error : undefined,
          {
            subscriptionId: subscription.id,
          }
        );
      }
    }

    // 2. cancelAtPeriodEnd=true이고 currentPeriodEnd가 지난 구독 취소 처리
    const cancelledAtPeriodEndSubscriptions = await db
      .select({
        id: subscriptions.id,
        tenantId: subscriptions.tenantId,
        currentPeriodEnd: subscriptions.currentPeriodEnd,
        cancelReason: subscriptions.cancelReason,
      })
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.status, 'active'),
          eq(subscriptions.cancelAtPeriodEnd, true),
          lte(subscriptions.currentPeriodEnd, now)
        )
      );

    logger.info('Checking subscriptions scheduled for cancellation', {
      found: cancelledAtPeriodEndSubscriptions.length,
    });

    for (const subscription of cancelledAtPeriodEndSubscriptions) {
      results.processed++;

      try {
        // 구독 만료 이벤트 발송 (기간 종료 취소)
        await inngest.send({
          name: 'billing/subscription.expired',
          data: {
            subscriptionId: subscription.id,
            tenantId: subscription.tenantId,
            reason: subscription.cancelReason || 'Subscription cancelled at period end',
          },
        });

        results.cancelled++;

        logger.info('Subscription expired event sent (period end cancellation)', {
          subscriptionId: subscription.id,
          tenantId: subscription.tenantId,
          periodEnd: subscription.currentPeriodEnd,
        });
      } catch (error) {
        results.errors++;
        logger.error(
          'Failed to send subscription cancelled event',
          error instanceof Error ? error : undefined,
          {
            subscriptionId: subscription.id,
          }
        );
      }
    }

    const duration = Date.now() - startTime;

    logger.info('Subscription expiration check completed', {
      ...results,
      duration,
    });

    return NextResponse.json({
      success: true,
      ...results,
      duration,
    });
  } catch (error) {
    logger.error('Subscription expiration check failed', error as Error);

    return NextResponse.json(
      { error: 'Expiration check failed', message: (error as Error).message },
      { status: 500 }
    );
  }
}

// POST도 지원 (외부 스케줄러용)
export async function POST(request: NextRequest) {
  return GET(request);
}
