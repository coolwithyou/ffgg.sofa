# Phase 2: 토스 페이먼츠 클라이언트 및 보안

## 개요

이 Phase에서는 토스 페이먼츠 API와 통신하기 위한 클라이언트를 구현합니다:
- 토스 API 클라이언트 (서버사이드)
- 웹훅 보안 검증
- 에러 코드 매핑

## 2.1 토스 API 클라이언트

### 신규 파일
`lib/toss/client.ts`

```typescript
import { TossBillingKeyResponse, TossPaymentResponse, TossErrorResponse } from './types';

const TOSS_API_BASE_URL = 'https://api.tosspayments.com/v1';

/**
 * 토스페이먼츠 API 클라이언트
 *
 * 모든 API 호출은 Basic Auth를 사용합니다.
 * Authorization: Basic base64(secretKey:)
 */
class TossPaymentsClient {
  private secretKey: string;
  private authHeader: string;

  constructor() {
    const secretKey = process.env.TOSS_SECRET_KEY;
    if (!secretKey) {
      throw new Error('TOSS_SECRET_KEY 환경변수가 설정되지 않았습니다.');
    }
    this.secretKey = secretKey;
    // 토스는 secretKey: 형태로 인코딩 (비밀번호 부분은 비움)
    this.authHeader = `Basic ${Buffer.from(`${secretKey}:`).toString('base64')}`;
  }

  /**
   * 토스 API 호출 헬퍼
   */
  private async request<T>(
    method: 'GET' | 'POST' | 'DELETE',
    endpoint: string,
    body?: object
  ): Promise<T> {
    const url = `${TOSS_API_BASE_URL}${endpoint}`;

    const response = await fetch(url, {
      method,
      headers: {
        'Authorization': this.authHeader,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const data = await response.json();

    if (!response.ok) {
      const error = data as TossErrorResponse;
      throw new TossPaymentError(error.code, error.message, response.status);
    }

    return data as T;
  }

  // ============================================
  // 빌링키 관련 API
  // ============================================

  /**
   * 빌링키를 발급합니다.
   *
   * 프론트엔드에서 requestBillingAuth 후 받은 authKey로 호출합니다.
   *
   * @param authKey - 인증 완료 후 받은 키
   * @param customerKey - 고객 식별자 (우리 시스템에서 생성)
   */
  async issueBillingKey(
    authKey: string,
    customerKey: string
  ): Promise<TossBillingKeyResponse> {
    return this.request<TossBillingKeyResponse>(
      'POST',
      '/billing/authorizations/issue',
      { authKey, customerKey }
    );
  }

  /**
   * 빌링키로 자동결제를 실행합니다.
   *
   * @param billingKey - 발급받은 빌링키
   * @param orderId - 주문 ID (SOFA_{timestamp}_{random} 형식)
   * @param orderName - 주문명 (예: "SOFA Standard 월간 구독")
   * @param amount - 결제 금액 (원)
   * @param customerEmail - 고객 이메일 (영수증 발송용)
   * @param customerName - 고객명
   */
  async chargeBillingKey(params: {
    billingKey: string;
    orderId: string;
    orderName: string;
    amount: number;
    customerEmail?: string;
    customerName?: string;
  }): Promise<TossPaymentResponse> {
    const { billingKey, ...body } = params;

    return this.request<TossPaymentResponse>(
      'POST',
      `/billing/${billingKey}`,
      {
        ...body,
        currency: 'KRW',
      }
    );
  }

  // ============================================
  // 결제 관리 API
  // ============================================

  /**
   * 결제를 조회합니다.
   */
  async getPayment(paymentKey: string): Promise<TossPaymentResponse> {
    return this.request<TossPaymentResponse>(
      'GET',
      `/payments/${paymentKey}`
    );
  }

  /**
   * 결제를 취소합니다.
   *
   * @param paymentKey - 결제 키
   * @param cancelReason - 취소 사유
   * @param cancelAmount - 부분 취소 금액 (생략 시 전액 취소)
   */
  async cancelPayment(params: {
    paymentKey: string;
    cancelReason: string;
    cancelAmount?: number;
  }): Promise<TossPaymentResponse> {
    return this.request<TossPaymentResponse>(
      'POST',
      `/payments/${params.paymentKey}/cancel`,
      {
        cancelReason: params.cancelReason,
        cancelAmount: params.cancelAmount,
      }
    );
  }

  /**
   * 주문 ID로 결제를 조회합니다.
   */
  async getPaymentByOrderId(orderId: string): Promise<TossPaymentResponse> {
    return this.request<TossPaymentResponse>(
      'GET',
      `/payments/orders/${orderId}`
    );
  }
}

/**
 * 토스 결제 에러 클래스
 */
export class TossPaymentError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number
  ) {
    super(message);
    this.name = 'TossPaymentError';
  }

  /**
   * 재시도 가능한 에러인지 확인
   */
  get isRetryable(): boolean {
    return RETRYABLE_ERROR_CODES.includes(this.code);
  }

  /**
   * 사용자에게 표시할 메시지
   */
  get userMessage(): string {
    return ERROR_MESSAGES[this.code] || this.message;
  }
}

// 재시도 가능한 에러 코드
const RETRYABLE_ERROR_CODES = [
  'PROVIDER_ERROR',           // 카드사 일시 오류
  'EXCEED_MAX_CARD_PAYMENT',  // 일시적 한도 초과
  'NETWORK_ERROR',            // 네트워크 오류
];

// 에러 메시지 매핑 (phase-2-toss-client.md의 에러 매핑 섹션 참조)
const ERROR_MESSAGES: Record<string, string> = {};

// 싱글톤 인스턴스
let clientInstance: TossPaymentsClient | null = null;

/**
 * 토스 페이먼츠 클라이언트 인스턴스를 반환합니다.
 */
export function getTossClient(): TossPaymentsClient {
  if (!clientInstance) {
    clientInstance = new TossPaymentsClient();
  }
  return clientInstance;
}

// 테스트용 리셋 함수
export function resetTossClient(): void {
  clientInstance = null;
}
```

