/**
 * PortOne 웹훅 처리
 * [Billing System] 웹훅 검증 및 페이로드 처리
 *
 * @see https://developers.portone.io/opi/ko/integration/webhook/readme
 */

import { Webhook } from '@portone/server-sdk';
import { billingEnv } from '@/lib/config/billing-env';

// ============================================
// 웹훅 검증
// ============================================

/**
 * PortOne 웹훅 서명 검증
 *
 * @param body 원본 요청 body (string)
 * @param headers 요청 헤더
 * @returns 검증된 웹훅 데이터
 * @throws 검증 실패 시 에러
 */
export async function verifyWebhook(
  body: string,
  headers: Record<string, string>
) {
  return Webhook.verify(
    billingEnv.portone.webhookSecret,
    body,
    headers
  );
}

// ============================================
// 웹훅 이벤트 타입
// ============================================

export type WebhookEventType =
  | 'Transaction.Paid'
  | 'Transaction.Failed'
  | 'Transaction.Cancelled'
  | 'Transaction.PartialCancelled'
  | 'Transaction.VirtualAccountIssued'
  | 'Transaction.Ready'
  | 'BillingKey.Issued'
  | 'BillingKey.Deleted';

// ============================================
// 페이로드 마스킹 (PIPA 준수)
// ============================================

/**
 * 민감정보 필드 목록
 * Gordon PIPA Review: 확장된 민감정보 필드 목록
 */
const SENSITIVE_FIELDS = [
  'email',
  'phone',
  'phonenumber',
  'name',
  'address',
  'billingkey',
  'billing_key',
  'password',
  'token',
  'secret',
  'api_key',
  'apikey',
  'ssn',
  'card_number',
  'cardnumber',
  'cvv',
  'cvc',
  'pin',
  'birth',
  'birthdate',
];

/**
 * 웹훅 페이로드에서 민감정보 마스킹
 *
 * @param payload 원본 페이로드
 * @returns 마스킹된 페이로드 (DB 저장용)
 *
 * @example
 * sanitizeWebhookPayload({ email: 'user@example.com', amount: 1000 })
 * // { email: 'use***', amount: 1000 }
 */
export function sanitizeWebhookPayload(
  payload: Record<string, unknown>
): Record<string, unknown> {
  function maskValue(value: unknown): unknown {
    if (typeof value === 'string') {
      if (value.length <= 3) return '***';
      return value.substring(0, 3) + '***';
    }
    return '[MASKED]';
  }

  function processObject(obj: Record<string, unknown>): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj)) {
      const lowerKey = key.toLowerCase();

      // 민감정보 필드인 경우 마스킹
      if (SENSITIVE_FIELDS.some((field) => lowerKey.includes(field))) {
        result[key] = maskValue(value);
      }
      // 중첩 객체 재귀 처리
      else if (value !== null && typeof value === 'object') {
        if (Array.isArray(value)) {
          result[key] = value.map((item) =>
            typeof item === 'object' && item !== null
              ? processObject(item as Record<string, unknown>)
              : item
          );
        } else {
          result[key] = processObject(value as Record<string, unknown>);
        }
      }
      // 일반 값은 그대로
      else {
        result[key] = value;
      }
    }

    return result;
  }

  return processObject(payload);
}

// ============================================
// 웹훅 이벤트 핸들러 타입
// ============================================

export interface WebhookTransactionData {
  paymentId: string;
  transactionId?: string;
  status: string;
  amount?: {
    total?: number;
    paid?: number;
    cancelled?: number;
  };
  method?: {
    type?: string;
    card?: {
      issuer?: string;
      acquirer?: string;
      number?: string;
      type?: string;
    };
  };
  failReason?: string;
  receiptUrl?: string;
  paidAt?: string;
}

export interface WebhookBillingKeyData {
  billingKey: string;
  pgProvider?: string;
  method?: {
    type?: string;
    card?: {
      issuer?: string;
      number?: string;
    };
  };
}

/**
 * 웹훅 이벤트에서 결제 정보 추출
 */
export function extractTransactionData(
  webhookData: Record<string, unknown>
): WebhookTransactionData | null {
  const data = webhookData.data as Record<string, unknown> | undefined;
  if (!data) return null;

  return {
    paymentId: (data.paymentId as string) || '',
    transactionId: data.transactionId as string | undefined,
    status: (data.status as string) || '',
    amount: data.amount as WebhookTransactionData['amount'],
    method: data.method as WebhookTransactionData['method'],
    failReason: data.failReason as string | undefined,
    receiptUrl: data.receiptUrl as string | undefined,
    paidAt: data.paidAt as string | undefined,
  };
}
