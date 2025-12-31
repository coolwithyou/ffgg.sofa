/**
 * PortOne V2 서버 클라이언트
 * [Billing System] 결제 API 호출을 위한 클라이언트
 *
 * @see https://developers.portone.io/opi/ko/integration/start/v2/readme
 */

import { PortOneClient, type PortOneClient as PortOneClientType } from '@portone/server-sdk';
import { billingEnv } from '@/lib/config/billing-env';

/**
 * PortOne 클라이언트 인스턴스 (lazy initialization)
 */
let _client: PortOneClientType | null = null;

export function getPortOneClient(): PortOneClientType {
  if (!_client) {
    _client = PortOneClient({
      secret: billingEnv.portone.apiSecret,
    });
  }
  return _client;
}

// ============================================
// 빌링키 관련 API
// ============================================

export interface BillingKeyPaymentParams {
  paymentId: string;
  billingKey: string;
  orderName: string;
  amount: number;
  currency?: string;
  customer?: {
    id?: string;
    name?: string; // 내부에서 { full: name } 형태로 변환
    email?: string;
    phoneNumber?: string;
  };
}

/**
 * CustomerInput 형태로 변환 (PortOne SDK 호환)
 */
function toCustomerInput(customer?: BillingKeyPaymentParams['customer']) {
  if (!customer) return undefined;

  return {
    id: customer.id,
    name: customer.name ? { full: customer.name } : undefined,
    email: customer.email,
    phoneNumber: customer.phoneNumber,
  };
}

/**
 * 빌링키로 결제 요청
 */
export async function requestBillingKeyPayment(params: BillingKeyPaymentParams) {
  const client = getPortOneClient();

  return client.payment.payWithBillingKey({
    paymentId: params.paymentId,
    billingKey: params.billingKey,
    orderName: params.orderName,
    amount: {
      total: params.amount,
    },
    currency: params.currency || 'KRW',
    customer: toCustomerInput(params.customer),
  });
}

/**
 * 결제 정보 조회
 */
export async function getPayment(paymentId: string) {
  const client = getPortOneClient();
  return client.payment.getPayment({ paymentId });
}

/**
 * 빌링키 정보 조회
 */
export async function getBillingKeyInfo(billingKey: string) {
  const client = getPortOneClient();
  return client.payment.billingKey.getBillingKeyInfo({ billingKey });
}

/**
 * 빌링키 삭제 (구독 취소 시 호출)
 */
export async function deleteBillingKey(billingKey: string) {
  const client = getPortOneClient();
  return client.payment.billingKey.deleteBillingKey({ billingKey });
}

// ============================================
// 결제 취소/환불 API
// ============================================

export interface CancelPaymentParams {
  paymentId: string;
  reason: string;
  amount?: number; // 부분 취소 시 금액 지정
}

/**
 * 결제 취소/환불
 */
export async function cancelPayment(params: CancelPaymentParams) {
  const client = getPortOneClient();

  return client.payment.cancelPayment({
    paymentId: params.paymentId,
    reason: params.reason,
    ...(params.amount && { amount: params.amount }),
  });
}

// ============================================
// 유틸리티
// ============================================

/**
 * PortOne 결제 상태를 내부 상태로 변환
 */
export function mapPaymentStatus(
  portoneStatus: string
): 'PAID' | 'FAILED' | 'CANCELLED' | 'REFUNDED' | 'PARTIAL_REFUNDED' | 'PENDING' {
  const statusMap: Record<string, 'PAID' | 'FAILED' | 'CANCELLED' | 'REFUNDED' | 'PARTIAL_REFUNDED' | 'PENDING'> = {
    PAID: 'PAID',
    VIRTUAL_ACCOUNT_ISSUED: 'PENDING',
    FAILED: 'FAILED',
    CANCELLED: 'CANCELLED',
    PARTIAL_CANCELLED: 'PARTIAL_REFUNDED',
    // 추가 상태가 있을 수 있음
  };

  return statusMap[portoneStatus] || 'PENDING';
}

/**
 * PortOne 결제 수단 코드를 한글로 변환
 */
export function getPayMethodLabel(payMethod?: string): string {
  const labels: Record<string, string> = {
    CARD: '카드',
    EASY_PAY: '간편결제',
    TRANSFER: '계좌이체',
    VIRTUAL_ACCOUNT: '가상계좌',
    MOBILE: '휴대폰',
    GIFT_CERTIFICATE: '상품권',
  };

  return labels[payMethod || ''] || payMethod || '알 수 없음';
}
