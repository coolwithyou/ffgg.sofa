# Phase 4: Inngest 함수 (자동 결제 및 재시도)

## 개요

이 Phase에서는 PortOne V2 기반 비동기 결제 처리를 위한 Inngest 함수를 구현합니다:
- 결제 처리 함수
- 결제 재시도 함수
- 웹훅 처리 함수
- 알림 발송 함수

## 4.1 이벤트 타입 정의

### 수정 파일
`inngest/client.ts`

```typescript
import { Inngest, EventSchemas } from 'inngest';

// 빌링 이벤트 타입
type BillingEvents = {
  // 결제 처리 요청
  'billing/payment.requested': {
    data: {
      subscriptionId: string;
      tenantId: string;
      isFirstPayment?: boolean;
    };
  };

  // 결제 완료
  'billing/payment.completed': {
    data: {
      paymentId: string;
      subscriptionId: string;
      tenantId: string;
    };
  };

  // 결제 실패 (재시도 예약)
  'billing/payment.failed': {
    data: {
      subscriptionId: string;
      tenantId: string;
      paymentId: string;
      failureCode: string;
      failureMessage: string;
      retryCount: number;
    };
  };

  // 웹훅 처리
  'billing/webhook.process': {
    data: {
      logId: string;
      eventType: string;
      payload: unknown;
    };
  };

  // 알림 발송
  'billing/notification.send': {
    data: {
      tenantId: string;
      type: 'payment_success' | 'payment_failed' | 'subscription_suspended' | 'subscription_expiring';
      metadata: Record<string, unknown>;
    };
  };
};

// 기존 이벤트와 병합
type Events = ExistingEvents & BillingEvents;

export const inngest = new Inngest({
  id: 'sofa',
  schemas: new EventSchemas().fromRecord<Events>(),
});
```

---

## 4.2 결제 처리 함수

### 신규 파일
`inngest/functions/billing/process-payment.ts`

