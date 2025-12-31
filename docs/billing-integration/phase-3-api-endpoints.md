# Phase 3: 결제 API 엔드포인트

## 개요

이 Phase에서는 PortOne V2 기반 결제 관련 API 엔드포인트를 구현합니다:
- 빌링키 발급 준비/저장 API
- 구독 관리 API (조회, 변경, 취소)
- 결제 내역 API
- PortOne 웹훅 엔드포인트

## 3.1 API 엔드포인트 목록

| 메서드 | 경로 | 설명 | 권한 |
|--------|------|------|------|
| GET | `/api/billing/plans` | 플랜 목록 조회 | 인증 필요 |
| GET | `/api/billing/subscription` | 현재 구독 조회 | admin |
| POST | `/api/billing/billing-key/prepare` | 빌링키 발급 준비 | admin |
| POST | `/api/billing/billing-key/save` | 빌링키 저장 및 구독 시작 | admin |
| DELETE | `/api/billing/billing-key` | 결제 수단 삭제 | admin |
| POST | `/api/billing/subscription/change` | 플랜 변경 | admin |
| POST | `/api/billing/subscription/cancel` | 구독 취소 | admin |
| GET | `/api/billing/payments` | 결제 내역 조회 | admin |
| POST | `/api/billing/webhook` | PortOne 웹훅 수신 | 서명 검증 |

---

## 3.2 플랜 목록 조회 API

### 파일
`app/api/billing/plans/route.ts`

