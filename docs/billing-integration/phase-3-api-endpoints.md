# Phase 3: 결제 API 엔드포인트

## 개요

이 Phase에서는 결제 관련 API 엔드포인트를 구현합니다:
- 구독 관리 API (조회, 생성, 취소)
- 빌링키 관리 API (발급, 삭제)
- 플랜 변경 API
- 결제 내역 API
- 웹훅 엔드포인트

## 3.1 API 엔드포인트 목록

| 메서드 | 경로 | 설명 | 권한 |
|--------|------|------|------|
| GET | `/api/billing/plans` | 플랜 목록 조회 | 인증 필요 |
| GET | `/api/billing/subscription` | 현재 구독 조회 | admin |
| POST | `/api/billing/subscription/create` | 구독 생성 | admin |
| POST | `/api/billing/billing-key` | 빌링키 발급 완료 | admin |
| DELETE | `/api/billing/billing-key` | 결제 수단 삭제 | admin |
| POST | `/api/billing/plan/change` | 플랜 변경 | admin |
| POST | `/api/billing/cancel` | 구독 취소 | admin |
| GET | `/api/billing/payments` | 결제 내역 조회 | admin |
| POST | `/api/webhooks/tosspayments` | 웹훅 수신 | 서명 검증 |

---

## 3.2 플랜 목록 조회 API

### 파일
`app/api/billing/plans/route.ts`

```typescript
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { plans } from '@/drizzle/schema';
import { eq } from 'drizzle-orm';
import { getSession } from '@/lib/auth/session';

export async function GET() {
  try {
    // 인증 확인 (로그인한 사용자만)
    const session = await getSession();
    if (!session.userId) {
      return NextResponse.json(
        { error: '로그인이 필요합니다.' },
        { status: 401 }
      );
    }

    // 활성화된 플랜만 조회
    const activePlans = await db
      .select()
      .from(plans)
      .where(eq(plans.isActive, true))
      .orderBy(plans.monthlyPrice);

    return NextResponse.json({
      plans: activePlans.map(plan => ({
        id: plan.id,
        name: plan.name,
        monthlyPrice: plan.monthlyPrice,
        tier: plan.tier,
        features: plan.features,
      })),
    });
  } catch (error) {
    console.error('[GET /api/billing/plans]', error);
    return NextResponse.json(
      { error: '플랜 목록을 불러오는 데 실패했습니다.' },
      { status: 500 }
    );
  }
}
```

---

## 3.3 구독 조회 API

### 파일
`app/api/billing/subscription/route.ts`

```typescript
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { subscriptions, plans, payments } from '@/drizzle/schema';
import { eq, desc } from 'drizzle-orm';
import { getSession } from '@/lib/auth/session';

export async function GET() {
  try {
    const session = await getSession();

    // admin 권한 확인
    if (!session.userId || session.role !== 'admin') {
      return NextResponse.json(
        { error: '결제 관리는 관리자만 가능합니다.' },
        { status: 403 }
      );
    }

    const tenantId = session.tenantId;

    // 현재 구독 조회
    const subscription = await db
      .select({
        subscription: subscriptions,
        plan: plans,
      })
      .from(subscriptions)
      .leftJoin(plans, eq(subscriptions.planId, plans.id))
      .where(eq(subscriptions.tenantId, tenantId))
      .limit(1);

    if (subscription.length === 0) {
      return NextResponse.json({
        subscription: null,
        message: '구독 정보가 없습니다.',
      });
    }

    const sub = subscription[0];

    // 최근 결제 내역 3건
    const recentPayments = await db
      .select()
      .from(payments)
      .where(eq(payments.subscriptionId, sub.subscription.id))
      .orderBy(desc(payments.createdAt))
      .limit(3);

    return NextResponse.json({
      subscription: {
        id: sub.subscription.id,
        status: sub.subscription.status,
        currentPeriodStart: sub.subscription.currentPeriodStart,
        currentPeriodEnd: sub.subscription.currentPeriodEnd,
        nextBillingDate: sub.subscription.nextBillingDate,
        cancelAtPeriodEnd: sub.subscription.cancelAtPeriodEnd,
        failedPaymentCount: sub.subscription.failedPaymentCount,
        billingKeyMasked: sub.subscription.billingKeyMasked,
      },
      plan: sub.plan ? {
        id: sub.plan.id,
        name: sub.plan.name,
        monthlyPrice: sub.plan.monthlyPrice,
        features: sub.plan.features,
      } : null,
      recentPayments: recentPayments.map(p => ({
        id: p.id,
        amount: p.amount,
        status: p.status,
        paidAt: p.paidAt,
        cardCompany: p.cardCompany,
        cardNumber: p.cardNumber,
      })),
    });
  } catch (error) {
    console.error('[GET /api/billing/subscription]', error);
    return NextResponse.json(
      { error: '구독 정보를 불러오는 데 실패했습니다.' },
      { status: 500 }
    );
  }
}
```

