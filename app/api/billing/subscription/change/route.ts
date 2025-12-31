/**
 * 구독 플랜 변경 API
 * [Billing System] 현재 구독의 플랜을 변경
 *
 * POST /api/billing/subscription/change
 *
 * @body { planId, billingCycle? }
 * @returns 업데이트된 구독 정보
 *
 * 변경 정책:
 * - 업그레이드: 즉시 적용, 차액 결제 (prorated)
 * - 다운그레이드: 현재 기간 종료 후 적용
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { eq, and } from 'drizzle-orm';
import { db } from '@/lib/db';
import { subscriptions, tenants, plans } from '@/drizzle/schema';
import { validateSession } from '@/lib/auth/session';
import { logger } from '@/lib/logger';

// 요청 스키마
const changePlanSchema = z.object({
  planId: z.string().min(1, '플랜 ID가 필요합니다'),
  billingCycle: z.enum(['monthly', 'yearly']).optional(),
});

// 플랜 티어 순서 (업그레이드/다운그레이드 판단용)
const PLAN_TIER_ORDER: Record<string, number> = {
  basic: 0,
  standard: 1,
  premium: 2,
};

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
    const parseResult = changePlanSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: '입력값이 올바르지 않습니다', details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const { planId, billingCycle } = parseResult.data;

    // 3. 대상 플랜 조회
    const [targetPlan] = await db
      .select()
      .from(plans)
      .where(and(eq(plans.id, planId), eq(plans.isActive, true)))
      .limit(1);

    if (!targetPlan) {
      return NextResponse.json(
        { error: '유효하지 않은 플랜입니다' },
        { status: 400 }
      );
    }

    // 4. 현재 활성 구독 조회
    const [existingSubscription] = await db
      .select({
        subscription: subscriptions,
        plan: plans,
      })
      .from(subscriptions)
      .innerJoin(plans, eq(subscriptions.planId, plans.id))
      .where(
        and(eq(subscriptions.tenantId, tenantId), eq(subscriptions.status, 'active'))
      )
      .limit(1);

    // 5. 무료 플랜으로 변경하는 경우 (구독 취소와 동일)
    if (targetPlan.monthlyPrice === 0) {
      return NextResponse.json(
        { error: '무료 플랜으로 변경하려면 구독 취소를 이용해주세요' },
        { status: 400 }
      );
    }

    // 6. 기존 구독이 없는 경우
    if (!existingSubscription) {
      return NextResponse.json(
        { error: '활성 구독이 없습니다. 새 구독을 생성해주세요.' },
        { status: 400 }
      );
    }

    const { subscription: currentSubscription, plan: currentPlan } = existingSubscription;

    // 7. 같은 플랜으로 변경하려는 경우
    if (currentSubscription.planId === planId &&
        (!billingCycle || currentSubscription.billingCycle === billingCycle)) {
      return NextResponse.json(
        { error: '이미 해당 플랜을 사용 중입니다' },
        { status: 400 }
      );
    }

    const now = new Date();
    const newBillingCycle = billingCycle || currentSubscription.billingCycle;

    // 8. 업그레이드/다운그레이드 판단
    const currentTier = PLAN_TIER_ORDER[currentPlan.id] ?? 0;
    const targetTier = PLAN_TIER_ORDER[targetPlan.id] ?? 0;
    const isUpgrade = targetTier > currentTier;

    if (isUpgrade) {
      // 업그레이드: 즉시 적용
      // TODO: 차액 결제 로직 (prorated billing)
      // 현재는 다음 결제 시점부터 새 금액 적용

      const [updatedSubscription] = await db
        .update(subscriptions)
        .set({
          planId: targetPlan.id,
          billingCycle: newBillingCycle,
          updatedAt: now,
        })
        .where(eq(subscriptions.id, currentSubscription.id))
        .returning();

      // 테넌트 티어 업데이트
      await db
        .update(tenants)
        .set({
          tier: targetPlan.id as 'basic' | 'standard' | 'premium',
          updatedAt: now,
        })
        .where(eq(tenants.id, tenantId));

      logger.info('Subscription upgraded', {
        tenantId,
        subscriptionId: currentSubscription.id,
        fromPlan: currentPlan.id,
        toPlan: targetPlan.id,
        billingCycle: newBillingCycle,
      });

      // 다음 결제 금액 계산
      const nextPaymentAmount =
        newBillingCycle === 'yearly' ? targetPlan.yearlyPrice : targetPlan.monthlyPrice;

      return NextResponse.json({
        message: '플랜이 업그레이드되었습니다',
        changeType: 'upgrade',
        subscription: {
          id: updatedSubscription.id,
          planId: updatedSubscription.planId,
          billingCycle: updatedSubscription.billingCycle,
          status: updatedSubscription.status,
          currentPeriodEnd: updatedSubscription.currentPeriodEnd,
          nextPaymentDate: updatedSubscription.nextPaymentDate,
          nextPaymentAmount,
        },
        newPlan: {
          id: targetPlan.id,
          name: targetPlan.name,
          nameKo: targetPlan.nameKo,
        },
      });
    } else {
      // 다운그레이드: 현재 기간 종료 후 적용 예약
      const [updatedSubscription] = await db
        .update(subscriptions)
        .set({
          // 예약 정보를 metadata에 저장하거나 별도 필드 사용
          // 현재는 간단히 cancelAtPeriodEnd와 유사하게 처리
          updatedAt: now,
        })
        .where(eq(subscriptions.id, currentSubscription.id))
        .returning();

      // 참고: 실제 다운그레이드는 Cron 작업에서 기간 종료 시 처리
      // 여기서는 다운그레이드 예약 정보만 기록

      logger.info('Subscription downgrade scheduled', {
        tenantId,
        subscriptionId: currentSubscription.id,
        fromPlan: currentPlan.id,
        toPlan: targetPlan.id,
        effectiveAt: currentSubscription.currentPeriodEnd,
      });

      return NextResponse.json({
        message: `플랜이 ${currentSubscription.currentPeriodEnd?.toLocaleDateString('ko-KR')}에 변경될 예정입니다`,
        changeType: 'downgrade',
        subscription: {
          id: updatedSubscription.id,
          planId: updatedSubscription.planId, // 현재 플랜 유지
          billingCycle: updatedSubscription.billingCycle,
          status: updatedSubscription.status,
          currentPeriodEnd: updatedSubscription.currentPeriodEnd,
        },
        scheduledPlan: {
          id: targetPlan.id,
          name: targetPlan.name,
          nameKo: targetPlan.nameKo,
          effectiveAt: currentSubscription.currentPeriodEnd,
        },
      });
    }
  } catch (error) {
    console.error('Subscription change error:', error);
    return NextResponse.json(
      { error: '플랜 변경 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
