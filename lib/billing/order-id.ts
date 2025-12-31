/**
 * 주문/결제 ID 생성
 * [Billing System] PortOne paymentId로 사용되는 고유 ID 생성
 *
 * 형식: PREFIX_TIMESTAMP_RANDOM
 * - PREFIX: 용도별 식별자 (PAY, BK, REF 등)
 * - TIMESTAMP: Base36 인코딩된 타임스탬프
 * - RANDOM: 12자리 랜덤 문자열
 */

import { customAlphabet } from 'nanoid';

/**
 * Base36 문자셋 (0-9, A-Z)
 * 가독성 + URL 안전성 확보
 */
const ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const RANDOM_LENGTH = 12;

const nanoid = customAlphabet(ALPHABET, RANDOM_LENGTH);

/**
 * 결제 ID 생성
 *
 * @param prefix ID 접두사 (기본: 'PAY')
 * @returns 고유 결제 ID
 *
 * @example
 * generatePaymentId() // "PAY_M1A2B3C4_ABCD1234EFGH"
 * generatePaymentId('SUB') // "SUB_M1A2B3C4_ABCD1234EFGH"
 */
export function generatePaymentId(prefix: string = 'PAY'): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = nanoid();
  return `${prefix}_${timestamp}_${random}`;
}

/**
 * 빌링키 발급 요청 ID 생성
 *
 * @returns 빌링키 요청 ID
 *
 * @example
 * generateBillingKeyRequestId() // "BK_M1A2B3C4_ABCD1234EFGH"
 */
export function generateBillingKeyRequestId(): string {
  return generatePaymentId('BK');
}

/**
 * 환불 요청 ID 생성
 *
 * @returns 환불 요청 ID
 *
 * @example
 * generateRefundId() // "REF_M1A2B3C4_ABCD1234EFGH"
 */
export function generateRefundId(): string {
  return generatePaymentId('REF');
}

/**
 * 정기결제 ID 생성 (구독 결제용)
 *
 * @param subscriptionId 구독 ID (UUID의 처음 8자)
 * @returns 정기결제 ID
 *
 * @example
 * generateRecurringPaymentId('a1b2c3d4-...') // "REC_a1b2c3d4_M1A2B3C4_ABCD1234EFGH"
 */
export function generateRecurringPaymentId(subscriptionId: string): string {
  const subPrefix = subscriptionId.slice(0, 8);
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = nanoid();
  return `REC_${subPrefix}_${timestamp}_${random}`;
}

/**
 * ID에서 타임스탬프 추출
 *
 * @param id 결제/빌링키 ID
 * @returns Date 객체 또는 null (파싱 실패 시)
 *
 * @example
 * parseIdTimestamp('PAY_M1A2B3C4_ABCD1234EFGH') // Date object
 */
export function parseIdTimestamp(id: string): Date | null {
  const parts = id.split('_');
  if (parts.length < 2) return null;

  // REC_ prefix의 경우 3번째 파트가 타임스탬프
  const timestampPart = parts[0] === 'REC' ? parts[2] : parts[1];
  if (!timestampPart) return null;

  try {
    const timestamp = parseInt(timestampPart.toLowerCase(), 36);
    if (isNaN(timestamp)) return null;
    return new Date(timestamp);
  } catch {
    return null;
  }
}

/**
 * ID 유효성 검증
 *
 * @param id 검증할 ID
 * @param expectedPrefix 예상 접두사 (선택)
 * @returns 유효 여부
 */
export function isValidPaymentId(id: string, expectedPrefix?: string): boolean {
  if (!id || typeof id !== 'string') return false;

  const parts = id.split('_');
  if (parts.length < 3) return false;

  const [prefix] = parts;

  // 접두사 검증
  if (expectedPrefix && prefix !== expectedPrefix) return false;

  // 타임스탬프 파싱 가능 여부
  const timestamp = parseIdTimestamp(id);
  if (!timestamp) return false;

  // 미래 날짜가 아닌지 검증
  if (timestamp.getTime() > Date.now() + 60000) return false;

  return true;
}
