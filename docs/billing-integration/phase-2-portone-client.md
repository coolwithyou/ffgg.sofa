# Phase 2: PortOne 클라이언트 및 유틸리티

## 개요

이 Phase에서는 PortOne V2 API와 통신하기 위한 클라이언트를 구현합니다:
- PortOne 서버 SDK 클라이언트 (백엔드)
- 웹훅 보안 검증
- 주문 ID 생성

## 2.1 의존성 설치

```bash
# PortOne 서버 SDK
pnpm add @portone/server-sdk

# 추가 유틸리티 (이미 설치되어 있을 수 있음)
pnpm add nanoid
```

---

## 2.2 PortOne 서버 클라이언트

### 신규 파일
`lib/portone/client.ts`

```typescript
import * as PortOne from '@portone/server-sdk';
import { billingEnv } from '@/lib/config/billing-env';
import { logger } from '@/lib/logger';

/**
 * PortOne 클라이언트 인스턴스
 *
 * @portone/server-sdk를 사용하여 빌링키 결제 및 결제 조회를 수행합니다.
 */
let portoneClient: ReturnType<typeof PortOne.PortOneClient> | null = null;

/**
 * PortOne 클라이언트를 가져옵니다 (싱글톤)
 */
export function getPortOneClient() {
  if (!portoneClient) {
    portoneClient = PortOne.PortOneClient({
      secret: billingEnv.portone.apiSecret,
    });
  }
  return portoneClient;
}

// ============================================
// 빌링키 관련 API
// ============================================

/**
 * 빌링키 정보를 조회합니다.
 *
 * @param billingKey - PortOne 빌링키
 */
export async function getBillingKeyInfo(billingKey: string) {
  const client = getPortOneClient();

  try {
    const result = await client.billingKey.getBillingKeyInfo({ billingKey });
    return result;
  } catch (error) {
    logger.error('Failed to get billing key info', { billingKey, error });
    throw error;
  }
}

/**
 * 빌링키를 삭제합니다.
 *
 * 구독 취소 시 호출됩니다.
 *
 * @param billingKey - PortOne 빌링키
 */
export async function deleteBillingKey(billingKey: string) {
  const client = getPortOneClient();

  try {
    const result = await client.billingKey.deleteBillingKey({ billingKey });
    logger.info('Billing key deleted', { billingKey });
    return result;
  } catch (error) {
    logger.error('Failed to delete billing key', { billingKey, error });
    throw error;
  }
}

// ============================================
// 결제 관련 API
// ============================================

export interface BillingKeyPaymentParams {
  /** 결제 ID (우리가 생성) */
  paymentId: string;
  /** PortOne 빌링키 */
  billingKey: string;
  /** 주문명 (예: "SOFA Standard 정기결제") */
  orderName: string;
  /** 결제 금액 (원) */
  amount: number;
  /** 통화 (기본값: KRW) */
  currency?: string;
  /** 고객 정보 */
  customer?: {
    id?: string;
    name?: string;
    email?: string;
    phoneNumber?: string;
  };
  /** 메타데이터 */
  customData?: Record<string, unknown>;
}

/**
 * 빌링키로 결제를 요청합니다.
 *
 * 정기결제 시 호출됩니다.
 */
export async function payWithBillingKey(params: BillingKeyPaymentParams) {
  const client = getPortOneClient();

  try {
    const result = await client.payment.payWithBillingKey({
      paymentId: params.paymentId,
      billingKey: params.billingKey,
      orderName: params.orderName,
      amount: { total: params.amount },
      currency: params.currency || 'KRW',
      customer: params.customer,
      customData: params.customData ? JSON.stringify(params.customData) : undefined,
    });

    logger.info('Payment with billing key completed', {
      paymentId: params.paymentId,
      status: result.payment?.status,
    });

    return result;
  } catch (error) {
    logger.error('Payment with billing key failed', {
      paymentId: params.paymentId,
      error,
    });
    throw error;
  }
}

/**
 * 결제 정보를 조회합니다.
 *
 * @param paymentId - 결제 ID
 */
export async function getPayment(paymentId: string) {
  const client = getPortOneClient();

  try {
    const result = await client.payment.getPayment({ paymentId });
    return result;
  } catch (error) {
    logger.error('Failed to get payment', { paymentId, error });
    throw error;
  }
}

/**
 * 결제를 취소합니다.
 *
 * @param paymentId - 결제 ID
 * @param reason - 취소 사유
 * @param amount - 취소 금액 (부분 취소 시)
 */
export async function cancelPayment(
  paymentId: string,
  reason: string,
  amount?: number
) {
  const client = getPortOneClient();

  try {
    const result = await client.payment.cancelPayment({
      paymentId,
      reason,
      amount: amount ? { total: amount } : undefined,
    });

    logger.info('Payment cancelled', { paymentId, reason, amount });
    return result;
  } catch (error) {
    logger.error('Failed to cancel payment', { paymentId, error });
    throw error;
  }
}

// ============================================
// 에러 처리
// ============================================

/**
 * PortOne 에러인지 확인합니다.
 */
export function isPortOneError(error: unknown): error is PortOne.Errors.PortOneError {
  return error instanceof PortOne.Errors.PortOneError;
}

/**
 * 결제 실패 사유를 사용자 친화적인 메시지로 변환합니다.
 */
export function getPaymentFailureMessage(error: unknown): string {
  if (!isPortOneError(error)) {
    return '결제 처리 중 오류가 발생했습니다.';
  }

  // PortOne 에러 코드별 메시지 매핑
  const errorMessages: Record<string, string> = {
    INVALID_BILLING_KEY: '결제 수단이 유효하지 않습니다. 다시 등록해 주세요.',
    BILLING_KEY_NOT_FOUND: '등록된 결제 수단을 찾을 수 없습니다.',
    CARD_DECLINED: '카드 결제가 거절되었습니다. 카드사에 문의하세요.',
    INSUFFICIENT_BALANCE: '잔액이 부족합니다.',
    CARD_LIMIT_EXCEEDED: '카드 한도를 초과했습니다.',
    EXPIRED_CARD: '카드가 만료되었습니다.',
    INVALID_CARD: '유효하지 않은 카드입니다.',
    PAYMENT_ALREADY_CANCELLED: '이미 취소된 결제입니다.',
    PG_PROVIDER_ERROR: '결제 서비스에 일시적인 문제가 있습니다. 잠시 후 다시 시도해 주세요.',
  };

  return errorMessages[error.name] || error.message || '결제 처리 중 오류가 발생했습니다.';
}

/**
 * 재시도 가능한 에러인지 확인합니다.
 */
export function isRetryableError(error: unknown): boolean {
  if (!isPortOneError(error)) {
    return false;
  }

  const retryableErrors = [
    'PG_PROVIDER_ERROR',
    'NETWORK_ERROR',
    'TIMEOUT',
    'RATE_LIMIT_EXCEEDED',
  ];

  return retryableErrors.includes(error.name);
}

// 테스트용 리셋 함수
export function resetPortOneClient(): void {
  portoneClient = null;
}
```