```typescript
import { inngest } from '../../client';
import { db } from '@/lib/db';
import { subscriptions, plans, payments } from '@/drizzle/schema';
import { eq } from 'drizzle-orm';
import { payWithBillingKey } from '@/lib/portone/client';
import { generatePaymentId } from '@/lib/billing/order-id';

export const processBillingPayment = inngest.createFunction(
  {
    id: 'process-billing-payment',
    retries: 0, // 자체 재시도 로직 사용
    onFailure: async ({ event, error }) => {
      console.error('[processBillingPayment] 최종 실패:', {
        subscriptionId: event.data.data.subscriptionId,
        error: error.message,
      });
    },
  },
  { event: 'billing/payment.requested' },
  async ({ event, step }) => {
    const { subscriptionId, tenantId, isFirstPayment } = event.data;

    // Step 1: 구독 및 플랜 정보 조회
    const subscriptionData = await step.run('fetch-subscription', async () => {
      const result = await db
        .select({
          subscription: subscriptions,
          plan: plans,
        })
        .from(subscriptions)
        .leftJoin(plans, eq(subscriptions.planId, plans.id))
        .where(eq(subscriptions.id, subscriptionId))
        .limit(1);

      if (result.length === 0) {
        throw new Error(`구독을 찾을 수 없습니다: ${subscriptionId}`);
      }

      const sub = result[0];

      if (!sub.subscription.billingKey) {
        throw new Error('빌링키가 등록되지 않았습니다.');
      }

      if (!sub.plan) {
        throw new Error('플랜 정보를 찾을 수 없습니다.');
      }

      return {
        subscription: sub.subscription,
        plan: sub.plan,
      };
    });

    const { subscription, plan } = subscriptionData;

    // 결제 금액 계산
    const amount = subscription.billingCycle === 'yearly'
      ? plan.yearlyPrice
      : plan.monthlyPrice;

    // 무료 플랜인 경우 결제 스킵
    if (amount === 0) {
      return { status: 'skipped', reason: 'free_plan' };
    }

    // Step 2: 결제 레코드 생성
    const paymentRecord = await step.run('create-payment-record', async () => {
      const paymentId = generatePaymentId();

      const [payment] = await db
        .insert(payments)
        .values({
          tenantId,
          subscriptionId,
          paymentId,
          amount,
          currency: 'KRW',
          status: 'PENDING',
        })
        .returning();

      return payment;
    });

    // Step 3: PortOne API 결제 실행
    const paymentResult = await step.run('charge-billing-key', async () => {
      try {
        const result = await payWithBillingKey({
          paymentId: paymentRecord.paymentId,
          billingKey: subscription.billingKey!,
          orderName: `${plan.nameKo} ${subscription.billingCycle === 'yearly' ? '연간' : '월간'} 구독`,
          amount,
          currency: 'KRW',
          customer: {
            id: tenantId,
          },
        });

        return { success: true, data: result };
      } catch (error: any) {
        return {
          success: false,
          error: {
            code: error.code || 'UNKNOWN_ERROR',
            message: error.message || '결제 처리 중 오류가 발생했습니다.',
          },
        };
      }
    });

    // Step 4: 결과 처리
    if (paymentResult.success) {
      // 결제 성공
      await step.run('update-payment-success', async () => {
        const portoneData = paymentResult.data;

        // 결제 레코드 업데이트
        await db
          .update(payments)
          .set({
            status: 'PAID',
            transactionId: portoneData.transactionId,
            payMethod: portoneData.method?.type,
            cardInfo: portoneData.method?.card ? {
              issuer: portoneData.method.card.issuer,
              acquirer: portoneData.method.card.acquirer,
              number: portoneData.method.card.number,
              type: portoneData.method.card.type,
            } : null,
            receiptUrl: portoneData.receiptUrl,
            paidAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(payments.id, paymentRecord.id));

        // 구독 상태 업데이트
        const nextPaymentDate = new Date(subscription.currentPeriodEnd!);
        if (subscription.billingCycle === 'yearly') {
          nextPaymentDate.setFullYear(nextPaymentDate.getFullYear() + 1);
        } else {
          nextPaymentDate.setMonth(nextPaymentDate.getMonth() + 1);
        }

        await db
          .update(subscriptions)
          .set({
            status: 'active',
            currentPeriodStart: subscription.currentPeriodEnd,
            currentPeriodEnd: nextPaymentDate,
            nextPaymentDate,
            updatedAt: new Date(),
          })
          .where(eq(subscriptions.id, subscriptionId));
      });

      // 결제 성공 알림
      await step.sendEvent('send-success-notification', {
        name: 'billing/notification.send',
        data: {
          tenantId,
          type: 'payment_success',
          metadata: {
            amount,
            planName: plan.nameKo,
            receiptUrl: paymentResult.data.receiptUrl,
          },
        },
      });

      return { status: 'success', paymentId: paymentRecord.id };
    } else {
      // 결제 실패
      await step.run('update-payment-failed', async () => {
        const error = paymentResult.error;

        // 결제 레코드 업데이트
        await db
          .update(payments)
          .set({
            status: 'FAILED',
            failReason: `${error.code}: ${error.message}`,
            updatedAt: new Date(),
          })
          .where(eq(payments.id, paymentRecord.id));
      });

      // 재시도 이벤트 발송
      await step.sendEvent('schedule-retry', {
        name: 'billing/payment.failed',
        data: {
          subscriptionId,
          tenantId,
          paymentId: paymentRecord.id,
          failureCode: paymentResult.error.code,
          failureMessage: paymentResult.error.message,
          retryCount: 0,
        },
      });

      return {
        status: 'failed',
        paymentId: paymentRecord.id,
        error: paymentResult.error,
      };
    }
  }
);
```

---

## 4.3 결제 재시도 함수

### 신규 파일
`inngest/functions/billing/retry-payment.ts`

