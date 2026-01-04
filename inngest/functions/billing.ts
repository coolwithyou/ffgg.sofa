/**
 * 빌링 관련 Inngest 함수
 * [Billing System] 정기결제 처리, 재시도, 구독 만료 처리
 *
 * 워크플로우:
 * 1. Cron → billing/payment.requested 발송
 * 2. processRecurringPayment → 결제 실행
 *    - 성공: 구독 기간 연장, billing/payment.completed 발송
 *    - 실패: billing/payment.failed 발송
 * 3. retryFailedPayment → 재시도 (1일, 3일, 7일 간격)
 *    - 3회 실패: billing/subscription.expired 발송
 * 4. handleSubscriptionExpired → 구독 만료 처리, 테넌트 티어 다운그레이드
 */

import { inngestClient } from '../client';
import { db } from '@/lib/db';
import { subscriptions, payments, plans, tenants, users } from '@/drizzle/schema';
import { eq, and } from 'drizzle-orm';
import { requestBillingKeyPayment } from '@/lib/portone/client';
import { decryptBillingKey, maskBillingKey } from '@/lib/billing/encryption';
import { generateRecurringPaymentId } from '@/lib/billing/order-id';
import { billingEnv } from '@/lib/config/billing-env';
import { logger } from '@/lib/logger';
import { addMonths, addYears } from 'date-fns';
import { chargePoints } from '@/lib/points';
import { POINT_TRANSACTION_TYPES } from '@/lib/points/constants';

/**
 * 정기 결제 처리 함수
 *
 * billing/payment.requested 이벤트를 받아 PortOne으로 결제 요청
 */
