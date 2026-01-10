/**
 * Phase 5: 품질 관련 상수 및 유틸리티
 *
 * 클라이언트/서버 모두에서 사용 가능한 순수 상수와 함수만 포함합니다.
 * DB 접근 등 서버 전용 코드는 quality-metrics.ts에 있습니다.
 */

import type { ABTestRecommendation } from '@/types/experiment';

/**
 * 최소 샘플 크기 (A/B 테스트 유의성 판단용)
 */
export const MIN_SAMPLE_SIZE = 100;

/**
 * 유의미한 품질 차이 임계값 (점수)
 */
export const SIGNIFICANCE_THRESHOLD = 2;

/**
 * 품질 등급 반환
 *
 * @param score - 품질 점수 (0-100)
 * @returns 등급 (excellent | good | fair | poor)
 */
export function getQualityGrade(
  score: number
): 'excellent' | 'good' | 'fair' | 'poor' {
  if (score >= 85) return 'excellent';
  if (score >= 70) return 'good';
  if (score >= 50) return 'fair';
  return 'poor';
}

/**
 * 품질 등급 한글 이름
 */
export const QUALITY_GRADE_LABELS: Record<string, string> = {
  excellent: '우수',
  good: '양호',
  fair: '보통',
  poor: '미흡',
};

/**
 * A/B 테스트 권장 조치 한글 메시지
 */
export const RECOMMENDATION_MESSAGES: Record<ABTestRecommendation, string> = {
  adopt_treatment: '✅ Semantic 전략 채택 권장',
  keep_control: '⚪ 현재 전략 유지 권장',
  need_more_data: '⏳ 더 많은 데이터 필요',
};
