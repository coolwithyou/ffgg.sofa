/**
 * 구독 조회 API
 * [Billing System] 현재 테넌트의 구독 정보 반환
 *
 * GET /api/billing/subscription
 *
 * @returns 현재 구독 정보 (플랜 포함)
 */

import { NextRequest, NextResponse } from 'next/server';
import { eq, and, desc } from 'drizzle-orm';
import { db } from '@/lib/db';
import { subscriptions, plans, payments } from '@/drizzle/schema';
import { validateSession } from '@/lib/auth/session';

export async function GET(request: NextRequest) {
  try {
    // 1. 세션 검증
    const session = await validateSession();
    if (!session) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 });
    }

    const { tenantId } = session;

    // 2. URL 파라미터 파싱
    const { searchParams } = new URL(request.url);
    const includePayments = searchParams.get('includePayments') === 'true';
    const paymentLimit = parseInt(searchParams.get('paymentLimit') || '5', 10);

    // 3. 현재 활성 구독 조회 (플랜 정보 포함)
    const [subscription] = await db
      .select({
        id: subscriptions.id,
        planId: subscriptions.planId,
        status: subscriptions.status,
        billingCycle: subscriptions.billingCycle,
        billingKey: subscriptions.billingKey,
        currentPeriodStart: subscriptions.currentPeriodStart,
        currentPeriodEnd: subscriptions.currentPeriodEnd,
        nextPaymentDate: subscriptions.nextPaymentDate,
        cancelledAt: subscriptions.cancelledAt,
        cancelReason: subscriptions.cancelReason,
        cancelAtPeriodEnd: subscriptions.cancelAtPeriodEnd,
        createdAt: subscriptions.createdAt,
        // 플랜 정보
        plan: {
          id: plans.id,
          name: plans.name,
          nameKo: plans.nameKo,
          monthlyPrice: plans.monthlyPrice,
          yearlyPrice: plans.yearlyPrice,
          features: plans.features,
          limits: plans.limits,
        },
      })
      .from(subscriptions)
      .innerJoin(plans, eq(subscriptions.planId, plans.id))
      .where(eq(subscriptions.tenantId, tenantId))
      .orderBy(desc(subscriptions.createdAt))
      .limit(1);

    // 4. 구독이 없으면 기본 플랜 정보 반환
    if (!subscription) {
      const [basicPlan] = await db
        .select()
        .from(plans)
        .where(eq(plans.id, 'basic'))
        .limit(1);

      return NextResponse.json({
        subscription: null,
        currentPlan: basicPlan || {
          id: 'basic',
          name: 'Basic',
          nameKo: '베이직',
          monthlyPrice: 0,
          yearlyPrice: 0,
          features: [],
          limits: null,
        },
      });
    }

    // 5. 결제 내역 조회 (옵션)
    let recentPayments = null;
    if (includePayments) {
      recentPayments = await db
        .select({
          id: payments.id,
          paymentId: payments.paymentId,
          amount: payments.amount,
          currency: payments.currency,
          status: payments.status,
          payMethod: payments.payMethod,
          paidAt: payments.paidAt,
          createdAt: payments.createdAt,
        })
        .from(payments)
        .where(eq(payments.subscriptionId, subscription.id))
        .orderBy(desc(payments.createdAt))
        .limit(paymentLimit);
    }

    // 6. 다음 결제 금액 계산
    const nextPaymentAmount =
      subscription.billingCycle === 'yearly'
        ? subscription.plan.yearlyPrice
        : subscription.plan.monthlyPrice;

    return NextResponse.json({
      subscription: {
        id: subscription.id,
        planId: subscription.planId,
        status: subscription.status,
        billingCycle: subscription.billingCycle,
        hasBillingKey: !!subscription.billingKey,
        currentPeriodStart: subscription.currentPeriodStart,
        currentPeriodEnd: subscription.currentPeriodEnd,
        nextPaymentDate: subscription.nextPaymentDate,
        nextPaymentAmount,
        cancelledAt: subscription.cancelledAt,
        cancelReason: subscription.cancelReason,
        cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
        createdAt: subscription.createdAt,
      },
      currentPlan: subscription.plan,
      recentPayments,
    });
  } catch (error) {
    console.error('Subscription fetch error:', error);
    return NextResponse.json(
      { error: '구독 정보 조회 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
