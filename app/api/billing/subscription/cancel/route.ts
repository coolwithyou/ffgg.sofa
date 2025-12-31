/**
 * 구독 취소 API
 * [Billing System] 현재 구독을 취소 처리
 *
 * POST /api/billing/subscription/cancel
 *
 * @body { reason?, immediate? }
 * - immediate: true면 즉시 취소, false면 기간 종료 시 취소 (기본)
 * @returns 업데이트된 구독 정보
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { eq, and } from 'drizzle-orm';
import { db } from '@/lib/db';
import { subscriptions, tenants, plans } from '@/drizzle/schema';
import { validateSession } from '@/lib/auth/session';
import { deleteBillingKey } from '@/lib/portone/client';
import { decryptBillingKey, maskBillingKey } from '@/lib/billing/encryption';
import { logger } from '@/lib/logger';

// 요청 스키마
const cancelSubscriptionSchema = z.object({
  reason: z.string().max(500).optional(),
  immediate: z.boolean().optional().default(false),
});

export async function POST(request: NextRequest) {
  try {
    // 1. 세션 검증
    const session = await validateSession();
    if (!session) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 });
    }

    const { tenantId } = session;

    // 2. 요청 본문 파싱
    const body = await request.json();
    const parseResult = cancelSubscriptionSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: '입력값이 올바르지 않습니다', details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const { reason, immediate } = parseResult.data;

    // 3. 현재 활성 구독 조회
    const [existingSubscription] = await db
      .select()
      .from(subscriptions)
      .where(
        and(eq(subscriptions.tenantId, tenantId), eq(subscriptions.status, 'active'))
      )
      .limit(1);

    if (!existingSubscription) {
      return NextResponse.json(
        { error: '활성 구독이 없습니다' },
        { status: 404 }
      );
    }

    const now = new Date();

    // 4. 즉시 취소 처리
    if (immediate) {
      // PortOne에서 빌링키 삭제
      if (existingSubscription.billingKey) {
        try {
          const decryptedBillingKey = decryptBillingKey(
            existingSubscription.billingKey
          );
          await deleteBillingKey(decryptedBillingKey);
        } catch (deleteError) {
          logger.error(
            'Failed to delete billing key from PortOne',
            deleteError instanceof Error ? deleteError : undefined,
            {
              tenantId,
              subscriptionId: existingSubscription.id,
              billingKey: existingSubscription.billingKey
                ? maskBillingKey(existingSubscription.billingKey)
                : null,
            }
          );
          // 빌링키 삭제 실패해도 취소 처리는 진행
        }
      }

      // 구독 상태를 cancelled로 변경
      const [cancelledSubscription] = await db
        .update(subscriptions)
        .set({
          status: 'cancelled',
          cancelledAt: now,
          cancelReason: reason || '사용자 요청',
          billingKey: null, // 빌링키 삭제
          nextPaymentDate: null,
          updatedAt: now,
        })
        .where(eq(subscriptions.id, existingSubscription.id))
        .returning();

      // 테넌트 티어를 basic으로 변경
      await db
        .update(tenants)
        .set({
          tier: 'basic',
          updatedAt: now,
        })
        .where(eq(tenants.id, tenantId));

      logger.info('Subscription cancelled immediately', {
        tenantId,
        subscriptionId: existingSubscription.id,
        reason,
      });

      return NextResponse.json({
        message: '구독이 취소되었습니다',
        subscription: {
          id: cancelledSubscription.id,
          status: cancelledSubscription.status,
          cancelledAt: cancelledSubscription.cancelledAt,
          cancelReason: cancelledSubscription.cancelReason,
        },
      });
    }

    // 5. 기간 종료 시 취소 예약
    const [scheduledCancelSubscription] = await db
      .update(subscriptions)
      .set({
        cancelAtPeriodEnd: true,
        cancelReason: reason || '사용자 요청',
        updatedAt: now,
      })
      .where(eq(subscriptions.id, existingSubscription.id))
      .returning();

    logger.info('Subscription cancellation scheduled', {
      tenantId,
      subscriptionId: existingSubscription.id,
      cancelAt: existingSubscription.currentPeriodEnd,
      reason,
    });

    return NextResponse.json({
      message: `구독이 ${existingSubscription.currentPeriodEnd?.toLocaleDateString('ko-KR')}에 취소될 예정입니다`,
      subscription: {
        id: scheduledCancelSubscription.id,
        status: scheduledCancelSubscription.status,
        cancelAtPeriodEnd: scheduledCancelSubscription.cancelAtPeriodEnd,
        cancelReason: scheduledCancelSubscription.cancelReason,
        currentPeriodEnd: scheduledCancelSubscription.currentPeriodEnd,
      },
    });
  } catch (error) {
    console.error('Subscription cancel error:', error);
    return NextResponse.json(
      { error: '구독 취소 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