---

## 2.3 웹훅 보안 검증

### 신규 파일
`lib/portone/webhook.ts`

```typescript
import * as PortOne from '@portone/server-sdk';
import { billingEnv } from '@/lib/config/billing-env';
import { logger } from '@/lib/logger';

/**
 * PortOne 웹훅 이벤트 타입
 */
export type WebhookEventType =
  | 'Transaction.Paid'
  | 'Transaction.Failed'
  | 'Transaction.Cancelled'
  | 'Transaction.PartialCancelled'
  | 'Transaction.PayPending'
  | 'Transaction.CancelPending'
  | 'Transaction.Confirmed'
  | 'BillingKey.Issued'
  | 'BillingKey.Deleted';

/**
 * 웹훅 검증 결과
 */
export interface WebhookVerifyResult {
  success: boolean;
  data?: PortOne.Webhook.WebhookEvent;
  error?: string;
}

/**
 * PortOne 웹훅을 검증합니다.
 *
 * @param body - Request body (raw string)
 * @param headers - Request headers
 * @returns 검증 결과
 */
export async function verifyWebhook(
  body: string,
  headers: Record<string, string>
): Promise<WebhookVerifyResult> {
  try {
    const webhookSecret = billingEnv.portone.webhookSecret;

    // PortOne SDK의 웹훅 검증 사용
    const event = await PortOne.Webhook.verify(webhookSecret, body, headers);

    logger.info('Webhook verified successfully', {
      eventType: event.type,
    });

    return {
      success: true,
      data: event,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    logger.warn('Webhook verification failed', { error: errorMessage });

    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Request 객체에서 웹훅을 검증합니다.
 *
 * Next.js API 라우트에서 사용하기 편한 헬퍼입니다.
 */
export async function verifyWebhookFromRequest(
  request: Request
): Promise<WebhookVerifyResult> {
  try {
    const body = await request.text();

    // headers를 Record로 변환
    const headers: Record<string, string> = {};
    request.headers.forEach((value, key) => {
      headers[key] = value;
    });

    return verifyWebhook(body, headers);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to read request';

    logger.error('Failed to verify webhook from request', { error: errorMessage });

    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * 웹훅 이벤트에서 결제 ID를 추출합니다.
 */
export function extractPaymentIdFromEvent(
  event: PortOne.Webhook.WebhookEvent
): string | null {
  // Transaction 관련 이벤트에서 paymentId 추출
  if ('paymentId' in event.data) {
    return event.data.paymentId as string;
  }

  return null;
}

/**
 * 웹훅 이벤트에서 빌링키를 추출합니다.
 */
export function extractBillingKeyFromEvent(
  event: PortOne.Webhook.WebhookEvent
): string | null {
  // BillingKey 관련 이벤트에서 billingKey 추출
  if ('billingKey' in event.data) {
    return event.data.billingKey as string;
  }

  return null;
}
```

