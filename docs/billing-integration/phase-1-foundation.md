# Phase 1: 기반 구축 (DB 스키마 및 환경 설정)

## 개요

이 Phase에서는 PortOne V2 기반 정기결제 시스템의 기반을 구축합니다:
- 결제 관련 DB 테이블 설계 및 마이그레이션
- 환경변수 설정 (PortOne V2)
- 플랜 시드 데이터 생성

## 1.1 DB 마이그레이션

### 수정 파일
`drizzle/schema.ts`

### 추가할 테이블

#### plans 테이블

플랜 정의를 저장합니다.

```typescript
import { pgTable, text, integer, jsonb, timestamp, boolean } from 'drizzle-orm/pg-core';

export const plans = pgTable('plans', {
  // 플랜 ID - 'basic', 'standard', 'premium'
  id: text('id').primaryKey(),

  // 표시 이름 (영문)
  name: text('name').notNull(),

  // 표시 이름 (한글)
  nameKo: text('name_ko').notNull(),

  // 플랜 설명
  description: text('description'),

  // 월간 가격 (원)
  monthlyPrice: integer('monthly_price').notNull(),

  // 연간 가격 (원, 할인 적용)
  yearlyPrice: integer('yearly_price').notNull(),

  // 플랜 기능 목록 (마케팅용)
  features: jsonb('features').$type<string[]>().default([]),

  // 플랜 제한 설정
  limits: jsonb('limits').$type<{
    maxChatbots: number;
    maxDatasets: number;
    maxDocuments: number;
    maxStorageBytes: number;
    maxMonthlyConversations: number;
  }>(),

  // 플랜 활성화 여부
  isActive: boolean('is_active').default(true),

  // 정렬 순서
  sortOrder: integer('sort_order').default(0),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});
```

#### subscriptions 테이블

테넌트별 구독 상태를 관리합니다. **테넌트당 1개의 구독만 존재**합니다.

```typescript
import { pgTable, uuid, text, timestamp, integer, boolean, pgEnum } from 'drizzle-orm/pg-core';
import { tenants } from './tenants';
import { plans } from './plans';

export const subscriptionStatusEnum = pgEnum('subscription_status', [
  'pending',    // 구독 생성됨, 빌링키 미등록
  'active',     // 정상 활성 상태
  'past_due',   // 결제 실패, 유예기간 중
  'suspended',  // 서비스 일시 정지
  'canceled',   // 사용자 취소
  'expired',    // 유예기간 만료
]);

export const billingCycleEnum = pgEnum('billing_cycle', [
  'monthly',
  'yearly',
]);

export const subscriptions = pgTable('subscriptions', {
  id: uuid('id').primaryKey().defaultRandom(),

  // 테넌트 연결 (1:1 관계)
  tenantId: uuid('tenant_id')
    .notNull()
    .unique()
    .references(() => tenants.id, { onDelete: 'cascade' }),

  // 구독 중인 플랜
  planId: text('plan_id')
    .notNull()
    .references(() => plans.id),

  // 구독 상태
  status: subscriptionStatusEnum('status').notNull().default('pending'),

  // 결제 주기
  billingCycle: billingCycleEnum('billing_cycle').notNull().default('monthly'),

  // PortOne 빌링키 정보
  billingKey: text('billing_key'), // PortOne 발급 빌링키
  billingKeyIssuedAt: timestamp('billing_key_issued_at', { withTimezone: true }),

  // 현재 결제 기간
  currentPeriodStart: timestamp('current_period_start', { withTimezone: true }),
  currentPeriodEnd: timestamp('current_period_end', { withTimezone: true }),

  // 다음 결제 예정일
  nextPaymentDate: timestamp('next_payment_date', { withTimezone: true }),

  // 연속 결제 실패 횟수
  failedPaymentCount: integer('failed_payment_count').default(0),

  // 기간 만료 시 취소 여부 (true면 갱신 안 함)
  cancelAtPeriodEnd: boolean('cancel_at_period_end').default(false),

  // 취소 정보
  cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
  cancelReason: text('cancel_reason'),

  // 마지막 결제 성공 시간
  lastPaymentAt: timestamp('last_payment_at', { withTimezone: true }),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});
```

#### payments 테이블

개별 결제 내역을 저장합니다.