```typescript
import { inngest } from '../../client';
import { db } from '@/lib/db';
import { subscriptions } from '@/drizzle/schema';
import { eq } from 'drizzle-orm';
import { billingEnv } from '@/lib/config/billing-env';

export const billingRetry = inngest.createFunction(
  {
    id: 'billing-retry',
    retries: 0,
  },
  { event: 'billing/payment.failed' },
  async ({ event, step }) => {
    const { subscriptionId, tenantId, paymentId, retryCount, failureCode, failureMessage } = event.data;

    const maxRetries = billingEnv.billing.retryAttempts;
    const retryDelays = billingEnv.billing.retryDelayDays;

    // 최대 재시도 횟수 초과
    if (retryCount >= maxRetries) {
      await step.run('mark-suspended', async () => {
        await db
          .update(subscriptions)
          .set({
            status: 'suspended',
            updatedAt: new Date(),
          })
          .where(eq(subscriptions.id, subscriptionId));
      });

      // 서비스 정지 알림
      await step.sendEvent('send-suspended-notification', {
        name: 'billing/notification.send',
        data: {
          tenantId,
          type: 'subscription_suspended',
          metadata: {
            reason: '결제 실패',
            lastFailureCode: failureCode,
            lastFailureMessage: failureMessage,
          },
        },
      });

      return { status: 'suspended', retryCount };
    }

    // 딜레이 대기 (1일, 3일, 7일)
    const delayDays = retryDelays[retryCount] || 1;
    await step.sleep('wait-for-retry', `${delayDays}d`);

    // 구독 상태 확인 (취소되었을 수 있음)
    const currentSubscription = await step.run('check-subscription', async () => {
      const result = await db
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.id, subscriptionId))
        .limit(1);

      return result[0];
    });

    if (!currentSubscription) {
      return { status: 'cancelled', reason: 'subscription_not_found' };
    }

    if (currentSubscription.status === 'canceled' || currentSubscription.status === 'expired') {
      return { status: 'cancelled', reason: 'subscription_cancelled' };
    }

    // 2차 실패 이후 past_due 상태로 전환
    if (retryCount >= 1 && currentSubscription.status === 'active') {
      await step.run('mark-past-due', async () => {
        await db
          .update(subscriptions)
          .set({
            status: 'past_due',
            updatedAt: new Date(),
          })
          .where(eq(subscriptions.id, subscriptionId));
      });
    }

    // 재시도 결제 이벤트 발송
    await step.sendEvent('retry-payment', {
      name: 'billing/payment.requested',
      data: {
        subscriptionId,
        tenantId,
        isFirstPayment: false,
      },
    });

    return { status: 'retry_scheduled', retryCount: retryCount + 1 };
  }
);
```

---

## 4.4 웹훅 처리 함수

### 신규 파일
`inngest/functions/billing/process-webhook.ts`

