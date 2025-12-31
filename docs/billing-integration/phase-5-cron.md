# Phase 5: 크론 작업 (정기결제 트리거)

## 개요

이 Phase에서는 정기결제를 트리거하는 크론 작업을 구현합니다:
- 매일 결제 예정인 구독 처리
- 만료된 구독 상태 전환
- Vercel Cron 설정

## 5.1 정기결제 처리 크론

### 신규 파일
`app/api/cron/billing/check-renewals/route.ts`

매일 자정(UTC)에 실행되어 당일 결제 예정인 구독을 처리합니다.

```typescript
import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { db } from '@/lib/db';
import { subscriptions } from '@/drizzle/schema';
import { eq, and, lte, sql, gte } from 'drizzle-orm';
import { inngest } from '@/inngest/client';

// Vercel Cron 인증
const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(request: Request) {
  try {
    // 인증 확인
    const headersList = headers();
    const authHeader = headersList.get('authorization');

    if (authHeader !== `Bearer ${CRON_SECRET}`) {
      // Vercel Cron의 경우 자동으로 인증됨
      const cronSignature = headersList.get('x-vercel-cron-signature');
      if (!cronSignature && process.env.NODE_ENV === 'production') {
        return NextResponse.json(
          { error: '인증되지 않은 요청입니다.' },
          { status: 401 }
        );
      }
    }

    console.log('[Cron] 정기결제 처리 시작');

    // 오늘 날짜 (UTC 기준 00:00)
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    // 내일 날짜
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // 결제 예정인 활성 구독 조회
    // 조건: status가 active이고, nextPaymentDate가 오늘인 경우
    const dueSubscriptions = await db
      .select()
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.status, 'active'),
          eq(subscriptions.cancelAtPeriodEnd, false),
          gte(subscriptions.nextPaymentDate, today),
          lte(subscriptions.nextPaymentDate, tomorrow)
        )
      );

    console.log(`[Cron] 결제 예정 구독: ${dueSubscriptions.length}건`);

    // 각 구독에 대해 결제 이벤트 발송
    const events = dueSubscriptions.map(sub => ({
      name: 'billing/payment.requested' as const,
      data: {
        subscriptionId: sub.id,
        tenantId: sub.tenantId,
        isFirstPayment: false,
      },
    }));

    if (events.length > 0) {
      await inngest.send(events);
    }

    // 기간 만료 취소 구독 처리
    const cancelledCount = await processCancelledSubscriptions(today);

    return NextResponse.json({
      success: true,
      processed: dueSubscriptions.length,
      cancelled: cancelledCount,
      date: today.toISOString(),
    });
  } catch (error) {
    console.error('[Cron] 정기결제 처리 오류:', error);
    return NextResponse.json(
      { error: '정기결제 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

/**
 * cancelAtPeriodEnd가 true이고 기간이 만료된 구독 처리
 */
async function processCancelledSubscriptions(today: Date): Promise<number> {
  const expiredCancellations = await db
    .select()
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.status, 'active'),
        eq(subscriptions.cancelAtPeriodEnd, true),
        lte(subscriptions.currentPeriodEnd, today)
      )
    );

  if (expiredCancellations.length === 0) {
    return 0;
  }

  console.log(`[Cron] 만료 취소 구독: ${expiredCancellations.length}건`);

  // 상태를 canceled로 변경
  for (const sub of expiredCancellations) {
    await db
      .update(subscriptions)
      .set({
        status: 'canceled',
        billingKey: null,
        billingKeyIssuedAt: null,
        cancelledAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(subscriptions.id, sub.id));
  }

  // 알림 이벤트 발송
  const events = expiredCancellations.map(sub => ({
    name: 'billing/notification.send' as const,
    data: {
      tenantId: sub.tenantId,
      type: 'subscription_expiring' as const,
      metadata: {
        reason: '기간 만료 취소',
      },
    },
  }));

  if (events.length > 0) {
    await inngest.send(events);
  }

  return expiredCancellations.length;
}
```

---

## 5.2 만료 구독 처리 크론

### 신규 파일
`app/api/cron/billing/expire-subscriptions/route.ts`

유예기간이 지난 suspended 구독을 expired 상태로 전환합니다.