```typescript
export const paymentStatusEnum = pgEnum('payment_status', [
  'pending',          // 결제 대기
  'paid',             // 결제 완료
  'failed',           // 결제 실패
  'cancelled',        // 결제 취소
  'partial_cancelled', // 부분 취소
  'refunded',         // 환불 완료
]);

export const payments = pgTable('payments', {
  id: uuid('id').primaryKey().defaultRandom(),

  // 연결 정보
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'cascade' }),
  subscriptionId: uuid('subscription_id')
    .references(() => subscriptions.id, { onDelete: 'cascade' }),

  // PortOne 결제 정보
  paymentId: text('payment_id').notNull().unique(), // PortOne paymentId
  transactionId: text('transaction_id'), // PortOne transactionId (PG사 거래 ID)

  // 금액 정보
  amount: integer('amount').notNull(),
  currency: text('currency').notNull().default('KRW'),

  // 결제 상태
  status: paymentStatusEnum('status').notNull().default('pending'),
  failReason: text('fail_reason'),

  // 결제 수단
  payMethod: text('pay_method'), // CARD, EASY_PAY 등

  // 카드 정보 (결제 완료 시)
  cardInfo: jsonb('card_info').$type<{
    issuer?: string;      // 발급사
    acquirer?: string;    // 매입사
    number?: string;      // 마스킹된 카드번호
    type?: string;        // 카드 타입 (신용/체크)
  }>(),

  // 영수증
  receiptUrl: text('receipt_url'),

  // 메타데이터
  metadata: jsonb('metadata').$type<Record<string, unknown>>(),

  // 결제 기간 (해당 결제가 커버하는 기간)
  periodStart: timestamp('period_start', { withTimezone: true }),
  periodEnd: timestamp('period_end', { withTimezone: true }),

  // 결제 완료/실패 시간
  paidAt: timestamp('paid_at', { withTimezone: true }),
  failedAt: timestamp('failed_at', { withTimezone: true }),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});
```

#### billing_webhook_logs 테이블

웹훅 멱등성 보장을 위한 로그 테이블입니다.

```typescript
export const billingWebhookLogs = pgTable('billing_webhook_logs', {
  id: uuid('id').primaryKey().defaultRandom(),

  // PortOne 웹훅 정보
  webhookId: text('webhook_id'), // PortOne 웹훅 ID
  eventType: text('event_type').notNull(), // Transaction.Paid, Transaction.Failed 등

  // 페이로드
  payload: jsonb('payload').notNull(),

  // 처리 결과
  processed: boolean('processed').default(false),
  processedAt: timestamp('processed_at', { withTimezone: true }),
  error: text('error'),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// 인덱스 추가
export const billingWebhookLogsWebhookIdIdx = index('billing_webhook_logs_webhook_id_idx')
  .on(billingWebhookLogs.webhookId);
```

### Relations 설정

```typescript
import { relations } from 'drizzle-orm';

export const subscriptionsRelations = relations(subscriptions, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [subscriptions.tenantId],
    references: [tenants.id],
  }),
  plan: one(plans, {
    fields: [subscriptions.planId],
    references: [plans.id],
  }),
  payments: many(payments),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  tenant: one(tenants, {
    fields: [payments.tenantId],
    references: [tenants.id],
  }),
  subscription: one(subscriptions, {
    fields: [payments.subscriptionId],
    references: [subscriptions.id],
  }),
}));

export const plansRelations = relations(plans, ({ many }) => ({
  subscriptions: many(subscriptions),
}));
```

### 마이그레이션 실행

```bash
# 마이그레이션 생성
pnpm drizzle-kit generate

# 마이그레이션 적용
pnpm drizzle-kit push
```

---

## 1.2 환경변수 설정

### 수정 파일
`.env.example`

### 추가할 환경변수

```bash
# ============================================
# PortOne V2 설정
# ============================================

# Store ID (PortOne 콘솔에서 확인)
PORTONE_STORE_ID=store-xxxxx

# Channel Key (토스페이먼츠 채널)
# PortOne 콘솔 > 결제 연동 > 채널 관리에서 확인
PORTONE_CHANNEL_KEY=channel-key-xxxxx

# API Secret (V2 API 인증용)
# PortOne 콘솔 > API 키 관리에서 발급
PORTONE_API_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Webhook Secret (웹훅 서명 검증용)
# PortOne 콘솔 > 웹훅 설정에서 확인
PORTONE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxx

# ============================================
# Cron 인증
# ============================================

# Vercel Cron 인증용 시크릿
CRON_SECRET=xxxxx
```

### 환경변수 검증 유틸리티

`lib/config/billing-env.ts`