```typescript
import { inngest } from '../../client';
import { db } from '@/lib/db';
import { billingWebhookLogs, subscriptions, payments } from '@/drizzle/schema';
import { eq } from 'drizzle-orm';
import type { WebhookEventType } from '@/lib/portone/webhook';

export const processBillingWebhook = inngest.createFunction(
  {
    id: 'process-billing-webhook',
    retries: 3,
  },
  { event: 'billing/webhook.process' },
  async ({ event, step }) => {
    const { logId, eventType, payload } = event.data;

    try {
      // 처리 상태 업데이트
      await step.run('mark-processing', async () => {
        await db
          .update(billingWebhookLogs)
          .set({ processed: false })
          .where(eq(billingWebhookLogs.id, logId));
      });

      // 이벤트 타입별 처리
      switch (eventType as WebhookEventType) {
        case 'Transaction.Paid':
          await step.run('handle-transaction-paid', async () => {
            await handleTransactionPaid(payload);
          });
          break;

        case 'Transaction.Failed':
          await step.run('handle-transaction-failed', async () => {
            await handleTransactionFailed(payload);
          });
          break;

        case 'Transaction.Cancelled':
          await step.run('handle-transaction-cancelled', async () => {
            await handleTransactionCancelled(payload);
          });
          break;

        case 'BillingKey.Deleted':
          await step.run('handle-billing-key-deleted', async () => {
            await handleBillingKeyDeleted(payload);
          });
          break;

        default:
          console.log(`[Webhook] 처리하지 않는 이벤트: ${eventType}`);
      }

      // 처리 완료
      await step.run('mark-processed', async () => {
        await db
          .update(billingWebhookLogs)
          .set({
            processed: true,
            processedAt: new Date(),
          })
          .where(eq(billingWebhookLogs.id, logId));
      });

      return { status: 'processed', eventType };
    } catch (error) {
      // 실패 처리
      await db
        .update(billingWebhookLogs)
        .set({
          processed: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
        .where(eq(billingWebhookLogs.id, logId));

      throw error;
    }
  }
);

/**
 * 결제 성공 처리 (Transaction.Paid)
 */
async function handleTransactionPaid(payload: any) {
  const { paymentId, transactionId } = payload.data || {};

  if (!paymentId) return;

  // 결제 레코드 업데이트
  const [payment] = await db
    .select()
    .from(payments)
    .where(eq(payments.paymentId, paymentId))
    .limit(1);

  if (!payment) {
    console.log(`[Webhook] 결제 레코드 없음: ${paymentId}`);
    return;
  }

  await db
    .update(payments)
    .set({
      status: 'PAID',
      transactionId,
      paidAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(payments.id, payment.id));
}

/**
 * 결제 실패 처리 (Transaction.Failed)
 */
async function handleTransactionFailed(payload: any) {
  const { paymentId, failReason } = payload.data || {};

  if (!paymentId) return;

  const [payment] = await db
    .select()
    .from(payments)
    .where(eq(payments.paymentId, paymentId))
    .limit(1);

  if (!payment) {
    console.log(`[Webhook] 결제 레코드 없음: ${paymentId}`);
    return;
  }

  await db
    .update(payments)
    .set({
      status: 'FAILED',
      failReason,
      updatedAt: new Date(),
    })
    .where(eq(payments.id, payment.id));
}

/**
 * 결제 취소 처리 (Transaction.Cancelled)
 */
async function handleTransactionCancelled(payload: any) {
  const { paymentId } = payload.data || {};

  if (!paymentId) return;

  const [payment] = await db
    .select()
    .from(payments)
    .where(eq(payments.paymentId, paymentId))
    .limit(1);

  if (!payment) {
    console.log(`[Webhook] 결제 레코드 없음: ${paymentId}`);
    return;
  }

  await db
    .update(payments)
    .set({
      status: 'CANCELLED',
      updatedAt: new Date(),
    })
    .where(eq(payments.id, payment.id));
}

/**
 * 빌링키 삭제 처리 (BillingKey.Deleted)
 */
async function handleBillingKeyDeleted(payload: any) {
  const { billingKey } = payload.data || {};

  if (!billingKey) return;

  // 빌링키로 구독 조회
  const [subscription] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.billingKey, billingKey))
    .limit(1);

  if (!subscription) {
    console.log(`[Webhook] 구독 없음: billingKey=${billingKey}`);
    return;
  }

  // 빌링키 삭제 처리
  await db
    .update(subscriptions)
    .set({
      billingKey: null,
      billingKeyIssuedAt: null,
      status: 'pending',
      updatedAt: new Date(),
    })
    .where(eq(subscriptions.id, subscription.id));
}
```

---

## 4.5 알림 발송 함수

### 신규 파일
`inngest/functions/billing/notification.ts`

