# Phase 1: 기반 구축 (DB 스키마 및 환경 설정)

## 개요

이 Phase에서는 토스 페이먼츠 정기결제 시스템의 기반을 구축합니다:
- 결제 관련 DB 테이블 설계 및 마이그레이션
- 환경변수 설정
- 빌링키 암호화 유틸리티 구현
- 플랜 시드 데이터 생성

## 1.1 DB 마이그레이션

### 수정 파일
`drizzle/schema.ts`

### 추가할 테이블

#### plans 테이블

플랜 정의를 저장합니다. 기존 `tenants.tier`와 매핑됩니다.

```typescript
import { pgTable, text, integer, jsonb, timestamp } from 'drizzle-orm/pg-core';

export const plans = pgTable('plans', {
  // 플랜 ID - 'basic', 'standard', 'premium'
  id: text('id').primaryKey(),

  // 표시 이름
  name: text('name').notNull(),

  // 월간 가격 (원)
  monthlyPrice: integer('monthly_price').notNull(),

  // tenants.tier와 매핑되는 값
  tier: text('tier').notNull(),

  // 플랜 기능 목록 (마케팅용)
  features: jsonb('features').$type<string[]>().default([]),

  // 플랜 활성화 여부
  isActive: boolean('is_active').default(true),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});
```

#### subscriptions 테이블

테넌트별 구독 상태를 관리합니다. **테넌트당 1개의 구독만 존재**합니다.

```typescript
import { pgTable, uuid, text, timestamp, integer, boolean } from 'drizzle-orm/pg-core';
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

  // 토스 빌링키 (AES-256-GCM 암호화)
  billingKey: text('billing_key'),

  // 마스킹된 카드 정보 (표시용) - 예: "신한 **** **** **** 1234"
  billingKeyMasked: text('billing_key_masked'),

  // 토스 customerKey (고객 식별자)
  customerKey: text('customer_key').unique(),

  // 현재 결제 기간
  currentPeriodStart: timestamp('current_period_start', { withTimezone: true }),
  currentPeriodEnd: timestamp('current_period_end', { withTimezone: true }),

  // 다음 결제 예정일
  nextBillingDate: timestamp('next_billing_date', { withTimezone: true }),

  // 연속 결제 실패 횟수
  failedPaymentCount: integer('failed_payment_count').default(0),

  // 기간 만료 시 취소 여부 (true면 갱신 안 함)
  cancelAtPeriodEnd: boolean('cancel_at_period_end').default(false),

  // 취소 사유 (선택)
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
  'pending',   // 결제 대기
  'paid',      // 결제 완료
  'failed',    // 결제 실패
  'canceled',  // 결제 취소
  'refunded',  // 환불 완료
]);

export const payments = pgTable('payments', {
  id: uuid('id').primaryKey().defaultRandom(),

  // 연결 정보
  tenantId: uuid('tenant_id')
    .notNull()
    .references(() => tenants.id, { onDelete: 'cascade' }),
  subscriptionId: uuid('subscription_id')
    .notNull()
    .references(() => subscriptions.id, { onDelete: 'cascade' }),

  // 주문 ID - 고유값, SOFA_{timestamp}_{random} 형식
  orderId: text('order_id').notNull().unique(),

  // 토스 결제키 (결제 완료 후 발급)
  paymentKey: text('payment_key'),

  // 결제 금액
  amount: integer('amount').notNull(),

  // 결제 상태
  status: paymentStatusEnum('status').notNull().default('pending'),

  // 카드 정보
  cardCompany: text('card_company'),      // 카드사명
  cardNumber: text('card_number'),        // 마스킹된 카드번호
  cardType: text('card_type'),            // 신용/체크

  // 영수증
  receiptUrl: text('receipt_url'),

  // 실패 정보
  failureCode: text('failure_code'),
  failureMessage: text('failure_message'),

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
export const webhookLogStatusEnum = pgEnum('webhook_log_status', [
  'received',   // 수신됨
  'processing', // 처리 중
  'processed',  // 처리 완료
  'failed',     // 처리 실패
]);

export const billingWebhookLogs = pgTable('billing_webhook_logs', {
  id: uuid('id').primaryKey().defaultRandom(),

  // 토스 웹훅 이벤트 ID (멱등성 키)
  eventId: text('event_id').notNull().unique(),

  // 이벤트 타입 - 'PAYMENT_STATUS_CHANGED', 'BILLING_KEY_DELETED' 등
  eventType: text('event_type').notNull(),

  // 처리 상태
  status: webhookLogStatusEnum('status').notNull().default('received'),

  // 원본 페이로드 (디버깅용)
  payload: jsonb('payload'),

  // 에러 메시지 (실패 시)
  errorMessage: text('error_message'),

  // 처리 완료 시간
  processedAt: timestamp('processed_at', { withTimezone: true }),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

// 인덱스 추가
export const billingWebhookLogsEventIdIdx = index('billing_webhook_logs_event_id_idx')
  .on(billingWebhookLogs.eventId);
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
# 토스페이먼츠 설정
# ============================================

# 클라이언트 키 (프론트엔드에서 사용)
# 테스트: test_ck_xxx / 라이브: live_ck_xxx
NEXT_PUBLIC_TOSS_CLIENT_KEY=test_ck_xxx

# 시크릿 키 (서버에서만 사용)
# 테스트: test_sk_xxx / 라이브: live_sk_xxx
TOSS_SECRET_KEY=test_sk_xxx

# 웹훅 시크릿 (토스 대시보드에서 발급)
TOSS_WEBHOOK_SECRET=whsec_xxx

# ============================================
# 빌링키 암호화 설정
# ============================================

# AES-256-GCM 암호화 키 (32바이트 = 64자 hex)
# 생성 방법: openssl rand -hex 32
BILLING_ENCRYPTION_KEY=your_64_character_hex_key_here
```