---

## 3.4 구독 생성 API

### 파일
`app/api/billing/subscription/create/route.ts`

구독을 생성하고 customerKey를 발급합니다. 빌링키는 아직 없는 상태입니다.

```typescript
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { subscriptions, plans } from '@/drizzle/schema';
import { eq } from 'drizzle-orm';
import { getSession } from '@/lib/auth/session';
import { randomUUID } from 'crypto';

export async function POST(request: Request) {
  try {
    const session = await getSession();

    // admin 권한 확인
    if (!session.userId || session.role !== 'admin') {
      return NextResponse.json(
        { error: '결제 관리는 관리자만 가능합니다.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { planId } = body;

    if (!planId) {
      return NextResponse.json(
        { error: '플랜을 선택해주세요.' },
        { status: 400 }
      );
    }

    // 플랜 존재 확인
    const plan = await db
      .select()
      .from(plans)
      .where(eq(plans.id, planId))
      .limit(1);

    if (plan.length === 0) {
      return NextResponse.json(
        { error: '존재하지 않는 플랜입니다.' },
        { status: 400 }
      );
    }

    const tenantId = session.tenantId;

    // 기존 구독 확인
    const existing = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.tenantId, tenantId))
      .limit(1);

    if (existing.length > 0) {
      // 기존 구독이 있으면 customerKey 반환
      return NextResponse.json({
        subscription: existing[0],
        customerKey: existing[0].customerKey,
        isExisting: true,
      });
    }

    // customerKey 생성 (테넌트 기반)
    const customerKey = `cust_${tenantId}_${randomUUID().slice(0, 8)}`;

    // 새 구독 생성 (pending 상태)
    const [newSubscription] = await db
      .insert(subscriptions)
      .values({
        tenantId,
        planId,
        status: 'pending',
        customerKey,
      })
      .returning();

    return NextResponse.json({
      subscription: newSubscription,
      customerKey,
      isExisting: false,
    });
  } catch (error) {
    console.error('[POST /api/billing/subscription/create]', error);
    return NextResponse.json(
      { error: '구독 생성에 실패했습니다.' },
      { status: 500 }
    );
  }
}
```

---

## 3.5 빌링키 발급 API

### 파일
`app/api/billing/billing-key/route.ts`

프론트엔드에서 토스 SDK로 인증 완료 후, authKey를 받아 빌링키를 발급합니다.