```typescript
import { inngest } from '../../client';
import { db } from '@/lib/db';
import { tenants, users } from '@/drizzle/schema';
import { eq, and } from 'drizzle-orm';

export const billingNotification = inngest.createFunction(
  {
    id: 'billing-notification',
    retries: 2,
  },
  { event: 'billing/notification.send' },
  async ({ event, step }) => {
    const { tenantId, type, metadata } = event.data;

    // 테넌트의 admin 사용자 조회
    const adminUsers = await step.run('fetch-admin-users', async () => {
      return db
        .select({
          id: users.id,
          email: users.email,
          name: users.name,
        })
        .from(users)
        .where(
          and(
            eq(users.tenantId, tenantId),
            eq(users.role, 'admin')
          )
        );
    });

    if (adminUsers.length === 0) {
      console.log(`[Notification] admin 사용자 없음: ${tenantId}`);
      return { sent: 0 };
    }

    // 알림 타입별 처리
    const notifications = await step.run('send-notifications', async () => {
      const sent: string[] = [];

      for (const admin of adminUsers) {
        try {
          await sendNotification(admin.email, type, metadata);
          sent.push(admin.id);
        } catch (error) {
          console.error(`[Notification] 발송 실패: ${admin.email}`, error);
        }
      }

      return sent;
    });

    return { sent: notifications.length };
  }
);

/**
 * 알림 발송 (이메일, 슬랙 등)
 */
async function sendNotification(
  email: string,
  type: string,
  metadata: Record<string, unknown>
) {
  const templates: Record<string, { subject: string; body: string }> = {
    payment_success: {
      subject: '[SOFA] 결제가 완료되었습니다',
      body: `${metadata.planName} 플랜 결제가 완료되었습니다. 금액: ₩${(metadata.amount as number).toLocaleString()}`,
    },
    payment_failed: {
      subject: '[SOFA] 결제에 실패했습니다',
      body: `결제 처리 중 문제가 발생했습니다. 사유: ${metadata.failureMessage}`,
    },
    subscription_suspended: {
      subject: '[SOFA] 서비스가 일시 정지되었습니다',
      body: `결제 실패로 서비스가 일시 정지되었습니다. 결제 수단을 확인해주세요.`,
    },
    subscription_expiring: {
      subject: '[SOFA] 구독이 곧 만료됩니다',
      body: `구독이 ${metadata.expiresAt}에 만료됩니다. 갱신하시려면 결제 수단을 등록해주세요.`,
    },
  };

  const template = templates[type];
  if (!template) {
    console.log(`[Notification] 알 수 없는 알림 타입: ${type}`);
    return;
  }

  console.log(`[Notification] 발송 (mock):`, {
    to: email,
    subject: template.subject,
    body: template.body,
  });

  // TODO: 실제 알림 발송 구현
  // await resend.emails.send({
  //   from: 'noreply@sofa.app',
  //   to: email,
  //   subject: template.subject,
  //   html: template.body,
  // });
}
```

---

## 4.6 함수 등록

### 신규 파일
`inngest/functions/billing/index.ts`

```typescript
export { processBillingPayment } from './process-payment';
export { billingRetry } from './retry-payment';
export { processBillingWebhook } from './process-webhook';
export { billingNotification } from './notification';
```

### 수정 파일
`inngest/functions/index.ts`

```typescript
// 기존 함수들
export * from './process-document';
// ... 기타 기존 함수

// 빌링 함수들
export * from './billing';
```

### 수정 파일
`app/api/inngest/route.ts`

```typescript
import { serve } from 'inngest/next';
import { inngest } from '@/inngest/client';

// 기존 함수들
import { processDocument } from '@/inngest/functions/process-document';
// ... 기타 기존 함수

// 빌링 함수들
import {
  processBillingPayment,
  billingRetry,
  processBillingWebhook,
  billingNotification,
} from '@/inngest/functions/billing';

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    // 기존 함수들
    processDocument,
    // ... 기타 기존 함수

    // 빌링 함수들
    processBillingPayment,
    billingRetry,
    processBillingWebhook,
    billingNotification,
  ],
});
```

---

## 체크리스트

- [ ] `inngest/client.ts` 빌링 이벤트 타입 추가
- [ ] `inngest/functions/billing/process-payment.ts` 구현
  - [ ] 구독/플랜 정보 조회
  - [ ] 결제 레코드 생성
  - [ ] PortOne API 결제 호출
  - [ ] 성공/실패 처리
- [ ] `inngest/functions/billing/retry-payment.ts` 구현
  - [ ] 재시도 딜레이 로직
  - [ ] 상태 전환 (past_due, suspended)
- [ ] `inngest/functions/billing/process-webhook.ts` 구현
  - [ ] Transaction.Paid 처리
  - [ ] Transaction.Failed 처리
  - [ ] Transaction.Cancelled 처리
  - [ ] BillingKey.Deleted 처리
- [ ] `inngest/functions/billing/notification.ts` 구현
- [ ] `inngest/functions/billing/index.ts` 생성
- [ ] `app/api/inngest/route.ts` 함수 등록
- [ ] Inngest Dev Server에서 테스트

---

## 다음 단계

Phase 4 완료 후 [Phase 5: 크론 작업](./phase-5-cron.md)으로 진행합니다.