```typescript
import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { db } from '@/lib/db';
import { subscriptions, tenants } from '@/drizzle/schema';
import { eq, and, lte } from 'drizzle-orm';
import { inngest } from '@/inngest/client';

const CRON_SECRET = process.env.CRON_SECRET;

// suspended 상태에서 expired로 전환되기까지의 유예기간 (일)
const SUSPENDED_GRACE_PERIOD_DAYS = 30;

export async function GET(request: Request) {
  try {
    // 인증 확인
    const headersList = headers();
    const authHeader = headersList.get('authorization');

    if (authHeader !== `Bearer ${CRON_SECRET}`) {
      const cronSignature = headersList.get('x-vercel-cron-signature');
      if (!cronSignature && process.env.NODE_ENV === 'production') {
        return NextResponse.json(
          { error: '인증되지 않은 요청입니다.' },
          { status: 401 }
        );
      }
    }

    console.log('[Cron] 만료 구독 처리 시작');

    // 유예기간 만료 기준일 계산
    const graceDeadline = new Date();
    graceDeadline.setDate(graceDeadline.getDate() - SUSPENDED_GRACE_PERIOD_DAYS);

    // suspended 상태이고 유예기간이 지난 구독 조회
    const expiredSubscriptions = await db
      .select()
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.status, 'suspended'),
          lte(subscriptions.updatedAt, graceDeadline)
        )
      );

    console.log(`[Cron] 만료 처리 대상: ${expiredSubscriptions.length}건`);

    if (expiredSubscriptions.length === 0) {
      return NextResponse.json({
        success: true,
        expired: 0,
      });
    }

    // expired 상태로 변경 및 tier 다운그레이드
    for (const sub of expiredSubscriptions) {
      await db
        .update(subscriptions)
        .set({
          status: 'expired',
          billingKey: null,
          billingKeyIssuedAt: null,
          updatedAt: new Date(),
        })
        .where(eq(subscriptions.id, sub.id));

      // 테넌트 tier를 basic으로 변경
      await db
        .update(tenants)
        .set({
          tier: 'basic',
          updatedAt: new Date(),
        })
        .where(eq(tenants.id, sub.tenantId));
    }

    // 만료 알림 발송
    const events = expiredSubscriptions.map(sub => ({
      name: 'billing/notification.send' as const,
      data: {
        tenantId: sub.tenantId,
        type: 'subscription_expiring' as const,
        metadata: {
          reason: '유예기간 만료',
          expiredAt: new Date().toISOString(),
        },
      },
    }));

    await inngest.send(events);

    return NextResponse.json({
      success: true,
      expired: expiredSubscriptions.length,
    });
  } catch (error) {
    console.error('[Cron] 만료 처리 오류:', error);
    return NextResponse.json(
      { error: '만료 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
```

---

## 5.3 결제 예정 알림 크론 (선택)

### 신규 파일
`app/api/cron/billing/reminders/route.ts`

결제 3일 전에 미리 알림을 발송합니다.

```typescript
import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { db } from '@/lib/db';
import { subscriptions, plans } from '@/drizzle/schema';
import { eq, and, gte, lte } from 'drizzle-orm';
import { inngest } from '@/inngest/client';

const CRON_SECRET = process.env.CRON_SECRET;
const REMINDER_DAYS_BEFORE = 3;

export async function GET(request: Request) {
  try {
    const headersList = headers();
    const authHeader = headersList.get('authorization');

    if (authHeader !== `Bearer ${CRON_SECRET}`) {
      const cronSignature = headersList.get('x-vercel-cron-signature');
      if (!cronSignature && process.env.NODE_ENV === 'production') {
        return NextResponse.json(
          { error: '인증되지 않은 요청입니다.' },
          { status: 401 }
        );
      }
    }

    console.log('[Cron] 결제 예정 알림 시작');

    // 3일 후 날짜
    const reminderDate = new Date();
    reminderDate.setDate(reminderDate.getDate() + REMINDER_DAYS_BEFORE);
    reminderDate.setUTCHours(0, 0, 0, 0);

    const nextDay = new Date(reminderDate);
    nextDay.setDate(nextDay.getDate() + 1);

    // 3일 후 결제 예정인 구독 조회
    const upcomingSubscriptions = await db
      .select({
        subscription: subscriptions,
        plan: plans,
      })
      .from(subscriptions)
      .leftJoin(plans, eq(subscriptions.planId, plans.id))
      .where(
        and(
          eq(subscriptions.status, 'active'),
          eq(subscriptions.cancelAtPeriodEnd, false),
          gte(subscriptions.nextPaymentDate, reminderDate),
          lte(subscriptions.nextPaymentDate, nextDay)
        )
      );

    console.log(`[Cron] 결제 예정 알림 대상: ${upcomingSubscriptions.length}건`);

    if (upcomingSubscriptions.length === 0) {
      return NextResponse.json({
        success: true,
        reminded: 0,
      });
    }

    // 알림 이벤트 발송
    const events = upcomingSubscriptions.map(({ subscription, plan }) => ({
      name: 'billing/notification.send' as const,
      data: {
        tenantId: subscription.tenantId,
        type: 'subscription_expiring' as const,
        metadata: {
          planName: plan?.nameKo,
          amount: subscription.billingCycle === 'yearly'
            ? plan?.yearlyPrice
            : plan?.monthlyPrice,
          billingDate: subscription.nextPaymentDate?.toISOString(),
        },
      },
    }));

    await inngest.send(events);

    return NextResponse.json({
      success: true,
      reminded: upcomingSubscriptions.length,
    });
  } catch (error) {
    console.error('[Cron] 알림 발송 오류:', error);
    return NextResponse.json(
      { error: '알림 발송 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
```

---

## 5.4 Vercel Cron 설정

