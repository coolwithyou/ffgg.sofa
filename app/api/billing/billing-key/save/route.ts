/**
 * 빌링키 저장 API
 * [Billing System] 프론트엔드에서 빌링키 발급 완료 후 호출
 *
 * POST /api/billing/billing-key/save
 *
 * @body { billingKey, planId, billingCycle }
 * @returns 생성된 구독 정보
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { eq, and } from 'drizzle-orm';
import { db } from '@/lib/db';
import { plans, subscriptions, tenants } from '@/drizzle/schema';
import { validateSession } from '@/lib/auth/session';
import { getBillingKeyInfo } from '@/lib/portone/client';
import { encryptBillingKey, maskBillingKey } from '@/lib/billing/encryption';
import { addMonths, addYears } from 'date-fns';
import { logger } from '@/lib/logger';
import { inngest } from '@/inngest/client';

// 요청 스키마
const saveBillingKeySchema = z.object({
  billingKey: z.string().min(1, '빌링키가 필요합니다'),
  planId: z.string().min(1, '플랜 ID가 필요합니다'),
  billingCycle: z.enum(['monthly', 'yearly'], {
    errorMap: () => ({ message: '결제 주기는 monthly 또는 yearly여야 합니다' }),
  }),
});

export async function POST(request: NextRequest) {
  try {
    // 1. 세션 검증
    const session = await validateSession();
    if (!session) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 });
    }

    const { tenantId, userId } = session;

    // 2. 요청 본문 파싱
    const body = await request.json();
    const parseResult = saveBillingKeySchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: '입력값이 올바르지 않습니다', details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const { billingKey, planId, billingCycle } = parseResult.data;

    // 3. PortOne에서 빌링키 유효성 확인
    try {
      await getBillingKeyInfo(billingKey);
    } catch (error) {
      logger.error('Billing key verification failed', {
        tenantId,
        billingKey: maskBillingKey(billingKey),
        error,
      });
      return NextResponse.json(
        { error: '유효하지 않은 빌링키입니다' },
        { status: 400 }
      );
    }

    // 4. 플랜 조회
    const [plan] = await db
      .select()
      .from(plans)
      .where(and(eq(plans.id, planId), eq(plans.isActive, true)))
      .limit(1);

    if (!plan) {
      return NextResponse.json({ error: '유효하지 않은 플랜입니다' }, { status: 400 });
    }

    // 5. 기존 활성 구독 확인
    const [existingSubscription] = await db
      .select()
      .from(subscriptions)
      .where(
        and(eq(subscriptions.tenantId, tenantId), eq(subscriptions.status, 'active'))
      )
      .limit(1);

    // 6. 빌링키 암호화
    const encryptedBillingKey = encryptBillingKey(billingKey);

    // 7. 결제 기간 계산
    const now = new Date();
    const periodEnd =
      billingCycle === 'yearly' ? addYears(now, 1) : addMonths(now, 1);
    const nextPaymentDate = periodEnd;

    // 8. 구독 생성 또는 업데이트
    let subscription;

    if (existingSubscription) {
      // 기존 구독 업데이트 (플랜 변경)
      [subscription] = await db
        .update(subscriptions)
        .set({
          planId,
          billingCycle,
          billingKey: encryptedBillingKey,
          billingKeyIssuedAt: now,
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
          nextPaymentDate,
          status: 'active',
          cancelledAt: null,
          cancelReason: null,
          cancelAtPeriodEnd: false,
          updatedAt: now,
        })
        .where(eq(subscriptions.id, existingSubscription.id))
        .returning();
    } else {
      // 새 구독 생성
      [subscription] = await db
        .insert(subscriptions)
        .values({
          tenantId,
          planId,
          billingCycle,
          billingKey: encryptedBillingKey,
          billingKeyIssuedAt: now,
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
          nextPaymentDate,
          status: 'active',
        })
        .returning();
    }

    // 9. 테넌트 티어 업데이트
    await db
      .update(tenants)
      .set({
        tier: planId,
        updatedAt: now,
      })
      .where(eq(tenants.id, tenantId));

    // 10. 유료 플랜인 경우 첫 결제 요청 이벤트 발송
    const amount =
      billingCycle === 'yearly' ? plan.yearlyPrice : plan.monthlyPrice;

    if (amount > 0) {
      await inngest.send({
        name: 'billing/payment.requested',
        data: {
          subscriptionId: subscription.id,
          tenantId,
          planId,
          amount,
          isFirstPayment: true,
        },
      });
    }

    logger.info('Subscription created/updated', {
      tenantId,
      subscriptionId: subscription.id,
      planId,
      billingCycle,
      isNew: !existingSubscription,
    });

    return NextResponse.json({
      message: '구독이 시작되었습니다',
      subscription: {
        id: subscription.id,
        planId: subscription.planId,
        billingCycle: subscription.billingCycle,
        status: subscription.status,
        currentPeriodStart: subscription.currentPeriodStart,
        currentPeriodEnd: subscription.currentPeriodEnd,
        nextPaymentDate: subscription.nextPaymentDate,
      },
    });
  } catch (error) {
    console.error('Billing key save error:', error);
    return NextResponse.json(
      { error: '빌링키 저장 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
