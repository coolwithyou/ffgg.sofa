# Phase 4: Inngest 함수 (자동 결제 및 재시도)

## 개요

이 Phase에서는 비동기 결제 처리를 위한 Inngest 함수를 구현합니다:
- 결제 처리 함수
- 결제 재시도 함수
- 웹훅 처리 함수
- 알림 발송 함수

## 4.1 이벤트 타입 정의

### 수정 파일
`inngest/client.ts`

```typescript
import { Inngest } from 'inngest';

// 기존 이벤트 타입에 빌링 이벤트 추가
type BillingEvents = {
  // 결제 처리 요청
  'billing/payment.process': {
    data: {
      subscriptionId: string;
      tenantId: string;
      isFirstPayment?: boolean;
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
`inngest/functions/process-billing-payment.ts`

```typescript
import { inngest } from '../client';
import { db } from '@/lib/db';
import { subscriptions, plans, payments } from '@/drizzle/schema';
import { eq } from 'drizzle-orm';
import { getTossClient, TossPaymentError } from '@/lib/toss/client';
import { decryptBillingKey } from '@/lib/crypto/billing';
import { generateOrderId, generateOrderName } from '@/lib/billing/order-id';

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
  { event: 'billing/payment.process' },
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

    // Step 2: 결제 레코드 생성
    const paymentRecord = await step.run('create-payment-record', async () => {
      const orderId = generateOrderId();
      const periodStart = new Date();
      const periodEnd = new Date(periodStart);
      periodEnd.setMonth(periodEnd.getMonth() + 1);

      const [payment] = await db
        .insert(payments)
        .values({
          tenantId,
          subscriptionId,
          orderId,
          amount: plan.monthlyPrice,
          status: 'pending',
          periodStart,
          periodEnd,
        })
        .returning();

      return payment;
    });

    // Step 3: 토스 API 결제 실행
    const paymentResult = await step.run('charge-billing-key', async () => {
      const toss = getTossClient();
      const billingKey = decryptBillingKey(subscription.billingKey!);

      try {
        const result = await toss.chargeBillingKey({
          billingKey,
          orderId: paymentRecord.orderId,
          orderName: generateOrderName(plan.name, paymentRecord.periodStart!),
          amount: plan.monthlyPrice,
        });

        return { success: true, data: result };
      } catch (error) {
        if (error instanceof TossPaymentError) {
          return {
            success: false,
            error: {
              code: error.code,
              message: error.message,
              isRetryable: error.isRetryable,
            },
          };
        }
        throw error;
      }
    });

    // Step 4: 결과 처리
    if (paymentResult.success) {
      // 결제 성공
      await step.run('update-payment-success', async () => {
        const tossData = paymentResult.data;

        // 결제 레코드 업데이트
        await db
          .update(payments)
          .set({
            status: 'paid',
            paymentKey: tossData.paymentKey,
            cardCompany: tossData.card.company,
            cardNumber: tossData.card.number,
            cardType: tossData.card.cardType,
            receiptUrl: tossData.receipt.url,
            paidAt: new Date(tossData.approvedAt),
            updatedAt: new Date(),
          })
          .where(eq(payments.id, paymentRecord.id));

        // 구독 상태 업데이트
        const nextBillingDate = new Date(paymentRecord.periodEnd!);
        await db
          .update(subscriptions)
          .set({
            status: 'active',
            currentPeriodStart: paymentRecord.periodStart,
            currentPeriodEnd: paymentRecord.periodEnd,
            nextBillingDate,
            failedPaymentCount: 0,
            lastPaymentAt: new Date(),
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
            amount: plan.monthlyPrice,
            planName: plan.name,
            receiptUrl: paymentResult.data.receipt.url,
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
            status: 'failed',
            failureCode: error.code,
            failureMessage: error.message,
            failedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(payments.id, paymentRecord.id));

        // 실패 횟수 증가
        await db
          .update(subscriptions)
          .set({
            failedPaymentCount: subscription.failedPaymentCount + 1,
            updatedAt: new Date(),
          })
          .where(eq(subscriptions.id, subscriptionId));
      });

      // 재시도 가능한 경우 재시도 이벤트 발송
      if (paymentResult.error.isRetryable) {
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
      } else {
        // 재시도 불가능한 실패 알림
        await step.sendEvent('send-failure-notification', {
          name: 'billing/notification.send',
          data: {
            tenantId,
            type: 'payment_failed',
            metadata: {
              failureCode: paymentResult.error.code,
              failureMessage: paymentResult.error.message,
              isRetryable: false,
            },
          },
        });
      }

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
`inngest/functions/billing-retry.ts`

```typescript
import { inngest } from '../client';
import { db } from '@/lib/db';
import { subscriptions } from '@/drizzle/schema';
import { eq } from 'drizzle-orm';

// 재시도 딜레이 (밀리초)
const RETRY_DELAYS = [
  4 * 60 * 60 * 1000,    // 1차: 4시간
  24 * 60 * 60 * 1000,   // 2차: 24시간 (1일)
  72 * 60 * 60 * 1000,   // 3차: 72시간 (3일)
];

const MAX_RETRIES = 3;

export const billingRetry = inngest.createFunction(
  {
    id: 'billing-retry',
    retries: 0,
  },
  { event: 'billing/payment.failed' },
  async ({ event, step }) => {
    const { subscriptionId, tenantId, paymentId, retryCount, failureCode, failureMessage } = event.data;

    // 최대 재시도 횟수 초과
    if (retryCount >= MAX_RETRIES) {
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

    // 딜레이 대기
    const delay = RETRY_DELAYS[retryCount];
    await step.sleep('wait-for-retry', delay);

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
      name: 'billing/payment.process',
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
`inngest/functions/process-billing-webhook.ts`

```typescript
import { inngest } from '../client';
import { db } from '@/lib/db';
import { billingWebhookLogs, subscriptions, payments } from '@/drizzle/schema';
import { eq } from 'drizzle-orm';
import { TossWebhookPayload } from '@/lib/toss/types';

export const processBillingWebhook = inngest.createFunction(
  {
    id: 'process-billing-webhook',
    retries: 3,
  },
  { event: 'billing/webhook.process' },
  async ({ event, step }) => {
    const { logId, eventType, payload } = event.data;
    const webhookPayload = payload as TossWebhookPayload;

    try {
      // 처리 상태 업데이트
      await step.run('mark-processing', async () => {
        await db
          .update(billingWebhookLogs)
          .set({ status: 'processing' })
          .where(eq(billingWebhookLogs.id, logId));
      });

      // 이벤트 타입별 처리
      switch (eventType) {
        case 'PAYMENT_STATUS_CHANGED':
          await step.run('handle-payment-status', async () => {
            await handlePaymentStatusChanged(webhookPayload);
          });
          break;

        case 'BILLING_KEY_DELETED':
          await step.run('handle-billing-key-deleted', async () => {
            await handleBillingKeyDeleted(webhookPayload);
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
            status: 'processed',
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
          status: 'failed',
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
        })
        .where(eq(billingWebhookLogs.id, logId));

      throw error;
    }
  }
);

/**
 * 결제 상태 변경 처리
 */
async function handlePaymentStatusChanged(payload: TossWebhookPayload) {
  const { paymentKey, status } = payload.data;

  if (!paymentKey || !status) return;

  // 결제 레코드 조회
  const [payment] = await db
    .select()
    .from(payments)
    .where(eq(payments.paymentKey, paymentKey))
    .limit(1);

  if (!payment) {
    console.log(`[Webhook] 결제 레코드 없음: ${paymentKey}`);
    return;
  }

  // 상태에 따른 처리
  switch (status) {
    case 'DONE':
      await db
        .update(payments)
        .set({
          status: 'paid',
          paidAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(payments.id, payment.id));
      break;

    case 'CANCELED':
      await db
        .update(payments)
        .set({
          status: 'canceled',
          updatedAt: new Date(),
        })
        .where(eq(payments.id, payment.id));
      break;

    case 'PARTIAL_CANCELED':
      // 부분 취소는 환불로 처리
      await db
        .update(payments)
        .set({
          status: 'refunded',
          updatedAt: new Date(),
        })
        .where(eq(payments.id, payment.id));
      break;
  }
}

/**
 * 빌링키 삭제 처리
 */
async function handleBillingKeyDeleted(payload: TossWebhookPayload) {
  const { customerKey } = payload.data;

  if (!customerKey) return;

  // customerKey로 구독 조회
  const [subscription] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.customerKey, customerKey))
    .limit(1);

  if (!subscription) {
    console.log(`[Webhook] 구독 없음: ${customerKey}`);
    return;
  }

  // 빌링키 삭제 처리
  await db
    .update(subscriptions)
    .set({
      billingKey: null,
      billingKeyMasked: null,
      status: 'pending',
      updatedAt: new Date(),
    })
    .where(eq(subscriptions.id, subscription.id));
}
```

---

## 4.5 알림 발송 함수

### 신규 파일
`inngest/functions/billing-notification.ts`

```typescript
import { inngest } from '../client';
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
  // TODO: 실제 알림 발송 구현
  // - 이메일: Resend, SendGrid 등
  // - 슬랙: Slack Webhook
  // - 인앱: 알림 테이블에 저장

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

  // 실제 구현 시:
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

### 수정 파일
`app/api/inngest/route.ts`

```typescript
import { serve } from 'inngest/next';
import { inngest } from '@/inngest/client';

// 기존 함수들
import { processDocument } from '@/inngest/functions/process-document';
// ... 기타 기존 함수

// 빌링 함수들
import { processBillingPayment } from '@/inngest/functions/process-billing-payment';
import { billingRetry } from '@/inngest/functions/billing-retry';
import { processBillingWebhook } from '@/inngest/functions/process-billing-webhook';
import { billingNotification } from '@/inngest/functions/billing-notification';

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
- [ ] `inngest/functions/process-billing-payment.ts` 구현
  - [ ] 구독/플랜 정보 조회
  - [ ] 결제 레코드 생성
  - [ ] 토스 API 결제 호출
  - [ ] 성공/실패 처리
- [ ] `inngest/functions/billing-retry.ts` 구현
  - [ ] 재시도 딜레이 로직
  - [ ] 상태 전환 (past_due, suspended)
- [ ] `inngest/functions/process-billing-webhook.ts` 구현
  - [ ] PAYMENT_STATUS_CHANGED 처리
  - [ ] BILLING_KEY_DELETED 처리
- [ ] `inngest/functions/billing-notification.ts` 구현
- [ ] `app/api/inngest/route.ts` 함수 등록
- [ ] Inngest Dev Server에서 테스트

---

## 다음 단계

Phase 4 완료 후 [Phase 5: 크론 작업](./phase-5-cron.md)으로 진행합니다.