### 수정 파일
`vercel.json`

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "crons": [
    {
      "path": "/api/cron/aggregate-response-time",
      "schedule": "5 * * * *"
    },
    {
      "path": "/api/cron/check-performance-alerts",
      "schedule": "*/15 * * * *"
    },
    {
      "path": "/api/cron/billing/check-renewals",
      "schedule": "0 0 * * *"
    },
    {
      "path": "/api/cron/billing/expire-subscriptions",
      "schedule": "0 1 * * *"
    },
    {
      "path": "/api/cron/billing/reminders",
      "schedule": "0 9 * * *"
    }
  ]
}
```

### 스케줄 설명

| 크론 작업 | 스케줄 | 설명 |
|-----------|--------|------|
| check-renewals | `0 0 * * *` | 매일 UTC 00:00 (KST 09:00) |
| expire-subscriptions | `0 1 * * *` | 매일 UTC 01:00 (KST 10:00) |
| reminders | `0 9 * * *` | 매일 UTC 09:00 (KST 18:00) |

---

## 5.5 환경변수 추가

### 수정 파일
`.env.example`

```bash
# ============================================
# 크론 작업 설정
# ============================================

# 크론 작업 인증 시크릿 (개발 환경용)
# Vercel에서는 자동으로 인증됨
CRON_SECRET=your_cron_secret_here
```

---

## 5.6 로컬 테스트 스크립트

### 신규 파일
`scripts/test-billing-cron.ts`

로컬에서 크론 작업을 수동으로 테스트할 수 있는 스크립트입니다.

```typescript
import 'dotenv/config';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
const CRON_SECRET = process.env.CRON_SECRET || 'test-secret';

async function testCronJob(path: string) {
  console.log(`\n🔄 Testing: ${path}`);

  try {
    const response = await fetch(`${BASE_URL}${path}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${CRON_SECRET}`,
      },
    });

    const data = await response.json();

    if (response.ok) {
      console.log('✅ Success:', JSON.stringify(data, null, 2));
    } else {
      console.log('❌ Failed:', JSON.stringify(data, null, 2));
    }
  } catch (error) {
    console.error('💥 Error:', error);
  }
}

async function main() {
  console.log('🚀 빌링 크론 작업 테스트 시작\n');
  console.log(`Base URL: ${BASE_URL}`);

  const cronJobs = [
    '/api/cron/billing/check-renewals',
    '/api/cron/billing/expire-subscriptions',
    '/api/cron/billing/reminders',
  ];

  const targetJob = process.argv[2];

  if (targetJob) {
    // 특정 크론 작업만 테스트
    const path = cronJobs.find(p => p.includes(targetJob));
    if (path) {
      await testCronJob(path);
    } else {
      console.log(`❌ 알 수 없는 크론 작업: ${targetJob}`);
      console.log(`사용 가능한 작업: check-renewals, expire-subscriptions, reminders`);
    }
  } else {
    // 모든 크론 작업 테스트
    for (const path of cronJobs) {
      await testCronJob(path);
    }
  }

  console.log('\n✨ 테스트 완료');
}

main();
```

### package.json 스크립트 추가

```json
{
  "scripts": {
    "test:cron:billing": "tsx scripts/test-billing-cron.ts",
    "test:cron:renewals": "tsx scripts/test-billing-cron.ts check-renewals",
    "test:cron:expire": "tsx scripts/test-billing-cron.ts expire-subscriptions",
    "test:cron:reminders": "tsx scripts/test-billing-cron.ts reminders"
  }
}
```

---

## 5.7 모니터링 및 로깅

### 로그 형식

크론 작업은 다음과 같은 형식으로 로깅합니다:

```
[Cron] 정기결제 처리 시작
[Cron] 결제 예정 구독: 15건
[Cron] 만료 취소 구독: 2건
```

### Vercel 대시보드

Vercel 대시보드에서 크론 작업 실행 상태를 확인할 수 있습니다:
1. Vercel 프로젝트 → Settings → Cron Jobs
2. 각 작업의 실행 기록, 성공/실패 상태, 실행 시간 확인

---

## 체크리스트

- [ ] `app/api/cron/billing/check-renewals/route.ts` 구현
  - [ ] Cron 인증 확인
  - [ ] 당일 결제 예정 구독 조회
  - [ ] Inngest 이벤트 발송
  - [ ] 기간 만료 취소 처리
- [ ] `app/api/cron/billing/expire-subscriptions/route.ts` 구현
  - [ ] 유예기간 초과 suspended 구독 조회
  - [ ] expired 상태 전환
  - [ ] 테넌트 tier 다운그레이드
- [ ] `app/api/cron/billing/reminders/route.ts` 구현 (선택)
- [ ] `vercel.json` 크론 설정 추가
- [ ] 환경변수 설정
- [ ] 로컬 테스트 스크립트 작성
- [ ] Vercel에 배포 후 크론 작업 확인

---

## 다음 단계

Phase 5 완료 후 [Phase 6: 클라이언트 UI](./phase-6-client-ui.md)로 진행합니다.