```typescript
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { subscriptions, tenants } from '@/drizzle/schema';
import { eq } from 'drizzle-orm';
import { getSession } from '@/lib/auth/session';
import { getTossClient } from '@/lib/toss/client';
import { encryptBillingKey } from '@/lib/crypto/billing';
import { inngest } from '@/inngest/client';

export async function POST(request: Request) {
  try {
    const session = await getSession();

    if (!session.userId || session.role !== 'admin') {
      return NextResponse.json(
        { error: '결제 관리는 관리자만 가능합니다.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { authKey, customerKey } = body;

    if (!authKey || !customerKey) {
      return NextResponse.json(
        { error: '인증 정보가 누락되었습니다.' },
        { status: 400 }
      );
    }

    const tenantId = session.tenantId;

    // 구독 확인
    const [subscription] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.tenantId, tenantId))
      .limit(1);

    if (!subscription) {
      return NextResponse.json(
        { error: '구독 정보를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // customerKey 일치 확인
    if (subscription.customerKey !== customerKey) {
      return NextResponse.json(
        { error: '고객 정보가 일치하지 않습니다.' },
        { status: 400 }
      );
    }

    // 토스 API로 빌링키 발급
    const toss = getTossClient();
    const billingResult = await toss.issueBillingKey(authKey, customerKey);

    // 빌링키 암호화
    const encryptedBillingKey = encryptBillingKey(billingResult.billingKey);

    // 마스킹된 카드 정보 생성
    const maskedCard = `${billingResult.card.company} ${billingResult.card.number}`;

    // 결제 기간 계산
    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    // 구독 업데이트
    const [updatedSubscription] = await db
      .update(subscriptions)
      .set({
        billingKey: encryptedBillingKey,
        billingKeyMasked: maskedCard,
        status: 'active',
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        nextBillingDate: periodEnd,
        updatedAt: new Date(),
      })
      .where(eq(subscriptions.id, subscription.id))
      .returning();

    // 테넌트 tier 업데이트
    await db
      .update(tenants)
      .set({
        tier: subscription.planId,
        updatedAt: new Date(),
      })
      .where(eq(tenants.id, tenantId));

    // 첫 결제 이벤트 발송 (무료 첫 달이 아닌 경우)
    await inngest.send({
      name: 'billing/payment.process',
      data: {
        subscriptionId: subscription.id,
        tenantId,
        isFirstPayment: true,
      },
    });

    return NextResponse.json({
      success: true,
      subscription: {
        id: updatedSubscription.id,
        status: updatedSubscription.status,
        billingKeyMasked: maskedCard,
        currentPeriodEnd: periodEnd,
      },
    });
  } catch (error) {
    console.error('[POST /api/billing/billing-key]', error);

    // 토스 에러 처리
    if (error instanceof TossPaymentError) {
      return NextResponse.json(
        {
          error: error.userMessage,
          code: error.code,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: '빌링키 발급에 실패했습니다.' },
      { status: 500 }
    );
  }
}

// 결제 수단 삭제
export async function DELETE(request: Request) {
  try {
    const session = await getSession();

    if (!session.userId || session.role !== 'admin') {
      return NextResponse.json(
        { error: '결제 관리는 관리자만 가능합니다.' },
        { status: 403 }
      );
    }

    const tenantId = session.tenantId;

    // 구독 확인
    const [subscription] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.tenantId, tenantId))
      .limit(1);

    if (!subscription || !subscription.billingKey) {
      return NextResponse.json(
        { error: '등록된 결제 수단이 없습니다.' },
        { status: 404 }
      );
    }

    // 빌링키 삭제 (DB에서만 - 토스에서는 자동 삭제되지 않음)
    await db
      .update(subscriptions)
      .set({
        billingKey: null,
        billingKeyMasked: null,
        status: 'pending',
        updatedAt: new Date(),
      })
      .where(eq(subscriptions.id, subscription.id));

    return NextResponse.json({
      success: true,
      message: '결제 수단이 삭제되었습니다.',
    });
  } catch (error) {
    console.error('[DELETE /api/billing/billing-key]', error);
    return NextResponse.json(
      { error: '결제 수단 삭제에 실패했습니다.' },
      { status: 500 }
    );
  }
}
```

---

## 3.6 플랜 변경 API

### 파일
`app/api/billing/plan/change/route.ts`

```typescript
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { subscriptions, plans, tenants } from '@/drizzle/schema';
import { eq } from 'drizzle-orm';
import { getSession } from '@/lib/auth/session';

export async function POST(request: Request) {
  try {
    const session = await getSession();

    if (!session.userId || session.role !== 'admin') {
      return NextResponse.json(
        { error: '결제 관리는 관리자만 가능합니다.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { newPlanId } = body;

    if (!newPlanId) {
      return NextResponse.json(
        { error: '변경할 플랜을 선택해주세요.' },
        { status: 400 }
      );
    }

    const tenantId = session.tenantId;

    // 현재 구독 확인
    const [subscription] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.tenantId, tenantId))
      .limit(1);

    if (!subscription) {
      return NextResponse.json(
        { error: '구독 정보를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    if (subscription.status !== 'active') {
      return NextResponse.json(
        { error: '활성 구독만 플랜을 변경할 수 있습니다.' },
        { status: 400 }
      );
    }

    if (subscription.planId === newPlanId) {
      return NextResponse.json(
        { error: '현재 구독 중인 플랜입니다.' },
        { status: 400 }
      );
    }

    // 새 플랜 확인
    const [newPlan] = await db
      .select()
      .from(plans)
      .where(eq(plans.id, newPlanId))
      .limit(1);

    if (!newPlan) {
      return NextResponse.json(
        { error: '존재하지 않는 플랜입니다.' },
        { status: 400 }
      );
    }

    // 플랜 변경 (다음 결제일부터 적용)
    // 즉시 적용을 원하면 비례 계산 로직 추가 필요
    await db
      .update(subscriptions)
      .set({
        planId: newPlanId,
        updatedAt: new Date(),
      })
      .where(eq(subscriptions.id, subscription.id));

    // 테넌트 tier 업데이트
    await db
      .update(tenants)
      .set({
        tier: newPlan.tier,
        updatedAt: new Date(),
      })
      .where(eq(tenants.id, tenantId));

    return NextResponse.json({
      success: true,
      message: `${newPlan.name} 플랜으로 변경되었습니다.`,
      newPlan: {
        id: newPlan.id,
        name: newPlan.name,
        monthlyPrice: newPlan.monthlyPrice,
      },
    });
  } catch (error) {
    console.error('[POST /api/billing/plan/change]', error);
    return NextResponse.json(
      { error: '플랜 변경에 실패했습니다.' },
      { status: 500 }
    );
  }
}
```

