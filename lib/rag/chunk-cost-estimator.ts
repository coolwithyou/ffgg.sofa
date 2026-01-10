/**
 * AI 시맨틱 청킹 비용 추정 유틸리티
 *
 * 문서 텍스트 길이를 기반으로 AI 청킹에 필요한
 * 포인트, 시간, 청크 수를 추정합니다.
 */

// ============================================================
// 상수
// ============================================================

/**
 * 세그먼트 크기 (문자 수)
 * semantic-chunking.ts의 preChunkSize와 동일
 */
export const SEGMENT_SIZE = 2000;

/**
 * 세그먼트당 포인트 비용
 */
export const POINTS_PER_SEGMENT = 1;

/**
 * 세그먼트당 예상 처리 시간 (초)
 * 배치 처리 + API 응답 시간 고려
 */
export const SECONDS_PER_SEGMENT = 2;

/**
 * 세그먼트당 평균 청크 수
 * 통계적 분석 결과 기반
 */
export const CHUNKS_PER_SEGMENT = 2.5;

/**
 * 최소 포인트 비용
 * 아무리 작은 문서도 최소 1P
 */
export const MIN_POINTS = 1;

// ============================================================
// 타입
// ============================================================

export interface ChunkingCostEstimation {
  /** 예상 청크 수 */
  estimatedChunks: number;
  /** 예상 포인트 소모량 */
  estimatedPoints: number;
  /** 예상 처리 시간 (초) */
  estimatedTime: number;
  /** 세그먼트 수 (AI 호출 횟수) */
  segmentCount: number;
}

// ============================================================
// 함수
// ============================================================

/**
 * AI 시맨틱 청킹 비용을 추정합니다.
 *
 * @param textLength 텍스트 길이 (문자 수)
 * @returns 비용 추정 결과
 *
 * @example
 * ```ts
 * const estimation = estimateChunkingCost(10000);
 * // { estimatedChunks: 13, estimatedPoints: 5, estimatedTime: 10, segmentCount: 5 }
 * ```
 */
export function estimateChunkingCost(textLength: number): ChunkingCostEstimation {
  // 세그먼트 수 계산 (최소 1)
  const segmentCount = Math.max(1, Math.ceil(textLength / SEGMENT_SIZE));

  // 예상 청크 수 (세그먼트당 평균 2.5개)
  const estimatedChunks = Math.ceil(segmentCount * CHUNKS_PER_SEGMENT);

  // 예상 포인트 (최소 1P)
  const estimatedPoints = Math.max(MIN_POINTS, segmentCount * POINTS_PER_SEGMENT);

  // 예상 처리 시간 (초)
  const estimatedTime = Math.ceil(segmentCount * SECONDS_PER_SEGMENT);

  return {
    estimatedChunks,
    estimatedPoints,
    estimatedTime,
    segmentCount,
  };
}

/**
 * 포인트가 충분한지 확인합니다.
 *
 * @param currentBalance 현재 보유 포인트
 * @param textLength 텍스트 길이
 * @returns 충분 여부와 필요 포인트
 */
export function checkPointsSufficiency(
  currentBalance: number,
  textLength: number
): {
  isSufficient: boolean;
  requiredPoints: number;
  shortfall: number;
} {
  const { estimatedPoints } = estimateChunkingCost(textLength);

  return {
    isSufficient: currentBalance >= estimatedPoints,
    requiredPoints: estimatedPoints,
    shortfall: Math.max(0, estimatedPoints - currentBalance),
  };
}

/**
 * 예상 처리 시간을 사람이 읽기 쉬운 형식으로 변환합니다.
 *
 * @param seconds 초
 * @returns 포맷된 문자열
 *
 * @example
 * ```ts
 * formatEstimatedTime(14) // "약 14초"
 * formatEstimatedTime(90) // "약 1분 30초"
 * ```
 */
export function formatEstimatedTime(seconds: number): string {
  if (seconds < 60) {
    return `약 ${seconds}초`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (remainingSeconds === 0) {
    return `약 ${minutes}분`;
  }

  return `약 ${minutes}분 ${remainingSeconds}초`;
}