### 환경변수 검증

`lib/env.ts`에 검증 로직 추가:

```typescript
import { z } from 'zod';

const billingEnvSchema = z.object({
  NEXT_PUBLIC_TOSS_CLIENT_KEY: z.string().min(1),
  TOSS_SECRET_KEY: z.string().min(1),
  TOSS_WEBHOOK_SECRET: z.string().min(1),
  BILLING_ENCRYPTION_KEY: z.string().length(64),
});

export function validateBillingEnv() {
  const result = billingEnvSchema.safeParse(process.env);
  if (!result.success) {
    console.error('❌ 결제 환경변수 오류:', result.error.format());
    throw new Error('결제 환경변수가 올바르게 설정되지 않았습니다.');
  }
  return result.data;
}
```

---

## 1.3 암호화 유틸리티

### 신규 파일
`lib/crypto/billing.ts`

빌링키는 민감한 정보이므로 AES-256-GCM으로 암호화하여 저장합니다.

```typescript
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;  // GCM 권장 IV 길이
const TAG_LENGTH = 16; // 인증 태그 길이

/**
 * 빌링키를 암호화합니다.
 *
 * 형식: base64(iv + ciphertext + authTag)
 */
export function encryptBillingKey(billingKey: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);

  const cipher = createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(billingKey, 'utf8');
  encrypted = Buffer.concat([encrypted, cipher.final()]);

  const authTag = cipher.getAuthTag();

  // iv (12) + encrypted + authTag (16)을 합쳐서 base64 인코딩
  const combined = Buffer.concat([iv, encrypted, authTag]);
  return combined.toString('base64');
}

/**
 * 암호화된 빌링키를 복호화합니다.
 */
export function decryptBillingKey(encryptedData: string): string {
  const key = getEncryptionKey();
  const combined = Buffer.from(encryptedData, 'base64');

  // 데이터 분리
  const iv = combined.subarray(0, IV_LENGTH);
  const authTag = combined.subarray(combined.length - TAG_LENGTH);
  const encrypted = combined.subarray(IV_LENGTH, combined.length - TAG_LENGTH);

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted);
  decrypted = Buffer.concat([decrypted, decipher.final()]);

  return decrypted.toString('utf8');
}

/**
 * 환경변수에서 암호화 키를 가져옵니다.
 */
function getEncryptionKey(): Buffer {
  const keyHex = process.env.BILLING_ENCRYPTION_KEY;

  if (!keyHex || keyHex.length !== 64) {
    throw new Error(
      'BILLING_ENCRYPTION_KEY must be a 64-character hex string (32 bytes)'
    );
  }

  return Buffer.from(keyHex, 'hex');
}

/**
 * 빌링키 암호화가 정상 작동하는지 테스트합니다.
 */
export function testEncryption(): boolean {
  try {
    const testData = 'test_billing_key_12345';
    const encrypted = encryptBillingKey(testData);
    const decrypted = decryptBillingKey(encrypted);
    return testData === decrypted;
  } catch {
    return false;
  }
}
```

### 테스트 코드

`lib/crypto/__tests__/billing.test.ts`

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { encryptBillingKey, decryptBillingKey, testEncryption } from '../billing';

describe('billing encryption', () => {
  beforeEach(() => {
    // 테스트용 키 설정
    process.env.BILLING_ENCRYPTION_KEY =
      'a'.repeat(64); // 32바이트 = 64자 hex
  });

  it('should encrypt and decrypt billing key correctly', () => {
    const originalKey = 'billing_key_abc123xyz';

    const encrypted = encryptBillingKey(originalKey);
    const decrypted = decryptBillingKey(encrypted);

    expect(decrypted).toBe(originalKey);
    expect(encrypted).not.toBe(originalKey);
  });

  it('should produce different ciphertext for same input (random IV)', () => {
    const originalKey = 'billing_key_abc123xyz';

    const encrypted1 = encryptBillingKey(originalKey);
    const encrypted2 = encryptBillingKey(originalKey);

    expect(encrypted1).not.toBe(encrypted2);
  });

  it('should pass self-test', () => {
    expect(testEncryption()).toBe(true);
  });

  it('should fail with invalid key length', () => {
    process.env.BILLING_ENCRYPTION_KEY = 'short_key';

    expect(() => encryptBillingKey('test')).toThrow();
  });
});
```

---

## 1.4 플랜 시드 데이터

### 신규 파일
`drizzle/seed/plans.ts`

```typescript
import { db } from '@/lib/db';
import { plans } from '@/drizzle/schema';