---

## 3.7 구독 취소 API

### 파일
`app/api/billing/cancel/route.ts`

```typescript
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { subscriptions, tenants } from '@/drizzle/schema';
import { eq } from 'drizzle-orm';
import { getSession } from '@/lib/auth/session';

export async function POST(request: Request) {
  try {
    const session = await getSession();

    if (!session.userId || session.role !== 'admin') {
      return NextResponse.json(
        { error: '결제 관리는 관리자만 가능합니다.' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { cancelImmediately, reason } = body;

    const tenantId = session.tenantId;

    // 구독 확인
    const [subscription] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.tenantId, tenantId))
      .limit(1);

    if (!subscription) {
      return NextResponse.json(
        { error: '구독 정보를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    if (subscription.status === 'canceled' || subscription.status === 'expired') {
      return NextResponse.json(
        { error: '이미 취소된 구독입니다.' },
        { status: 400 }
      );
    }

    if (cancelImmediately) {
      // 즉시 취소
      await db
        .update(subscriptions)
        .set({
          status: 'canceled',
          cancelReason: reason,
          billingKey: null,
          billingKeyMasked: null,
          updatedAt: new Date(),
        })
        .where(eq(subscriptions.id, subscription.id));

      // 테넌트 tier를 free로 변경
      await db
        .update(tenants)
        .set({
          tier: 'free',
          updatedAt: new Date(),
        })
        .where(eq(tenants.id, tenantId));

      return NextResponse.json({
        success: true,
        message: '구독이 즉시 취소되었습니다.',
        canceledAt: new Date(),
      });
    } else {
      // 기간 만료 시 취소
      await db
        .update(subscriptions)
        .set({
          cancelAtPeriodEnd: true,
          cancelReason: reason,
          updatedAt: new Date(),
        })
        .where(eq(subscriptions.id, subscription.id));

      return NextResponse.json({
        success: true,
        message: `구독이 ${subscription.currentPeriodEnd?.toLocaleDateString()}에 취소됩니다.`,
        cancelAt: subscription.currentPeriodEnd,
      });
    }
  } catch (error) {
    console.error('[POST /api/billing/cancel]', error);
    return NextResponse.json(
      { error: '구독 취소에 실패했습니다.' },
      { status: 500 }
    );
  }
}
```

---

## 3.8 결제 내역 API

### 파일
`app/api/billing/payments/route.ts`

```typescript
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { payments, subscriptions } from '@/drizzle/schema';
import { eq, desc } from 'drizzle-orm';
import { getSession } from '@/lib/auth/session';

export async function GET(request: Request) {
  try {
    const session = await getSession();

    if (!session.userId || session.role !== 'admin') {
      return NextResponse.json(
        { error: '결제 관리는 관리자만 가능합니다.' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '10', 10);
    const offset = (page - 1) * limit;

    const tenantId = session.tenantId;

    // 결제 내역 조회
    const paymentList = await db
      .select()
      .from(payments)
      .where(eq(payments.tenantId, tenantId))
      .orderBy(desc(payments.createdAt))
      .limit(limit)
      .offset(offset);

    // 전체 개수 조회
    const totalResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(payments)
      .where(eq(payments.tenantId, tenantId));

    const total = totalResult[0]?.count || 0;

    return NextResponse.json({
      payments: paymentList.map(p => ({
        id: p.id,
        orderId: p.orderId,
        amount: p.amount,
        status: p.status,
        cardCompany: p.cardCompany,
        cardNumber: p.cardNumber,
        receiptUrl: p.receiptUrl,
        periodStart: p.periodStart,
        periodEnd: p.periodEnd,
        paidAt: p.paidAt,
        failedAt: p.failedAt,
        failureMessage: p.failureMessage,
        createdAt: p.createdAt,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('[GET /api/billing/payments]', error);
    return NextResponse.json(
      { error: '결제 내역을 불러오는 데 실패했습니다.' },
      { status: 500 }
    );
  }
}
```