export const processRecurringPayment = inngestClient.createFunction(
  {
    id: 'process-recurring-payment',
    retries: 0, // 내부에서 재시도 관리
    onFailure: async ({ event, error }) => {
      const failureEvent = event as unknown as {
        data: {
          event: {
            data: {
              subscriptionId: string;
              tenantId: string;
            };
          };
        };
      };

      const originalData = failureEvent.data.event?.data;
      if (!originalData?.subscriptionId) {
        logger.error('processRecurringPayment onFailure: Missing subscription data');
        return;
      }

      // 구독 상태를 past_due로 변경
      await db
        .update(subscriptions)
        .set({
          status: 'past_due',
          updatedAt: new Date(),
        })
        .where(eq(subscriptions.id, originalData.subscriptionId));

      logger.error(
        'Recurring payment processing failed',
        error instanceof Error ? error : new Error(String(error)),
        {
          subscriptionId: originalData.subscriptionId,
          tenantId: originalData.tenantId,
        }
      );
    },
  },
  { event: 'billing/payment.requested' },
  async ({ event, step }) => {
    const { subscriptionId, tenantId, attempt = 1 } = event.data;

    // Step 1: 구독 정보 조회
    const subscriptionData = await step.run('get-subscription', async () => {
      const [subscription] = await db
        .select({
          subscription: subscriptions,
          plan: plans,
        })
        .from(subscriptions)
        .innerJoin(plans, eq(subscriptions.planId, plans.id))
        .where(
          and(
            eq(subscriptions.id, subscriptionId),
            eq(subscriptions.tenantId, tenantId)
          )
        )
        .limit(1);

      if (!subscription) {
        throw new Error(`Subscription not found: ${subscriptionId}`);
      }

      if (!subscription.subscription.billingKey) {
        throw new Error(`No billing key for subscription: ${subscriptionId}`);
      }

      return subscription;
    });

    // Step 2: 결제 금액 계산
    const paymentAmount =
      subscriptionData.subscription.billingCycle === 'yearly'
        ? subscriptionData.plan.yearlyPrice
        : subscriptionData.plan.monthlyPrice;

    // 무료 플랜이면 결제 스킵
    if (paymentAmount === 0) {
      logger.info('Skipping payment for free plan', { subscriptionId });
      return { success: true, skipped: true, reason: 'Free plan' };
    }

    // Step 3: 테넌트/고객 정보 조회
    const customerInfo = await step.run('get-customer-info', async () => {
      const [tenant] = await db
        .select({
          id: tenants.id,
          name: tenants.name,
        })
        .from(tenants)
        .where(eq(tenants.id, tenantId))
        .limit(1);

      // 테넌트 관리자 이메일 조회
      const [adminUser] = await db
        .select({
          email: users.email,
          name: users.name,
        })
        .from(users)
        .where(and(eq(users.tenantId, tenantId), eq(users.role, 'admin')))
        .limit(1);

      return {
        customerId: tenant?.id || tenantId,
        customerName: tenant?.name,
        customerEmail: adminUser?.email,
      };
    });

    // Step 4: 결제 요청
    const paymentResult = await step.run('request-payment', async () => {
      const paymentId = generateRecurringPaymentId(subscriptionId);
      const orderName = `${subscriptionData.plan.nameKo} ${
        subscriptionData.subscription.billingCycle === 'yearly' ? '연간' : '월간'
      } 구독`;

      // 빌링키 복호화
      const decryptedBillingKey = decryptBillingKey(
        subscriptionData.subscription.billingKey!
      );

      // 결제 레코드 생성 (pending 상태)
      await db.insert(payments).values({
        tenantId,
        subscriptionId,
        paymentId,
        amount: paymentAmount,
        currency: 'KRW',
        status: 'PENDING',
        metadata: {
          attempt,
          planId: subscriptionData.plan.id,
          billingCycle: subscriptionData.subscription.billingCycle,
        },
      });

      try {
        // PortOne 빌링키 결제 요청
        const result = await requestBillingKeyPayment({
          paymentId,
          billingKey: decryptedBillingKey,
          orderName,
          amount: paymentAmount,
          customer: {
            id: customerInfo.customerId,
            name: customerInfo.customerName,
            email: customerInfo.customerEmail,
          },
        });

        // PortOne SDK payWithBillingKey 응답에서 payment 객체 추출
        // result는 BillingKeyPaymentSummary 타입으로 payment 필드가 존재
        const payment = result as unknown as { payment?: { pgTxId?: string } };

        return {
          success: true as const,
          paymentId,
          transactionId: payment.payment?.pgTxId,
        };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Payment request failed';

        // 결제 실패 상태 업데이트
        await db
          .update(payments)
          .set({
            status: 'FAILED',
            failReason: errorMessage,
            updatedAt: new Date(),
          })
          .where(eq(payments.paymentId, paymentId));

        logger.error('Billing payment failed', error instanceof Error ? error : undefined, {
          subscriptionId,
          paymentId,
          attempt,
          billingKey: maskBillingKey(subscriptionData.subscription.billingKey!),
        });

        return {
          success: false as const,
          paymentId,
          error: errorMessage,
        };
      }
    });

    // Step 5: 결과 처리
    if (paymentResult.success) {
      // 결제 성공: 구독 기간 연장
      await step.run('extend-subscription', async () => {
        const now = new Date();
        // DB에서 반환된 값이 string일 수 있으므로 Date로 변환
        const rawPeriodEnd = subscriptionData.subscription.currentPeriodEnd;
        const currentPeriodEnd = rawPeriodEnd
          ? new Date(rawPeriodEnd)
          : now;

        // 다음 기간 계산
        const nextPeriodEnd =
          subscriptionData.subscription.billingCycle === 'yearly'
            ? addYears(currentPeriodEnd, 1)
            : addMonths(currentPeriodEnd, 1);

        // 구독 기간 업데이트
        await db
          .update(subscriptions)
          .set({
            status: 'active',
            currentPeriodStart: currentPeriodEnd,
            currentPeriodEnd: nextPeriodEnd,
            nextPaymentDate: nextPeriodEnd,
            updatedAt: now,
          })
          .where(eq(subscriptions.id, subscriptionId));

        logger.info('Subscription extended', {
          subscriptionId,
          newPeriodEnd: nextPeriodEnd.toISOString(),
        });
      });

      // 결제 완료 이벤트 발송
      await step.sendEvent('payment-completed', {
        name: 'billing/payment.completed',
        data: {
          subscriptionId,
          paymentId: paymentResult.paymentId,
          tenantId,
          amount: paymentAmount,
        },
      });

      return {
        success: true,
        paymentId: paymentResult.paymentId,
        transactionId: paymentResult.transactionId,
      };
    } else {
      // 결제 실패: 재시도 이벤트 발송
      await step.sendEvent('payment-failed', {
        name: 'billing/payment.failed',
        data: {
          subscriptionId,
          tenantId,
          reason: paymentResult.error || 'Unknown error',
          attempt,
        },
      });

      return {
        success: false,
        paymentId: paymentResult.paymentId,
        error: paymentResult.error,
        attempt,
      };
    }
  }
);

/**
 * 결제 실패 재시도 함수
 *
 * billing/payment.failed 이벤트를 받아 재시도 스케줄링
 * 재시도 간격: 1일, 3일, 7일 (설정 가능)
 * 최대 재시도: 3회
 */
export const retryFailedPayment = inngestClient.createFunction(
  {
    id: 'retry-failed-payment',
    retries: 1,
  },
  { event: 'billing/payment.failed' },
  async ({ event, step }) => {
    const { subscriptionId, tenantId, reason, attempt } = event.data;
    const maxAttempts = billingEnv.billing.retryAttempts;
    const retryDelays = billingEnv.billing.retryDelayDays;

    logger.info('Payment retry scheduled', {
      subscriptionId,
      attempt,
      maxAttempts,
    });

    // 최대 재시도 초과 시 구독 만료 처리
    if (attempt >= maxAttempts) {
      await step.sendEvent('subscription-expired', {
        name: 'billing/subscription.expired',
        data: {
          subscriptionId,
          tenantId,
          reason: `Payment failed after ${maxAttempts} attempts: ${reason}`,
        },
      });

      return {
        expired: true,
        reason: `Max retry attempts (${maxAttempts}) exceeded`,
      };
    }

    // 구독 상태를 past_due로 변경
    await step.run('update-subscription-status', async () => {
      await db
        .update(subscriptions)
        .set({
          status: 'past_due',
          updatedAt: new Date(),
        })
        .where(eq(subscriptions.id, subscriptionId));
    });

    // 재시도 대기
    const delayDays = retryDelays[attempt - 1] || retryDelays[retryDelays.length - 1];
    await step.sleep(`wait-${delayDays}-days`, `${delayDays}d`);

    // 재시도 이벤트 발송
    await step.sendEvent('retry-payment', {
      name: 'billing/payment.requested',
      data: {
        subscriptionId,
        tenantId,
        attempt: attempt + 1,
      },
    });

    return {
      retried: true,
      nextAttempt: attempt + 1,
      delayDays,
    };
  }
);