---

## 2.2 웹훅 보안

### 신규 파일
`lib/toss/webhook-security.ts`

```typescript
import { createHmac, timingSafeEqual } from 'crypto';

const TIMESTAMP_TOLERANCE_MS = 5 * 60 * 1000; // 5분

/**
 * 토스 웹훅 서명을 검증합니다.
 *
 * 토스 웹훅 헤더:
 * - Toss-Signature: t={timestamp},v1={signature}
 *
 * 서명 생성 방식:
 * HMAC-SHA256(timestamp + '.' + body, secret)
 */
export function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string
): { isValid: boolean; timestamp?: number; error?: string } {
  const secret = process.env.TOSS_WEBHOOK_SECRET;

  if (!secret) {
    return { isValid: false, error: 'TOSS_WEBHOOK_SECRET이 설정되지 않았습니다.' };
  }

  // 서명 헤더 파싱
  const parsed = parseSignatureHeader(signatureHeader);
  if (!parsed) {
    return { isValid: false, error: '잘못된 서명 헤더 형식입니다.' };
  }

  const { timestamp, signature } = parsed;

  // 타임스탬프 검증 (5분 이내)
  const now = Date.now();
  if (Math.abs(now - timestamp) > TIMESTAMP_TOLERANCE_MS) {
    return {
      isValid: false,
      timestamp,
      error: `타임스탬프가 허용 범위를 벗어났습니다. (${Math.abs(now - timestamp)}ms 차이)`
    };
  }

  // 서명 계산
  const payload = `${timestamp}.${rawBody}`;
  const expectedSignature = createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  // 타이밍 공격 방지를 위한 상수 시간 비교
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (signatureBuffer.length !== expectedBuffer.length) {
    return { isValid: false, timestamp, error: '서명이 일치하지 않습니다.' };
  }

  const isValid = timingSafeEqual(signatureBuffer, expectedBuffer);

  return {
    isValid,
    timestamp,
    error: isValid ? undefined : '서명이 일치하지 않습니다.'
  };
}

/**
 * 서명 헤더를 파싱합니다.
 *
 * 형식: t={timestamp},v1={signature}
 */
function parseSignatureHeader(
  header: string
): { timestamp: number; signature: string } | null {
  if (!header) return null;

  const parts: Record<string, string> = {};

  for (const part of header.split(',')) {
    const [key, ...valueParts] = part.split('=');
    if (key && valueParts.length > 0) {
      parts[key.trim()] = valueParts.join('=').trim();
    }
  }

  const timestamp = parseInt(parts['t'], 10);
  const signature = parts['v1'];

  if (isNaN(timestamp) || !signature) {
    return null;
  }

  return { timestamp, signature };
}

/**
 * 토스 IP 화이트리스트 검증 (선택적)
 *
 * 프로덕션 환경에서 추가 보안을 위해 사용할 수 있습니다.
 */
const TOSS_WEBHOOK_IPS = [
  '13.124.81.0/24',
  '43.200.66.0/24',
  // 토스 문서에서 최신 IP 목록 확인 필요
];

export function isValidTossIP(ip: string): boolean {
  // 개발 환경에서는 항상 허용
  if (process.env.NODE_ENV === 'development') {
    return true;
  }

  // IP 범위 체크 구현 (필요 시)
  // 현재는 서명 검증만으로 충분히 안전함
  return true;
}

/**
 * 웹훅 검증 미들웨어 헬퍼
 */
export async function validateTossWebhook(request: Request): Promise<{
  isValid: boolean;
  body?: string;
  error?: string;
}> {
  try {
    const signatureHeader = request.headers.get('Toss-Signature');
    if (!signatureHeader) {
      return { isValid: false, error: 'Toss-Signature 헤더가 없습니다.' };
    }

    const rawBody = await request.text();
    const result = verifyWebhookSignature(rawBody, signatureHeader);

    if (!result.isValid) {
      return { isValid: false, error: result.error };
    }

    return { isValid: true, body: rawBody };
  } catch (error) {
    return {
      isValid: false,
      error: error instanceof Error ? error.message : '웹훅 검증 중 오류 발생'
    };
  }
}
```