const PLAN_DATA = [
  {
    id: 'basic',
    name: 'Basic',
    monthlyPrice: 13000,
    tier: 'basic',
    features: [
      '챗봇 1개',
      '데이터셋 5개',
      '월 10만 토큰',
      '이메일 지원',
    ],
    isActive: true,
  },
  {
    id: 'standard',
    name: 'Standard',
    monthlyPrice: 65000,
    tier: 'standard',
    features: [
      '챗봇 5개',
      '데이터셋 20개',
      '월 50만 토큰',
      '채팅 지원',
      'API 액세스',
    ],
    isActive: true,
  },
  {
    id: 'premium',
    name: 'Premium',
    monthlyPrice: 260000,
    tier: 'premium',
    features: [
      '무제한 챗봇',
      '무제한 데이터셋',
      '월 200만 토큰',
      '전담 지원',
      'API 액세스',
      '커스텀 통합',
      'SLA 보장',
    ],
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
          monthlyPrice: plan.monthlyPrice,
          tier: plan.tier,
          features: plan.features,
          isActive: plan.isActive,
          updatedAt: new Date(),
        },
      });

    console.log(`  ✓ ${plan.name} (₩${plan.monthlyPrice.toLocaleString()}/월)`);
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

## 1.5 타입 정의

### 신규 파일
`lib/toss/types.ts`

```typescript
// ============================================
// 플랜 관련 타입
// ============================================

export type PlanId = 'basic' | 'standard' | 'premium';

export interface Plan {
  id: PlanId;
  name: string;
  monthlyPrice: number;
  tier: string;
  features: string[];
  isActive: boolean;
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
  billingKeyMasked?: string;
  customerKey?: string;
  currentPeriodStart?: Date;
  currentPeriodEnd?: Date;
  nextBillingDate?: Date;
  failedPaymentCount: number;
  cancelAtPeriodEnd: boolean;
  cancelReason?: string;
}

// ============================================
// 결제 관련 타입
// ============================================

export type PaymentStatus =
  | 'pending'
  | 'paid'
  | 'failed'
  | 'canceled'
  | 'refunded';

export interface Payment {
  id: string;
  tenantId: string;
  subscriptionId: string;
  orderId: string;
  paymentKey?: string;
  amount: number;
  status: PaymentStatus;
  cardCompany?: string;
  cardNumber?: string;
  cardType?: string;
  receiptUrl?: string;
  failureCode?: string;
  failureMessage?: string;
  periodStart?: Date;
  periodEnd?: Date;
  paidAt?: Date;
  failedAt?: Date;
}

// ============================================
// 토스 API 응답 타입
// ============================================

export interface TossBillingKeyResponse {
  mId: string;
  customerKey: string;
  authenticatedAt: string;
  method: string;
  billingKey: string;
  card: {
    issuerCode: string;
    acquirerCode: string;
    number: string;
    cardType: string;
    ownerType: string;
    company: string;
  };
}

export interface TossPaymentResponse {
  mId: string;
  lastTransactionKey: string;
  paymentKey: string;
  orderId: string;
  orderName: string;
  taxExemptionAmount: number;
  status: string;
  requestedAt: string;
  approvedAt: string;
  useEscrow: boolean;
  cultureExpense: boolean;
  card: {
    issuerCode: string;
    acquirerCode: string;
    number: string;
    installmentPlanMonths: number;
    isInterestFree: boolean;
    interestPayer: string | null;
    approveNo: string;
    useCardPoint: boolean;
    cardType: string;
    ownerType: string;
    acquireStatus: string;
    receiptUrl: string;
    amount: number;
    company: string;
  };
  method: string;
  totalAmount: number;
  balanceAmount: number;
  suppliedAmount: number;
  vat: number;
  type: string;
  country: string;
  isPartialCancelable: boolean;
  receipt: {
    url: string;
  };
}

export interface TossErrorResponse {
  code: string;
  message: string;
}

// ============================================
// 웹훅 관련 타입
// ============================================

export interface TossWebhookPayload {
  eventType: string;
  createdAt: string;
  data: {
    paymentKey?: string;
    orderId?: string;
    status?: string;
    billingKey?: string;
    customerKey?: string;
  };
}
```

---

## 체크리스트

- [ ] `drizzle/schema.ts`에 4개 테이블 추가 (plans, subscriptions, payments, billing_webhook_logs)
- [ ] Relations 설정 완료
- [ ] 마이그레이션 생성 및 적용
- [ ] `.env.example` 업데이트
- [ ] 환경변수 검증 로직 추가
- [ ] `lib/crypto/billing.ts` 암호화 유틸리티 구현
- [ ] 암호화 테스트 작성 및 통과
- [ ] `drizzle/seed/plans.ts` 시드 스크립트 작성
- [ ] 플랜 시드 실행 확인
- [ ] `lib/toss/types.ts` 타입 정의 완료

---

## 다음 단계

Phase 1 완료 후 [Phase 2: 토스 클라이언트](./phase-2-toss-client.md)로 진행합니다.