---

## 3.9 웹훅 엔드포인트

### 파일
`app/api/webhooks/tosspayments/route.ts`

```typescript
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { billingWebhookLogs } from '@/drizzle/schema';
import { eq } from 'drizzle-orm';
import { validateTossWebhook } from '@/lib/toss/webhook-security';
import { inngest } from '@/inngest/client';
import { TossWebhookPayload } from '@/lib/toss/types';

export async function POST(request: Request) {
  try {
    // 서명 검증
    const validation = await validateTossWebhook(request);

    if (!validation.isValid) {
      console.error('[Webhook] 검증 실패:', validation.error);
      return NextResponse.json(
        { error: validation.error },
        { status: 401 }
      );
    }

    const payload: TossWebhookPayload = JSON.parse(validation.body!);

    // 이벤트 ID 생성 (멱등성 키)
    const eventId = `${payload.eventType}_${payload.data.paymentKey || payload.data.billingKey}_${payload.createdAt}`;

    // 중복 체크
    const existing = await db
      .select()
      .from(billingWebhookLogs)
      .where(eq(billingWebhookLogs.eventId, eventId))
      .limit(1);

    if (existing.length > 0) {
      console.log('[Webhook] 중복 이벤트 무시:', eventId);
      return NextResponse.json({ status: 'already_processed' });
    }

    // 웹훅 로그 저장
    const [log] = await db
      .insert(billingWebhookLogs)
      .values({
        eventId,
        eventType: payload.eventType,
        status: 'received',
        payload,
      })
      .returning();

    // Inngest로 비동기 처리 위임
    await inngest.send({
      name: 'billing/webhook.process',
      data: {
        logId: log.id,
        eventType: payload.eventType,
        payload,
      },
    });

    return NextResponse.json({
      status: 'received',
      logId: log.id,
    });
  } catch (error) {
    console.error('[Webhook] 처리 오류:', error);

    return NextResponse.json(
      { error: '웹훅 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
```

---

## 3.10 공통 유틸리티

### 파일
`lib/billing/api-utils.ts`

```typescript
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';

/**
 * admin 권한 검증 미들웨어
 */
export async function requireAdmin() {
  const session = await getSession();

  if (!session.userId) {
    return {
      authorized: false,
      error: NextResponse.json(
        { error: '로그인이 필요합니다.' },
        { status: 401 }
      ),
    };
  }

  if (session.role !== 'admin') {
    return {
      authorized: false,
      error: NextResponse.json(
        { error: '결제 관리는 관리자만 가능합니다.' },
        { status: 403 }
      ),
    };
  }

  return {
    authorized: true,
    session,
  };
}

/**
 * API 에러 응답 생성
 */
export function apiError(message: string, status: number = 400) {
  return NextResponse.json({ error: message }, { status });
}

/**
 * API 성공 응답 생성
 */
export function apiSuccess<T>(data: T, status: number = 200) {
  return NextResponse.json(data, { status });
}
```

---

## 체크리스트

- [ ] `app/api/billing/plans/route.ts` - 플랜 목록 조회
- [ ] `app/api/billing/subscription/route.ts` - 구독 조회
- [ ] `app/api/billing/subscription/create/route.ts` - 구독 생성
- [ ] `app/api/billing/billing-key/route.ts` - 빌링키 발급/삭제
- [ ] `app/api/billing/plan/change/route.ts` - 플랜 변경
- [ ] `app/api/billing/cancel/route.ts` - 구독 취소
- [ ] `app/api/billing/payments/route.ts` - 결제 내역 조회
- [ ] `app/api/webhooks/tosspayments/route.ts` - 웹훅 수신
- [ ] 모든 API에 admin 권한 검증 적용
- [ ] 에러 핸들링 및 로깅
- [ ] API 테스트

---

## 다음 단계

Phase 3 완료 후 [Phase 4: Inngest 함수](./phase-4-inngest.md)로 진행합니다.