---

## 2.3 에러 코드 매핑

### 신규 파일
`lib/toss/error-mapping.ts`

토스 페이먼츠 에러 코드를 사용자 친화적인 메시지로 매핑합니다.

```typescript
/**
 * 토스 에러 코드 → 사용자 메시지 매핑
 */
export const ERROR_MESSAGES: Record<string, string> = {
  // ============================================
  // 일반 에러
  // ============================================
  'INVALID_REQUEST': '잘못된 요청입니다. 다시 시도해 주세요.',
  'UNAUTHORIZED_KEY': '인증에 실패했습니다. 관리자에게 문의하세요.',
  'FORBIDDEN_REQUEST': '권한이 없습니다.',
  'NOT_FOUND_PAYMENT': '결제 정보를 찾을 수 없습니다.',
  'NOT_FOUND_PAYMENT_SESSION': '결제 세션이 만료되었습니다. 다시 시도해 주세요.',

  // ============================================
  // 카드 관련 에러
  // ============================================
  'INVALID_CARD_NUMBER': '카드 번호가 올바르지 않습니다.',
  'INVALID_CARD_EXPIRATION': '카드 유효기간이 올바르지 않습니다.',
  'INVALID_CARD_INSTALLMENT_PLAN': '할부 개월 수가 올바르지 않습니다.',
  'CARD_DECLINED': '카드 결제가 거절되었습니다. 카드사에 문의하세요.',
  'EXCEED_MAX_CARD_INSTALLMENT_PLAN': '할부 한도를 초과했습니다.',
  'NOT_SUPPORTED_CARD_TYPE': '지원하지 않는 카드 종류입니다.',

  // ============================================
  // 잔액/한도 관련 에러
  // ============================================
  'EXCEED_MAX_DAILY_PAYMENT_COUNT': '일일 결제 한도를 초과했습니다.',
  'EXCEED_MAX_PAYMENT_AMOUNT': '결제 금액 한도를 초과했습니다.',
  'EXCEED_MAX_CARD_PAYMENT': '카드 결제 한도를 초과했습니다. 잠시 후 다시 시도해 주세요.',
  'BELOW_MINIMUM_AMOUNT': '최소 결제 금액 미만입니다.',
  'NOT_ENOUGH_BALANCE': '잔액이 부족합니다.',

  // ============================================
  // 빌링키 관련 에러
  // ============================================
  'INVALID_BILLING_KEY': '유효하지 않은 빌링키입니다. 결제 수단을 다시 등록해 주세요.',
  'ALREADY_PROCESSED_BILLING_KEY': '이미 처리된 빌링키입니다.',
  'NOT_FOUND_BILLING_KEY': '빌링키를 찾을 수 없습니다. 결제 수단을 다시 등록해 주세요.',

  // ============================================
  // 시스템 에러
  // ============================================
  'PROVIDER_ERROR': '카드사 시스템 오류입니다. 잠시 후 다시 시도해 주세요.',
  'NETWORK_ERROR': '네트워크 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.',
  'FAILED_PAYMENT_INTERNAL_SYSTEM_PROCESSING': '결제 처리 중 오류가 발생했습니다.',
  'UNKNOWN_ERROR': '알 수 없는 오류가 발생했습니다. 관리자에게 문의하세요.',
};

/**
 * 재시도 가능한 에러 코드
 */
export const RETRYABLE_ERROR_CODES = new Set([
  'PROVIDER_ERROR',
  'EXCEED_MAX_CARD_PAYMENT',
  'NETWORK_ERROR',
  'FAILED_PAYMENT_INTERNAL_SYSTEM_PROCESSING',
]);

/**
 * 에러 코드가 재시도 가능한지 확인
 */
export function isRetryableError(code: string): boolean {
  return RETRYABLE_ERROR_CODES.has(code);
}

/**
 * 에러 코드에 해당하는 사용자 메시지 반환
 */
export function getUserErrorMessage(code: string, defaultMessage?: string): string {
  return ERROR_MESSAGES[code] || defaultMessage || '결제 처리 중 오류가 발생했습니다.';
}

/**
 * 에러 코드 분류
 */
export type ErrorCategory =
  | 'card'      // 카드 정보 관련
  | 'limit'     // 한도 관련
  | 'billing'   // 빌링키 관련
  | 'system'    // 시스템 오류
  | 'auth'      // 인증 관련
  | 'unknown';

export function getErrorCategory(code: string): ErrorCategory {
  if (code.includes('CARD') || code.includes('INSTALLMENT')) return 'card';
  if (code.includes('EXCEED') || code.includes('BALANCE') || code.includes('AMOUNT')) return 'limit';
  if (code.includes('BILLING')) return 'billing';
  if (code.includes('PROVIDER') || code.includes('NETWORK') || code.includes('INTERNAL')) return 'system';
  if (code.includes('UNAUTHORIZED') || code.includes('FORBIDDEN')) return 'auth';
  return 'unknown';
}

/**
 * 에러에 대한 권장 조치
 */
export function getRecommendedAction(code: string): string {
  const category = getErrorCategory(code);

  switch (category) {
    case 'card':
      return '카드 정보를 확인하거나 다른 카드를 사용해 주세요.';
    case 'limit':
      return '결제 한도를 확인하거나 카드사에 문의해 주세요.';
    case 'billing':
      return '결제 수단을 다시 등록해 주세요.';
    case 'system':
      return '잠시 후 다시 시도해 주세요.';
    case 'auth':
      return '관리자에게 문의해 주세요.';
    default:
      return '문제가 지속되면 고객센터에 문의해 주세요.';
  }
}

/**
 * 에러 응답 포맷
 */
export interface FormattedError {
  code: string;
  message: string;
  userMessage: string;
  category: ErrorCategory;
  isRetryable: boolean;
  recommendedAction: string;
}

export function formatTossError(code: string, originalMessage: string): FormattedError {
  return {
    code,
    message: originalMessage,
    userMessage: getUserErrorMessage(code, originalMessage),
    category: getErrorCategory(code),
    isRetryable: isRetryableError(code),
    recommendedAction: getRecommendedAction(code),
  };
}
```

