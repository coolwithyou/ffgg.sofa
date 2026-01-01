/**
 * 문서 처리 관련 상수 및 유틸리티
 * [Week 10] Stalled 문서 감지
 */

/**
 * 문서 처리 상수
 */
export const DOCUMENT_CONSTANTS = {
  /** Stalled 판단 기준 시간 (5분) */
  STALLED_THRESHOLD_MS: 5 * 60 * 1000,
  /** 폴링 간격 (3초) */
  POLLING_INTERVAL_MS: 3000,
  /** 재처리 가능한 상태 */
  REPROCESSABLE_STATUSES: ['uploaded', 'failed'] as const,
} as const;

/**
 * 문서가 중단(stalled) 상태인지 확인
 *
 * @description
 * - processing 상태에서 5분 이상 updatedAt이 갱신되지 않으면 stalled로 판단
 * - Inngest 작업은 각 step마다 updatedAt을 갱신하므로, 5분 미갱신은 비정상
 *
 * @param status - 문서 상태
 * @param updatedAt - 마지막 업데이트 시각
 * @returns stalled 여부
 */
export function isDocumentStalled(
  status: string,
  updatedAt: Date | string | null | undefined
): boolean {
  // processing 상태가 아니면 stalled 아님
  if (status !== 'processing') {
    return false;
  }

  // updatedAt이 없으면 stalled로 간주 (데이터 누락)
  if (!updatedAt) {
    return true;
  }

  const updateTime =
    typeof updatedAt === 'string' ? new Date(updatedAt).getTime() : updatedAt.getTime();

  // NaN 체크
  if (isNaN(updateTime)) {
    return true;
  }

  return Date.now() - updateTime > DOCUMENT_CONSTANTS.STALLED_THRESHOLD_MS;
}

/**
 * 문서가 재처리 가능한지 확인
 *
 * @param status - 문서 상태
 * @param updatedAt - 마지막 업데이트 시각 (stalled 판단용)
 * @returns 재처리 가능 여부
 */
export function canReprocessDocument(
  status: string,
  updatedAt?: Date | string | null
): boolean {
  // 기본 재처리 가능 상태
  if (DOCUMENT_CONSTANTS.REPROCESSABLE_STATUSES.includes(status as 'uploaded' | 'failed')) {
    return true;
  }

  // stalled 상태도 재처리 가능
  if (isDocumentStalled(status, updatedAt)) {
    return true;
  }

  return false;
}

/**
 * 문서 상태 표시용 레이블 반환
 *
 * @param status - 원래 상태
 * @param isStalled - stalled 여부
 * @returns 표시할 상태 문자열
 */
export function getDocumentStatusLabel(status: string, isStalled: boolean): string {
  if (isStalled) {
    return '중단됨';
  }

  const labels: Record<string, string> = {
    uploaded: '업로드됨',
    processing: '처리중',
    chunked: '청킹완료',
    reviewing: '검토중',
    approved: '승인됨',
    failed: '실패',
  };

  return labels[status] || status;
}