---

## 2.4 주문 ID 생성

### 신규 파일
`lib/billing/order-id.ts`

```typescript
import { customAlphabet } from 'nanoid';

/**
 * 주문 ID 생성용 알파벳
 * 대문자와 숫자만 사용하여 가독성 향상
 */
const nanoid = customAlphabet('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ', 12);

/**
 * 결제 ID 접두사 정의
 */
export const PAYMENT_ID_PREFIX = {
  PAYMENT: 'PAY',
  BILLING_KEY: 'BK',
  REFUND: 'RF',
} as const;

/**
 * 결제 ID를 생성합니다.
 *
 * PortOne paymentId로 사용됩니다.
 *
 * 형식: {PREFIX}_{timestamp(base36)}_{random(12)}
 * 예: PAY_1A2B3C4D_ABCD1234EFGH
 *
 * @param prefix - 접두사 (기본값: 'PAY')
 * @returns 생성된 결제 ID
 */
export function generatePaymentId(
  prefix: keyof typeof PAYMENT_ID_PREFIX = 'PAYMENT'
): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = nanoid();

  return `${PAYMENT_ID_PREFIX[prefix]}_${timestamp}_${random}`;
}

/**
 * 빌링키 발급 요청 ID를 생성합니다.
 */
export function generateBillingKeyRequestId(): string {
  return generatePaymentId('BILLING_KEY');
}

/**
 * 환불 ID를 생성합니다.
 */
export function generateRefundId(): string {
  return generatePaymentId('REFUND');
}

/**
 * 결제 ID에서 타임스탬프를 추출합니다.
 *
 * @param paymentId - 결제 ID
 * @returns 타임스탬프 (Date) 또는 null
 */
export function extractTimestampFromPaymentId(paymentId: string): Date | null {
  const parts = paymentId.split('_');

  if (parts.length !== 3) {
    return null;
  }

  const timestampBase36 = parts[1];

  try {
    const timestamp = parseInt(timestampBase36, 36);
    if (isNaN(timestamp)) {
      return null;
    }
    return new Date(timestamp);
  } catch {
    return null;
  }
}

/**
 * 결제 ID가 유효한 형식인지 확인합니다.
 *
 * @param paymentId - 결제 ID
 * @returns 유효 여부
 */
export function isValidPaymentId(paymentId: string): boolean {
  // 기본 형식 검증: PREFIX_TIMESTAMP_RANDOM
  const pattern = /^(PAY|BK|RF)_[A-Z0-9]+_[A-Z0-9]{12}$/;

  if (!pattern.test(paymentId)) {
    return false;
  }

  // 타임스탬프 추출 가능 여부
  const timestamp = extractTimestampFromPaymentId(paymentId);

  if (!timestamp) {
    return false;
  }

  // 미래 시간이 아닌지 확인 (1시간 여유)
  const now = Date.now();
  const oneHourInMs = 60 * 60 * 1000;

  return timestamp.getTime() <= now + oneHourInMs;
}

/**
 * 정기결제 주문명을 생성합니다.
 *
 * @param planName - 플랜 이름
 * @param periodStart - 결제 시작 기간
 * @returns 주문명
 *
 * @example
 * generateOrderName('스탠다드', new Date('2024-01-15'))
 * // "SOFA 스탠다드 정기결제 (2024년 1월)"
 */
export function generateOrderName(planName: string, periodStart: Date): string {
  const year = periodStart.getFullYear();
  const month = periodStart.getMonth() + 1;

  return `SOFA ${planName} 정기결제 (${year}년 ${month}월)`;
}

/**
 * 빌링키 발급용 주문명을 생성합니다.
 *
 * @param planName - 플랜 이름
 * @returns 주문명
 */
export function generateBillingKeyOrderName(planName: string): string {
  return `SOFA ${planName} 정기결제 등록`;
}
```