---

## 2.4 주문 ID 생성

### 신규 파일
`lib/billing/order-id.ts`

토스페이먼츠 주문 ID 규격에 맞는 고유 ID를 생성합니다.

```typescript
import { randomBytes } from 'crypto';

const ORDER_ID_PREFIX = 'SOFA';

/**
 * 토스페이먼츠 주문 ID를 생성합니다.
 *
 * 형식: SOFA_{timestamp}_{random}
 * 예: SOFA_1704067200000_a1b2c3d4
 *
 * 토스 주문 ID 규격:
 * - 6~64자
 * - 영문, 숫자, -, _ 만 허용
 * - 고유해야 함
 */
export function generateOrderId(): string {
  const timestamp = Date.now();
  const random = randomBytes(4).toString('hex');

  return `${ORDER_ID_PREFIX}_${timestamp}_${random}`;
}

/**
 * 주문 ID에서 타임스탬프를 추출합니다.
 */
export function extractTimestampFromOrderId(orderId: string): number | null {
  const parts = orderId.split('_');
  if (parts.length !== 3 || parts[0] !== ORDER_ID_PREFIX) {
    return null;
  }

  const timestamp = parseInt(parts[1], 10);
  return isNaN(timestamp) ? null : timestamp;
}

/**
 * 주문 ID가 유효한 형식인지 확인합니다.
 */
export function isValidOrderId(orderId: string): boolean {
  // 기본 형식 검증
  const pattern = /^SOFA_\d+_[a-f0-9]+$/;
  if (!pattern.test(orderId)) {
    return false;
  }

  // 길이 검증 (6~64자)
  if (orderId.length < 6 || orderId.length > 64) {
    return false;
  }

  // 타임스탬프 추출 가능 여부
  return extractTimestampFromOrderId(orderId) !== null;
}

/**
 * 결제 주문명을 생성합니다.
 *
 * 예: "SOFA Standard 월간 구독 (2024년 1월)"
 */
export function generateOrderName(planName: string, periodStart: Date): string {
  const year = periodStart.getFullYear();
  const month = periodStart.getMonth() + 1;

  return `SOFA ${planName} 월간 구독 (${year}년 ${month}월)`;
}
```

---

## 체크리스트

- [ ] `lib/toss/client.ts` 구현
  - [ ] Basic Auth 설정
  - [ ] `issueBillingKey()` 메서드
  - [ ] `chargeBillingKey()` 메서드
  - [ ] `getPayment()` 메서드
  - [ ] `cancelPayment()` 메서드
  - [ ] `TossPaymentError` 클래스
- [ ] `lib/toss/webhook-security.ts` 구현
  - [ ] HMAC SHA-256 서명 검증
  - [ ] 타임스탬프 검증 (5분 이내)
  - [ ] 타이밍 공격 방지 (timingSafeEqual)
- [ ] `lib/toss/error-mapping.ts` 구현
  - [ ] 에러 코드 → 메시지 매핑
  - [ ] 재시도 가능 여부 판단
  - [ ] 에러 카테고리 분류
- [ ] `lib/billing/order-id.ts` 구현
  - [ ] 주문 ID 생성
  - [ ] 주문명 생성
- [ ] 단위 테스트 작성

---

## 다음 단계

Phase 2 완료 후 [Phase 3: API 엔드포인트](./phase-3-api-endpoints.md)로 진행합니다.
