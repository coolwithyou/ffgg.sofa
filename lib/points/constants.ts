/**
 * 포인트 시스템 상수 정의
 *
 * 모든 포인트 관련 수치를 중앙에서 관리합니다.
 * 비즈니스 로직 변경 시 이 파일만 수정하면 됩니다.
 */

/**
 * 체험 포인트 (가입 시 1회 지급)
 */
export const FREE_TRIAL_POINTS = 500;

/**
 * 1 포인트당 AI 응답 횟수
 * 1P = 1회 응답
 */
export const POINTS_PER_RESPONSE = 1;

/**
 * 티어별 월간 포인트
 */
export const TIER_MONTHLY_POINTS = {
  free: 0,      // Free는 체험 포인트만
  pro: 3000,    // ~300회 응답
  business: 10000, // ~1000회 응답
} as const;

/**
 * 포인트 부족 경고 임계값
 * 이 값 이하면 UI에서 경고 표시
 */
export const LOW_POINTS_THRESHOLD = 100;

/**
 * 포인트 트랜잭션 타입
 */
export const POINT_TRANSACTION_TYPES = {
  /** 플랜 구독으로 인한 월간 포인트 충전 */
  SUBSCRIPTION_CHARGE: 'subscription_charge',
  /** 추가 포인트 구매 */
  PURCHASE: 'purchase',
  /** AI 응답으로 인한 사용 */
  AI_RESPONSE: 'ai_response',
  /** 가입 시 체험 포인트 */
  FREE_TRIAL: 'free_trial',
  /** 환불 */
  REFUND: 'refund',
  /** 관리자 수동 조정 */
  ADMIN_ADJUSTMENT: 'admin_adjustment',
  /** 만료 (미사용) */
  EXPIRE: 'expire',
} as const;

export type PointTransactionType =
  (typeof POINT_TRANSACTION_TYPES)[keyof typeof POINT_TRANSACTION_TYPES];

/**
 * 포인트 패키지 정의
 * 추가 포인트 구매 시 사용
 */
export const POINT_PACKAGES = [
  {
    id: 'points_5000',
    name: '5,000 포인트',
    points: 5000,
    price: 30000, // ₩30,000
    pricePerPoint: 6, // 6원/P
    discount: 0,
  },
  {
    id: 'points_10000',
    name: '10,000 포인트',
    points: 10000,
    price: 50000, // ₩50,000
    pricePerPoint: 5, // 5원/P
    discount: 17, // 17% 할인
  },
] as const;

export type PointPackageId = (typeof POINT_PACKAGES)[number]['id'];
