/**
 * Phase 5: A/B 테스트 및 품질 검증 - 품질 집계 함수
 *
 * 전략별 청크 품질 메트릭을 집계하고 A/B 테스트 결과를 분석합니다.
 *
 * @see docs/testplans/phase5-ab-test-quality-validation.md
 */

import { db, chunks } from '@/lib/db';
import { sql, eq, and, gte, lte, inArray } from 'drizzle-orm';
import type {
  QualityMetrics,
  ABTestResult,
  ABTestRecommendation,
  OverallQualityStats,
  ExperimentVariant,
} from '@/types/experiment';

// 클라이언트/서버 공용 상수 re-export (하위 호환성 유지)
export {
  MIN_SAMPLE_SIZE,
  SIGNIFICANCE_THRESHOLD,
  getQualityGrade,
  QUALITY_GRADE_LABELS,
  RECOMMENDATION_MESSAGES,
} from './quality-constants';

/**
 * Raw SQL 결과 행 타입
 */
interface RawMetricRow {
  strategy: string;
  variant: string | null;
  total_chunks: number;
  avg_quality: number;
  auto_approved_rate: number;
  excellent: number;
  good: number;
  fair: number;
  poor: number;
}

/**
 * 전략별 품질 메트릭 조회
 *
 * chunks 테이블에서 전략별로 품질 점수를 집계합니다.
 * metadata JSONB 필드의 chunkingStrategy, experimentVariant를 기준으로 그룹핑합니다.
 *
 * @param chatbotId - 챗봇 ID
 * @param dateRange - 조회 기간 (선택)
 * @returns 전략별 품질 메트릭 배열
 *
 * @example
 * ```typescript
 * const metrics = await getQualityMetricsByStrategy('chatbot-123');
 * // [
 * //   { strategy: 'smart', variant: 'control', avgQualityScore: 72.5, ... },
 * //   { strategy: 'semantic', variant: 'treatment', avgQualityScore: 78.3, ... }
 * // ]
 * ```
 */
export async function getQualityMetricsByStrategy(
  chatbotId: string,
  dateRange?: { from: Date; to: Date }
): Promise<QualityMetrics[]> {
  // 먼저 chatbotId로 해당 챗봇의 데이터셋들을 찾아야 함
  // chunks는 datasetId를 가지고 있고, chatbots와 datasets는 chatbotDatasets로 연결됨
  // 여기서는 단순화를 위해 chunks.metadata에 chatbotId가 저장되어 있다고 가정하거나
  // 또는 데이터셋을 통해 조회

  // Raw SQL로 전략별 집계 (PostgreSQL 호환)
  const result = await db.execute(sql`
    WITH chatbot_chunks AS (
      SELECT c.*
      FROM chunks c
      INNER JOIN chatbot_datasets cd ON c.dataset_id = cd.dataset_id
      WHERE cd.chatbot_id = ${chatbotId}
        ${
          dateRange
            ? sql`AND c.created_at >= ${dateRange.from} AND c.created_at <= ${dateRange.to}`
            : sql``
        }
    )
    SELECT
      COALESCE(metadata->>'chunkingStrategy', 'unknown') as strategy,
      metadata->>'experimentVariant' as variant,
      COUNT(*)::int as total_chunks,
      COALESCE(AVG(quality_score), 0)::float as avg_quality,
      COALESCE(
        SUM(CASE WHEN auto_approved THEN 1 ELSE 0 END)::float /
        NULLIF(COUNT(*), 0),
        0
      ) as auto_approved_rate,
      COALESCE(SUM(CASE WHEN quality_score >= 85 THEN 1 ELSE 0 END), 0)::int as excellent,
      COALESCE(SUM(CASE WHEN quality_score >= 70 AND quality_score < 85 THEN 1 ELSE 0 END), 0)::int as good,
      COALESCE(SUM(CASE WHEN quality_score >= 50 AND quality_score < 70 THEN 1 ELSE 0 END), 0)::int as fair,
      COALESCE(SUM(CASE WHEN quality_score < 50 THEN 1 ELSE 0 END), 0)::int as poor
    FROM chatbot_chunks
    GROUP BY strategy, variant
    ORDER BY strategy, variant
  `);

  // Drizzle execute() returns the rows directly as an array
  return transformResults(result as unknown as RawMetricRow[]);
}