---

## 2.5 타입 익스포트

### 신규 파일
`lib/portone/index.ts`

```typescript
// Client
export {
  getPortOneClient,
  getBillingKeyInfo,
  deleteBillingKey,
  payWithBillingKey,
  getPayment,
  cancelPayment,
  isPortOneError,
  getPaymentFailureMessage,
  isRetryableError,
  type BillingKeyPaymentParams,
} from './client';

// Webhook
export {
  verifyWebhook,
  verifyWebhookFromRequest,
  extractPaymentIdFromEvent,
  extractBillingKeyFromEvent,
  type WebhookEventType,
  type WebhookVerifyResult,
} from './webhook';
```

### 신규 파일
`lib/billing/index.ts`

```typescript
// Order ID
export {
  generatePaymentId,
  generateBillingKeyRequestId,
  generateRefundId,
  extractTimestampFromPaymentId,
  isValidPaymentId,
  generateOrderName,
  generateBillingKeyOrderName,
  PAYMENT_ID_PREFIX,
} from './order-id';

// Types
export * from './types';
```

---

## 체크리스트

- [ ] `@portone/server-sdk` 패키지 설치
- [ ] `nanoid` 패키지 설치 (없는 경우)
- [ ] `lib/portone/client.ts` 구현
  - [ ] PortOne 클라이언트 초기화
  - [ ] `getBillingKeyInfo()` 메서드
  - [ ] `deleteBillingKey()` 메서드
  - [ ] `payWithBillingKey()` 메서드
  - [ ] `getPayment()` 메서드
  - [ ] `cancelPayment()` 메서드
  - [ ] 에러 처리 유틸리티
- [ ] `lib/portone/webhook.ts` 구현
  - [ ] PortOne 웹훅 서명 검증
  - [ ] Request 헬퍼 함수
  - [ ] 이벤트 데이터 추출 함수
- [ ] `lib/billing/order-id.ts` 구현
  - [ ] 결제 ID 생성
  - [ ] 주문명 생성
- [ ] 인덱스 파일 생성

---

## 사용 예시

### 빌링키 결제 요청

```typescript
import { payWithBillingKey } from '@/lib/portone';
import { generatePaymentId, generateOrderName } from '@/lib/billing';

const paymentId = generatePaymentId();
const orderName = generateOrderName('스탠다드', new Date());

const result = await payWithBillingKey({
  paymentId,
  billingKey: subscription.billingKey,
  orderName,
  amount: 29000,
  customer: {
    id: tenant.id,
    name: tenant.name,
    email: user.email,
  },
});

if (result.payment?.status === 'PAID') {
  // 결제 성공 처리
}
```

### 웹훅 검증

```typescript
import { verifyWebhookFromRequest } from '@/lib/portone';

export async function POST(request: Request) {
  const result = await verifyWebhookFromRequest(request);

  if (!result.success) {
    return new Response('Invalid webhook', { status: 401 });
  }

  const event = result.data!;

  switch (event.type) {
    case 'Transaction.Paid':
      // 결제 완료 처리
      break;
    case 'Transaction.Failed':
      // 결제 실패 처리
      break;
  }

  return new Response('OK');
}
```

---

## 다음 단계

Phase 2 완료 후 [Phase 3: API 엔드포인트](./phase-3-api-endpoints.md)로 진행합니다.