/**
 * 구독 만료 처리 함수
 *
 * billing/subscription.expired 이벤트를 받아 구독 만료 및 티어 다운그레이드
 */
export const handleSubscriptionExpired = inngestClient.createFunction(
  {
    id: 'handle-subscription-expired',
    retries: 3,
  },
  { event: 'billing/subscription.expired' },
  async ({ event, step }) => {
    const { subscriptionId, tenantId, reason } = event.data;

    // Step 1: 구독 만료 처리
    await step.run('expire-subscription', async () => {
      await db
        .update(subscriptions)
        .set({
          status: 'expired',
          cancelledAt: new Date(),
          cancelReason: reason,
          billingKey: null, // 빌링키 삭제
          nextPaymentDate: null,
          updatedAt: new Date(),
        })
        .where(eq(subscriptions.id, subscriptionId));

      logger.info('Subscription expired', {
        subscriptionId,
        tenantId,
        reason,
      });
    });

    // Step 2: 테넌트 티어 다운그레이드
    await step.run('downgrade-tenant', async () => {
      await db
        .update(tenants)
        .set({
          tier: 'basic',
          updatedAt: new Date(),
        })
        .where(eq(tenants.id, tenantId));

      logger.info('Tenant downgraded to basic tier', { tenantId });
    });

    // Step 3: 관리자 알림
    await step.sendEvent('notify-expiration', {
      name: 'notification/send',
      data: {
        type: 'subscription_expired',
        tenantId,
        message: `구독이 만료되었습니다. 서비스 이용을 계속하려면 결제 정보를 업데이트해주세요. 사유: ${reason}`,
      },
    });

    return {
      success: true,
      subscriptionId,
      tenantId,
    };
  }
);

/**
 * 결제 완료 후처리 함수
 *
 * billing/payment.completed 이벤트를 받아 후처리:
 * 1. 월간 포인트 충전
 * 2. 알림 발송 (선택적)
 */
export const handlePaymentCompleted = inngestClient.createFunction(
  {
    id: 'handle-payment-completed',
    retries: 2,
  },
  { event: 'billing/payment.completed' },
  async ({ event, step }) => {
    const { subscriptionId, paymentId, tenantId, amount } = event.data;

    // 결제 완료 로그
    logger.info('Payment completed successfully', {
      subscriptionId,
      paymentId,
      tenantId,
      amount,
    });

    // Step 1: 구독 정보 조회하여 월간 포인트 확인
    const pointsResult = await step.run('charge-monthly-points', async () => {
      // 구독의 플랜 정보 조회
      const [subscription] = await db
        .select({
          planId: subscriptions.planId,
          plan: plans,
        })
        .from(subscriptions)
        .innerJoin(plans, eq(subscriptions.planId, plans.id))
        .where(eq(subscriptions.id, subscriptionId))
        .limit(1);

      if (!subscription) {
        logger.warn('Subscription not found for point charge', { subscriptionId });
        return { charged: false, reason: 'Subscription not found' };
      }

      // 플랜의 월간 포인트 (limits.monthlyPoints)
      const planLimits = subscription.plan.limits as { monthlyPoints?: number } | null;
      const monthlyPoints = planLimits?.monthlyPoints ?? 0;

      if (monthlyPoints <= 0) {
        logger.info('No monthly points to charge for this plan', {
          subscriptionId,
          planId: subscription.planId,
        });
        return { charged: false, reason: 'No monthly points for plan', planId: subscription.planId };
      }

      // 포인트 충전
      const result = await chargePoints({
        tenantId,
        amount: monthlyPoints,
        type: POINT_TRANSACTION_TYPES.SUBSCRIPTION_CHARGE,
        description: `${subscription.plan.nameKo} 월간 포인트 충전`,
        metadata: {
          paymentId,
          subscriptionId,
        },
      });

      logger.info('Monthly points charged', {
        tenantId,
        points: monthlyPoints,
        newBalance: result.newBalance,
        transactionId: result.transactionId,
      });

      return {
        charged: true,
        points: monthlyPoints,
        newBalance: result.newBalance,
        transactionId: result.transactionId,
      };
    });

    // 필요시 추가 후처리 (영수증 이메일 발송 등)

    return {
      success: true,
      paymentId,
      pointsCharged: pointsResult.charged,
      pointsAmount: pointsResult.charged ? (pointsResult as { points: number }).points : 0,
    };
  }
);