```typescript
import { z } from 'zod';

/**
 * 빌링 환경변수 스키마
 */
const billingEnvSchema = z.object({
  PORTONE_STORE_ID: z.string().min(1, 'PORTONE_STORE_ID is required'),
  PORTONE_CHANNEL_KEY: z.string().min(1, 'PORTONE_CHANNEL_KEY is required'),
  PORTONE_API_SECRET: z.string().min(1, 'PORTONE_API_SECRET is required'),
  PORTONE_WEBHOOK_SECRET: z.string().min(1, 'PORTONE_WEBHOOK_SECRET is required'),
  CRON_SECRET: z.string().optional(),
});

type BillingEnv = z.infer<typeof billingEnvSchema>;

let cachedEnv: BillingEnv | null = null;

/**
 * 빌링 환경변수를 검증하고 반환합니다.
 *
 * @throws {Error} 필수 환경변수가 누락된 경우
 */
export function validateBillingEnv(): BillingEnv {
  if (cachedEnv) return cachedEnv;

  const result = billingEnvSchema.safeParse(process.env);

  if (!result.success) {
    const errors = result.error.format();
    console.error('❌ 빌링 환경변수 오류:', JSON.stringify(errors, null, 2));
    throw new Error('빌링 환경변수가 올바르게 설정되지 않았습니다.');
  }

  cachedEnv = result.data;
  return cachedEnv;
}

/**
 * 빌링 환경변수 헬퍼 객체
 */
export const billingEnv = {
  get portone() {
    const env = validateBillingEnv();
    return {
      storeId: env.PORTONE_STORE_ID,
      channelKey: env.PORTONE_CHANNEL_KEY,
      apiSecret: env.PORTONE_API_SECRET,
      webhookSecret: env.PORTONE_WEBHOOK_SECRET,
    };
  },

  get billing() {
    return {
      retryAttempts: 3,
      retryDelayDays: [1, 3, 7], // 재시도 간격
      gracePeriodDays: 7,
    };
  },
} as const;

/**
 * 빌링 환경변수가 설정되어 있는지 확인합니다.
 * (에러를 던지지 않고 boolean 반환)
 */
export function isBillingConfigured(): boolean {
  const result = billingEnvSchema.safeParse(process.env);
  return result.success;
}
```

---

## 1.3 플랜 시드 데이터

### 신규 파일
`drizzle/seed/plans.ts`

```typescript
import { db } from '@/lib/db';
import { plans } from '@/drizzle/schema';

const PLAN_DATA = [
  {
    id: 'basic',
    name: 'Basic',
    nameKo: '베이직',
    description: '개인 및 소규모 팀을 위한 플랜',
    monthlyPrice: 0, // 무료
    yearlyPrice: 0,
    features: [
      '챗봇 1개',
      '데이터셋 1개',
      '문서 10개',
      '저장공간 100MB',
      '월 1,000회 대화',
    ],
    limits: {
      maxChatbots: 1,
      maxDatasets: 1,
      maxDocuments: 10,
      maxStorageBytes: 104857600, // 100MB
      maxMonthlyConversations: 1000,
    },
    sortOrder: 0,
    isActive: true,
  },
  {
    id: 'standard',
    name: 'Standard',
    nameKo: '스탠다드',
    description: '성장하는 비즈니스를 위한 플랜',
    monthlyPrice: 29000,
    yearlyPrice: 290000, // 2개월 할인
    features: [
      '챗봇 3개',
      '데이터셋 5개',
      '문서 100개',
      '저장공간 1GB',
      '월 10,000회 대화',
      'API 액세스',
    ],
    limits: {
      maxChatbots: 3,
      maxDatasets: 5,
      maxDocuments: 100,
      maxStorageBytes: 1073741824, // 1GB
      maxMonthlyConversations: 10000,
    },
    sortOrder: 1,
    isActive: true,
  },
  {
    id: 'premium',
    name: 'Premium',
    nameKo: '프리미엄',
    description: '대규모 비즈니스를 위한 플랜',
    monthlyPrice: 99000,
    yearlyPrice: 990000, // 2개월 할인
    features: [
      '챗봇 10개',
      '데이터셋 20개',
      '문서 500개',
      '저장공간 10GB',
      '월 100,000회 대화',
      'API 액세스',
      '우선 지원',
    ],
    limits: {
      maxChatbots: 10,
      maxDatasets: 20,
      maxDocuments: 500,
      maxStorageBytes: 10737418240, // 10GB
      maxMonthlyConversations: 100000,
    },
    sortOrder: 2,
    isActive: true,
  },
] as const;

export async function seedPlans() {
  console.log('🌱 Seeding plans...');

  for (const plan of PLAN_DATA) {
    await db
      .insert(plans)
      .values(plan)
      .onConflictDoUpdate({
        target: plans.id,
        set: {
          name: plan.name,
          nameKo: plan.nameKo,
          description: plan.description,
          monthlyPrice: plan.monthlyPrice,
          yearlyPrice: plan.yearlyPrice,
          features: plan.features,
          limits: plan.limits,
          isActive: plan.isActive,
          sortOrder: plan.sortOrder,
          updatedAt: new Date(),
        },
      });

    const priceStr = plan.monthlyPrice === 0
      ? '무료'
      : `₩${plan.monthlyPrice.toLocaleString()}/월`;
    console.log(`  ✓ ${plan.nameKo} (${priceStr})`);
  }

  console.log('✅ Plans seeded successfully');
}

// 직접 실행 시
if (require.main === module) {
  seedPlans()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
```