/**
 * 데이터셋 ID 기준 품질 메트릭 조회
 *
 * 특정 데이터셋의 청크 품질을 집계합니다.
 *
 * @param datasetId - 데이터셋 ID
 * @param dateRange - 조회 기간 (선택)
 * @returns 전략별 품질 메트릭 배열
 */
export async function getQualityMetricsByDataset(
  datasetId: string,
  dateRange?: { from: Date; to: Date }
): Promise<QualityMetrics[]> {
  const result = await db.execute(sql`
    SELECT
      COALESCE(metadata->>'chunkingStrategy', 'unknown') as strategy,
      metadata->>'experimentVariant' as variant,
      COUNT(*)::int as total_chunks,
      COALESCE(AVG(quality_score), 0)::float as avg_quality,
      COALESCE(
        SUM(CASE WHEN auto_approved THEN 1 ELSE 0 END)::float /
        NULLIF(COUNT(*), 0),
        0
      ) as auto_approved_rate,
      COALESCE(SUM(CASE WHEN quality_score >= 85 THEN 1 ELSE 0 END), 0)::int as excellent,
      COALESCE(SUM(CASE WHEN quality_score >= 70 AND quality_score < 85 THEN 1 ELSE 0 END), 0)::int as good,
      COALESCE(SUM(CASE WHEN quality_score >= 50 AND quality_score < 70 THEN 1 ELSE 0 END), 0)::int as fair,
      COALESCE(SUM(CASE WHEN quality_score < 50 THEN 1 ELSE 0 END), 0)::int as poor
    FROM chunks
    WHERE dataset_id = ${datasetId}
      ${
        dateRange
          ? sql`AND created_at >= ${dateRange.from} AND created_at <= ${dateRange.to}`
          : sql``
      }
    GROUP BY strategy, variant
    ORDER BY strategy, variant
  `);

  // Drizzle execute() returns the rows directly as an array
  return transformResults(result as unknown as RawMetricRow[]);
}

/**
 * Raw SQL 결과를 QualityMetrics 배열로 변환
 */
function transformResults(rows: RawMetricRow[]): QualityMetrics[] {
  return rows.map((row) => ({
    strategy: row.strategy,
    variant: row.variant as ExperimentVariant | null,
    totalChunks: row.total_chunks,
    avgQualityScore: Math.round(row.avg_quality * 100) / 100,
    autoApprovedRate: Math.round(row.auto_approved_rate * 1000) / 1000,
    scoreDistribution: {
      excellent: row.excellent,
      good: row.good,
      fair: row.fair,
      poor: row.poor,
    },
  }));
}

// 상수는 quality-constants.ts에서 re-export됨
import {
  MIN_SAMPLE_SIZE,
  SIGNIFICANCE_THRESHOLD,
} from './quality-constants';

/**
 * A/B 테스트 결과 분석
 *
 * 대조군과 처리군의 품질 메트릭을 비교하여 분석 결과를 반환합니다.
 *
 * @param control - 대조군 메트릭
 * @param treatment - 처리군 메트릭
 * @returns A/B 테스트 분석 결과
 *
 * @example
 * ```typescript
 * const metrics = await getQualityMetricsByStrategy(chatbotId);
 * const control = metrics.find(m => m.variant === 'control');
 * const treatment = metrics.find(m => m.variant === 'treatment');
 *
 * if (control && treatment) {
 *   const result = analyzeABTest(control, treatment);
 *   console.log(result.recommendation); // 'adopt_treatment' | 'keep_control' | 'need_more_data'
 * }
 * ```
 */
