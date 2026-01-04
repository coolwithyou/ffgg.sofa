/**
 * 포인트 시스템 모듈
 *
 * SOFA 플랫폼의 포인트 기반 과금 시스템 진입점
 *
 * @example
 * // 포인트 잔액 조회
 * import { getPointBalance, getPointBalanceInfo } from '@/lib/points';
 * const balance = await getPointBalance(tenantId);
 * const info = await getPointBalanceInfo(tenantId);
 *
 * @example
 * // AI 응답 전 포인트 검증 및 차감
 * import { validatePointsForResponse, usePoints } from '@/lib/points';
 * const validation = await validatePointsForResponse(tenantId);
 * if (!validation.canProceed) {
 *   return NextResponse.json(createInsufficientPointsError(validation.currentBalance), { status: 402 });
 * }
 * // ... AI 응답 생성 ...
 * await usePoints({ tenantId, metadata: { chatbotId } });
 *
 * @example
 * // 포인트 충전
 * import { chargePoints, POINT_TRANSACTION_TYPES } from '@/lib/points';
 * await chargePoints({
 *   tenantId,
 *   amount: 3000,
 *   type: POINT_TRANSACTION_TYPES.SUBSCRIPTION_CHARGE,
 * });
 */

// 상수
export {
  FREE_TRIAL_POINTS,
  POINTS_PER_RESPONSE,
  TIER_MONTHLY_POINTS,
  LOW_POINTS_THRESHOLD,
  POINT_TRANSACTION_TYPES,
  POINT_PACKAGES,
  type PointTransactionType,
  type PointPackageId,
} from './constants';

// 서비스 함수
export {
  // 조회
  getPointBalance,
  getPointBalanceInfo,
  hasEnoughPoints,
  // 충전
  chargePoints,
  grantFreeTrialPoints,
  // 사용
  usePoints,
  refundPoints,
  // 이력
  getPointTransactions,
  getMonthlyUsage,
  // 타입
  type ChargePointsParams,
  type UsePointsParams,
  type PointBalanceInfo,
  type PointTransactionInfo,
} from './service';

// 검증 유틸리티
export {
  validatePointsForResponse,
  canUsePoints,
  createInsufficientPointsError,
  createPointsLowWarningHeaders,
  type PointValidationResult,
} from './validator';
