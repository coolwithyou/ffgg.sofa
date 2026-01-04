/**
 * 포인트 검증 유틸리티
 *
 * AI 응답 전 포인트 잔액 검증 및 에러 처리를 담당합니다.
 */

import { getPointBalance, hasEnoughPoints } from './service';
import { POINTS_PER_RESPONSE, LOW_POINTS_THRESHOLD } from './constants';

// ============================================
// 타입 정의
// ============================================

export interface PointValidationResult {
  canProceed: boolean;
  currentBalance: number;
  requiredPoints: number;
  errorCode?: 'INSUFFICIENT_POINTS' | 'POINTS_LOW_WARNING';
  message?: string;
}

// ============================================
// 검증 함수
// ============================================

/**
 * AI 응답 전 포인트 검증
 *
 * @returns 검증 결과 (canProceed: false면 응답 차단)
 */
export async function validatePointsForResponse(
  tenantId: string,
  requiredPoints: number = POINTS_PER_RESPONSE
): Promise<PointValidationResult> {
  const currentBalance = await getPointBalance(tenantId);

  // 포인트 부족
  if (currentBalance < requiredPoints) {
    return {
      canProceed: false,
      currentBalance,
      requiredPoints,
      errorCode: 'INSUFFICIENT_POINTS',
      message: `포인트가 부족합니다. 현재 잔액: ${currentBalance}P, 필요 포인트: ${requiredPoints}P`,
    };
  }

  // 포인트 부족 경고 (진행은 가능)
  if (currentBalance - requiredPoints <= LOW_POINTS_THRESHOLD) {
    return {
      canProceed: true,
      currentBalance,
      requiredPoints,
      errorCode: 'POINTS_LOW_WARNING',
      message: `포인트가 ${currentBalance - requiredPoints}P 남았습니다. 포인트를 충전해주세요.`,
    };
  }

  return {
    canProceed: true,
    currentBalance,
    requiredPoints,
  };
}

/**
 * 빠른 포인트 체크 (boolean 반환)
 */
export async function canUsePoints(
  tenantId: string,
  requiredPoints: number = POINTS_PER_RESPONSE
): Promise<boolean> {
  return hasEnoughPoints(tenantId, requiredPoints);
}

/**
 * 포인트 부족 에러 생성
 *
 * API 응답용 에러 객체 생성
 */
export function createInsufficientPointsError(currentBalance: number) {
  return {
    error: '포인트가 부족합니다',
    code: 'INSUFFICIENT_POINTS',
    details: {
      currentBalance,
      requiredPoints: POINTS_PER_RESPONSE,
      message: '포인트를 충전해주세요.',
    },
  };
}

/**
 * 포인트 부족 경고 헤더 생성
 *
 * 응답에 경고 헤더를 추가할 때 사용
 */
export function createPointsLowWarningHeaders(remainingBalance: number) {
  return {
    'X-Points-Warning': 'low',
    'X-Points-Remaining': remainingBalance.toString(),
  };
}