export function analyzeABTest(
  control: QualityMetrics,
  treatment: QualityMetrics
): ABTestResult {
  const qualityDelta = treatment.avgQualityScore - control.avgQualityScore;
  const qualityDeltaPercent =
    control.avgQualityScore > 0
      ? (qualityDelta / control.avgQualityScore) * 100
      : 0;

  // 최소 샘플 크기 체크
  const hasEnoughData =
    control.totalChunks >= MIN_SAMPLE_SIZE &&
    treatment.totalChunks >= MIN_SAMPLE_SIZE;

  // 유의성 판단 (간단한 휴리스틱: 2점 이상 차이)
  const isSignificant =
    hasEnoughData && Math.abs(qualityDelta) > SIGNIFICANCE_THRESHOLD;

  // 권장 조치 결정
  let recommendation: ABTestRecommendation;
  if (!hasEnoughData) {
    recommendation = 'need_more_data';
  } else if (qualityDelta > SIGNIFICANCE_THRESHOLD) {
    recommendation = 'adopt_treatment';
  } else {
    recommendation = 'keep_control';
  }

  return {
    controlMetrics: control,
    treatmentMetrics: treatment,
    qualityDelta: Math.round(qualityDelta * 100) / 100,
    qualityDeltaPercent: Math.round(qualityDeltaPercent * 100) / 100,
    isSignificant,
    recommendation,
    hasEnoughData,
    minSampleSize: MIN_SAMPLE_SIZE,
  };
}

/**
 * 전체 챗봇 품질 요약 조회
 *
 * 대시보드용 전체 통계를 반환합니다.
 *
 * @param chatbotId - 챗봇 ID
 * @returns 전체 품질 통계
 */
export async function getOverallQualityStats(
  chatbotId: string
): Promise<OverallQualityStats> {
  const metrics = await getQualityMetricsByStrategy(chatbotId);

  if (metrics.length === 0) {
    return {
      totalChunks: 0,
      avgQualityScore: 0,
      autoApprovedRate: 0,
      hasExperiment: false,
    };
  }

  const totalChunks = metrics.reduce((sum, m) => sum + m.totalChunks, 0);
  const weightedSum = metrics.reduce(
    (sum, m) => sum + m.avgQualityScore * m.totalChunks,
    0
  );
  const avgQualityScore = totalChunks > 0 ? weightedSum / totalChunks : 0;

  const approvedSum = metrics.reduce(
    (sum, m) => sum + m.autoApprovedRate * m.totalChunks,
    0
  );
  const autoApprovedRate = totalChunks > 0 ? approvedSum / totalChunks : 0;

  const hasExperiment = metrics.some((m) => m.variant !== null);

  // 전략별 청크 수 계산
  const strategyBreakdown: Record<string, number> = {};
  for (const metric of metrics) {
    const key = metric.strategy;
    strategyBreakdown[key] = (strategyBreakdown[key] || 0) + metric.totalChunks;
  }

  return {
    totalChunks,
    avgQualityScore: Math.round(avgQualityScore * 100) / 100,
    autoApprovedRate: Math.round(autoApprovedRate * 1000) / 1000,
    hasExperiment,
    strategyBreakdown,
  };
}

/**
 * A/B 테스트 결과 추출 (메트릭 배열에서)
 *
 * @param metrics - 전략별 메트릭 배열
 * @returns A/B 테스트 결과 (control/treatment 모두 있는 경우) 또는 null
 */
export function extractABTestResult(
  metrics: QualityMetrics[]
): ABTestResult | null {
  const control = metrics.find((m) => m.variant === 'control');
  const treatment = metrics.find((m) => m.variant === 'treatment');

  if (!control || !treatment) {
    return null;
  }

  return analyzeABTest(control, treatment);
}

// getQualityGrade, QUALITY_GRADE_LABELS, RECOMMENDATION_MESSAGES는
// quality-constants.ts에서 정의되고 상단에서 re-export됨