```typescript
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { plans } from '@/drizzle/schema';
import { eq, asc } from 'drizzle-orm';
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
      .orderBy(asc(plans.sortOrder));

    return NextResponse.json({
      plans: activePlans.map(plan => ({
        id: plan.id,
        name: plan.name,
        nameKo: plan.nameKo,
        description: plan.description,
        monthlyPrice: plan.monthlyPrice,
        yearlyPrice: plan.yearlyPrice,
        features: plan.features,
        limits: plan.limits,
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
        billingCycle: sub.subscription.billingCycle,
        currentPeriodStart: sub.subscription.currentPeriodStart,
        currentPeriodEnd: sub.subscription.currentPeriodEnd,
        nextPaymentDate: sub.subscription.nextPaymentDate,
        cancelAtPeriodEnd: sub.subscription.cancelAtPeriodEnd,
        hasBillingKey: !!sub.subscription.billingKey,
      },
      plan: sub.plan ? {
        id: sub.plan.id,
        name: sub.plan.name,
        nameKo: sub.plan.nameKo,
        monthlyPrice: sub.plan.monthlyPrice,
        yearlyPrice: sub.plan.yearlyPrice,
        features: sub.plan.features,
      } : null,
      recentPayments: recentPayments.map(p => ({
        id: p.id,
        amount: p.amount,
        status: p.status,
        payMethod: p.payMethod,
        cardInfo: p.cardInfo,
        paidAt: p.paidAt,
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

## 3.4 빌링키 발급 준비 API

### 파일
`app/api/billing/billing-key/prepare/route.ts`

프론트엔드에서 PortOne SDK를 호출하기 전에 필요한 설정 정보를 제공합니다.

```typescript
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { tenants } from '@/drizzle/schema';
import { eq } from 'drizzle-orm';
import { getSession } from '@/lib/auth/session';
import { billingEnv } from '@/lib/config/billing-env';

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
    const { planId, billingCycle } = body;

    if (!planId || !billingCycle) {
      return NextResponse.json(
        { error: '플랜과 결제 주기를 선택해주세요.' },
        { status: 400 }
      );
    }

    const tenantId = session.tenantId;

    // 테넌트 정보 조회
    const [tenant] = await db
      .select()
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1);

    if (!tenant) {
      return NextResponse.json(
        { error: '테넌트 정보를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // PortOne SDK에 필요한 설정 반환
    return NextResponse.json({
      storeId: billingEnv.portone.storeId,
      channelKey: billingEnv.portone.channelKey,
      customer: {
        customerId: tenantId,
        fullName: tenant.name || session.userName,
        email: session.userEmail,
      },
      // 선택된 플랜 정보 (프론트엔드에서 사용)
      planId,
      billingCycle,
    });
  } catch (error) {
    console.error('[POST /api/billing/billing-key/prepare]', error);
    return NextResponse.json(
      { error: '빌링키 발급 준비에 실패했습니다.' },
      { status: 500 }
    );
  }
}
```

---

## 3.5 빌링키 저장 API

### 파일
`app/api/billing/billing-key/save/route.ts`

프론트엔드에서 PortOne SDK로 빌링키 발급 완료 후 호출합니다.

```typescript
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { subscriptions, plans, tenants } from '@/drizzle/schema';
import { eq } from 'drizzle-orm';
import { getSession } from '@/lib/auth/session';
import { getBillingKeyInfo } from '@/lib/portone/client';
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
    const { billingKey, planId, billingCycle } = body;

    if (!billingKey || !planId || !billingCycle) {
      return NextResponse.json(
        { error: '필수 정보가 누락되었습니다.' },
        { status: 400 }
      );
    }

    const tenantId = session.tenantId;

    // 1. PortOne에서 빌링키 유효성 확인
    const billingKeyInfo = await getBillingKeyInfo(billingKey);

    if (!billingKeyInfo) {
      return NextResponse.json(
        { error: '유효하지 않은 빌링키입니다.' },
        { status: 400 }
      );
    }

    // 2. 플랜 확인
    const [plan] = await db
      .select()
      .from(plans)
      .where(eq(plans.id, planId))
      .limit(1);

    if (!plan) {
      return NextResponse.json(
        { error: '존재하지 않는 플랜입니다.' },
        { status: 400 }
      );
    }

    // 3. 기존 구독 확인
    const [existingSubscription] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.tenantId, tenantId))
      .limit(1);

    // 결제 기간 계산
    const now = new Date();
    const periodEnd = new Date(now);
    if (billingCycle === 'yearly') {
      periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    } else {
      periodEnd.setMonth(periodEnd.getMonth() + 1);
    }

    let subscription;

    if (existingSubscription) {
      // 기존 구독 업데이트
      [subscription] = await db
        .update(subscriptions)
        .set({
          planId,
          billingCycle,
          billingKey,
          billingKeyIssuedAt: new Date(),
          status: 'active',
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
          nextPaymentDate: periodEnd,
          cancelAtPeriodEnd: false,
          cancelledAt: null,
          cancelReason: null,
          updatedAt: new Date(),
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
          billingKey,
          billingKeyIssuedAt: new Date(),
          status: 'active',
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
          nextPaymentDate: periodEnd,
        })
        .returning();
    }

    // 4. 테넌트 플랜 업데이트
    await db
      .update(tenants)
      .set({
        tier: planId,
        updatedAt: new Date(),
      })
      .where(eq(tenants.id, tenantId));

    // 5. 첫 결제 실행 (유료 플랜인 경우)
    const amount = billingCycle === 'yearly' ? plan.yearlyPrice : plan.monthlyPrice;

    if (amount > 0) {
      await inngest.send({
        name: 'billing/payment.requested',
        data: {
          subscriptionId: subscription.id,
          tenantId,
          isFirstPayment: true,
        },
      });
    }

    return NextResponse.json({
      success: true,
      subscription: {
        id: subscription.id,
        status: subscription.status,
        planId: subscription.planId,
        billingCycle: subscription.billingCycle,
        currentPeriodEnd: subscription.currentPeriodEnd,
      },
    });
  } catch (error) {
    console.error('[POST /api/billing/billing-key/save]', error);
    return NextResponse.json(
      { error: '빌링키 저장에 실패했습니다.' },
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

    // 빌링키 삭제 (DB에서만)
    await db
      .update(subscriptions)
      .set({
        billingKey: null,
        billingKeyIssuedAt: null,
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
`app/api/billing/subscription/change/route.ts`

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
    const { newPlanId, newBillingCycle } = body;

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

    if (subscription.planId === newPlanId && subscription.billingCycle === (newBillingCycle || subscription.billingCycle)) {
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
    await db
      .update(subscriptions)
      .set({
        planId: newPlanId,
        billingCycle: newBillingCycle || subscription.billingCycle,
        updatedAt: new Date(),
      })
      .where(eq(subscriptions.id, subscription.id));

    // 테넌트 tier 업데이트
    await db
      .update(tenants)
      .set({
        tier: newPlanId,
        updatedAt: new Date(),
      })
      .where(eq(tenants.id, tenantId));

    return NextResponse.json({
      success: true,
      message: `${newPlan.nameKo} 플랜으로 변경되었습니다.`,
      newPlan: {
        id: newPlan.id,
        name: newPlan.name,
        nameKo: newPlan.nameKo,
        monthlyPrice: newPlan.monthlyPrice,
        yearlyPrice: newPlan.yearlyPrice,
      },
    });
  } catch (error) {
    console.error('[POST /api/billing/subscription/change]', error);
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
`app/api/billing/subscription/cancel/route.ts`

```typescript
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { subscriptions, tenants } from '@/drizzle/schema';
import { eq } from 'drizzle-orm';
import { getSession } from '@/lib/auth/session';
import { deleteBillingKey } from '@/lib/portone/client';

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
      // PortOne에서 빌링키 삭제 (선택적)
      if (subscription.billingKey) {
        try {
          await deleteBillingKey(subscription.billingKey);
        } catch (e) {
          console.error('[Cancel] 빌링키 삭제 실패:', e);
        }
      }

      // 즉시 취소
      await db
        .update(subscriptions)
        .set({
          status: 'canceled',
          cancelledAt: new Date(),
          cancelReason: reason,
          billingKey: null,
          billingKeyIssuedAt: null,
          updatedAt: new Date(),
        })
        .where(eq(subscriptions.id, subscription.id));

      // 테넌트 tier를 basic으로 변경
      await db
        .update(tenants)
        .set({
          tier: 'basic',
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
        message: `구독이 ${subscription.currentPeriodEnd?.toLocaleDateString('ko-KR')}에 취소됩니다.`,
        cancelAt: subscription.currentPeriodEnd,
      });
    }
  } catch (error) {
    console.error('[POST /api/billing/subscription/cancel]', error);
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
import { payments } from '@/drizzle/schema';
import { eq, desc, sql } from 'drizzle-orm';
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

    const total = Number(totalResult[0]?.count || 0);

    return NextResponse.json({
      payments: paymentList.map(p => ({
        id: p.id,
        paymentId: p.paymentId,
        amount: p.amount,
        currency: p.currency,
        status: p.status,
        payMethod: p.payMethod,
        cardInfo: p.cardInfo,
        receiptUrl: p.receiptUrl,
        failReason: p.failReason,
        paidAt: p.paidAt,
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

## 3.9 PortOne 웹훅 엔드포인트

### 파일
`app/api/billing/webhook/route.ts`

```typescript
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { billingWebhookLogs } from '@/drizzle/schema';
import { eq } from 'drizzle-orm';
import { verifyWebhook, type WebhookEventType } from '@/lib/portone/webhook';
import { inngest } from '@/inngest/client';

export async function POST(request: Request) {
  try {
    // 1. 원본 바디 추출
    const body = await request.text();
    const headers = Object.fromEntries(request.headers.entries());

    // 2. 웹훅 서명 검증
    const verification = await verifyWebhook(body, headers);

    if (!verification.success) {
      console.error('[Webhook] 검증 실패:', verification.error);
      return NextResponse.json(
        { error: verification.error },
        { status: 401 }
      );
    }

    const webhookData = verification.data!;
    const eventType = webhookData.type as WebhookEventType;

    // 3. 웹훅 ID로 멱등성 체크 (PortOne은 webhookId 제공)
    const webhookId = webhookData.webhookId;

    if (webhookId) {
      const existing = await db
        .select()
        .from(billingWebhookLogs)
        .where(eq(billingWebhookLogs.webhookId, webhookId))
        .limit(1);

      if (existing.length > 0) {
        console.log('[Webhook] 중복 이벤트 무시:', webhookId);
        return NextResponse.json({ status: 'already_processed' });
      }
    }

    // 4. 웹훅 로그 저장
    const [log] = await db
      .insert(billingWebhookLogs)
      .values({
        webhookId,
        eventType,
        payload: webhookData,
        processed: false,
      })
      .returning();

    // 5. Inngest로 비동기 처리 위임
    await inngest.send({
      name: 'billing/webhook.process',
      data: {
        logId: log.id,
        eventType,
        payload: webhookData,
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
- [ ] `app/api/billing/billing-key/prepare/route.ts` - 빌링키 발급 준비
- [ ] `app/api/billing/billing-key/save/route.ts` - 빌링키 저장
- [ ] `app/api/billing/billing-key/route.ts` (DELETE) - 결제 수단 삭제
- [ ] `app/api/billing/subscription/change/route.ts` - 플랜 변경
- [ ] `app/api/billing/subscription/cancel/route.ts` - 구독 취소
- [ ] `app/api/billing/payments/route.ts` - 결제 내역 조회
- [ ] `app/api/billing/webhook/route.ts` - PortOne 웹훅 수신
- [ ] 모든 API에 admin 권한 검증 적용
- [ ] 에러 핸들링 및 로깅
- [ ] API 테스트

---

## 다음 단계

Phase 3 완료 후 [Phase 4: Inngest 함수](./phase-4-inngest.md)로 진행합니다.