### 시드 스크립트 등록

`package.json`에 스크립트 추가:

```json
{
  "scripts": {
    "db:seed:plans": "tsx drizzle/seed/plans.ts"
  }
}
```

---

## 1.4 타입 정의

### 신규 파일
`lib/billing/types.ts`

```typescript
// ============================================
// 플랜 관련 타입
// ============================================

export type PlanId = 'basic' | 'standard' | 'premium';

export type BillingCycle = 'monthly' | 'yearly';

export interface PlanLimits {
  maxChatbots: number;
  maxDatasets: number;
  maxDocuments: number;
  maxStorageBytes: number;
  maxMonthlyConversations: number;
}

export interface Plan {
  id: PlanId;
  name: string;
  nameKo: string;
  description: string | null;
  monthlyPrice: number;
  yearlyPrice: number;
  features: string[];
  limits: PlanLimits | null;
  isActive: boolean;
  sortOrder: number;
}

// ============================================
// 구독 관련 타입
// ============================================

export type SubscriptionStatus =
  | 'pending'    // 빌링키 미등록
  | 'active'     // 정상
  | 'past_due'   // 결제 실패 유예기간
  | 'suspended'  // 서비스 정지
  | 'canceled'   // 취소됨
  | 'expired';   // 만료됨

export interface Subscription {
  id: string;
  tenantId: string;
  planId: PlanId;
  status: SubscriptionStatus;
  billingCycle: BillingCycle;
  billingKey?: string | null;
  billingKeyIssuedAt?: Date | null;
  currentPeriodStart?: Date | null;
  currentPeriodEnd?: Date | null;
  nextPaymentDate?: Date | null;
  failedPaymentCount: number;
  cancelAtPeriodEnd: boolean;
  cancelledAt?: Date | null;
  cancelReason?: string | null;
}

// ============================================
// 결제 관련 타입
// ============================================

export type PaymentStatus =
  | 'pending'
  | 'paid'
  | 'failed'
  | 'cancelled'
  | 'partial_cancelled'
  | 'refunded';

export interface CardInfo {
  issuer?: string;
  acquirer?: string;
  number?: string;
  type?: string;
}

export interface Payment {
  id: string;
  tenantId: string;
  subscriptionId?: string | null;
  paymentId: string;
  transactionId?: string | null;
  amount: number;
  currency: string;
  status: PaymentStatus;
  failReason?: string | null;
  payMethod?: string | null;
  cardInfo?: CardInfo | null;
  receiptUrl?: string | null;
  periodStart?: Date | null;
  periodEnd?: Date | null;
  paidAt?: Date | null;
  failedAt?: Date | null;
}

// ============================================
// PortOne 관련 타입
// ============================================

export interface PortOnePaymentResult {
  status: 'PAID' | 'FAILED' | 'CANCELLED';
  paymentId: string;
  transactionId?: string;
  paidAt?: string;
  failReason?: string;
  receiptUrl?: string;
  card?: {
    issuer?: string;
    acquirer?: string;
    number?: string;
    type?: string;
  };
}

// ============================================
// 웹훅 관련 타입
// ============================================

export type WebhookEventType =
  | 'Transaction.Paid'
  | 'Transaction.Failed'
  | 'Transaction.Cancelled'
  | 'Transaction.PartialCancelled'
  | 'BillingKey.Issued'
  | 'BillingKey.Deleted';

export interface WebhookPayload {
  type: WebhookEventType;
  timestamp: string;
  data: {
    paymentId?: string;
    transactionId?: string;
    billingKey?: string;
    [key: string]: unknown;
  };
}
```

---

## 체크리스트

- [ ] `drizzle/schema.ts`에 4개 테이블 추가 (plans, subscriptions, payments, billing_webhook_logs)
- [ ] pgEnum 추가 (subscription_status, billing_cycle, payment_status)
- [ ] Relations 설정 완료
- [ ] 마이그레이션 생성 및 적용
- [ ] `.env.example` 업데이트 (PortOne 환경변수)
- [ ] `lib/config/billing-env.ts` 환경변수 검증 로직 추가
- [ ] `drizzle/seed/plans.ts` 시드 스크립트 작성
- [ ] 플랜 시드 실행 확인
- [ ] `lib/billing/types.ts` 타입 정의 완료

---

## 다음 단계

Phase 1 완료 후 [Phase 2: PortOne 클라이언트](./phase-2-portone-client.md)로 진행합니다.
