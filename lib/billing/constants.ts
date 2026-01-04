/**
 * 빌링 시스템 상수 정의
 *
 * 플랜 가격, 포인트 패키지 가격 등 금액 관련 상수
 * 모든 금액은 원화(KRW) 기준입니다.
 *
 * @module lib/billing/constants
 */

// ============================================
// 플랜 가격
// ============================================

export const PLAN_PRICES = {
  free: {
    monthly: 0,
    yearly: 0,
  },
  pro: {
    monthly: 50_000, // ₩50,000/월
    yearly: 500_000, // ₩500,000/년 (2개월 할인)
  },
  business: {
    monthly: 150_000, // ₩150,000/월
    yearly: 1_500_000, // ₩1,500,000/년 (2개월 할인)
  },
} as const;

export type PlanId = keyof typeof PLAN_PRICES;

// ============================================
// 포인트 패키지 가격
// ============================================

export const POINT_PACKAGES = {
  points_5000: {
    id: 'points_5000',
    name: '5,000 포인트',
    points: 5_000,
    price: 30_000, // ₩30,000
    pricePerPoint: 6.0, // 6원/P
    discountPercent: 0,
  },
  points_10000: {
    id: 'points_10000',
    name: '10,000 포인트',
    points: 10_000,
    price: 50_000, // ₩50,000
    pricePerPoint: 5.0, // 5원/P
    discountPercent: 17, // 17% 할인
  },
} as const;

export type PointPackageId = keyof typeof POINT_PACKAGES;

// ============================================
// 연간 결제 할인율
// ============================================

export const YEARLY_DISCOUNT_MONTHS = 2; // 연간 결제 시 2개월 할인 (10개월 가격)

// ============================================
// 결제 관련 설정
// ============================================

export const BILLING_CONFIG = {
  currency: 'KRW',
  taxRate: 0.1, // VAT 10%
  minPaymentAmount: 1_000, // 최소 결제 금액 ₩1,000
} as const;
