/**
 * Phase 5: A/B 테스트 및 품질 검증
 *
 * 청킹 실험 설정 및 품질 메트릭 타입 정의
 *
 * @see docs/testplans/phase5-ab-test-quality-validation.md
 */

/**
 * 청킹 전략 타입
 *
 * - smart: 규칙 기반 청킹 (기존)
 * - semantic: AI 의미 기반 청킹 (Claude Haiku 사용)
 * - late: Late Chunking (문서 전체 임베딩 후 청크별 풀링)
 * - auto: 환경변수 기반 자동 선택
 */
export type ChunkingStrategy = 'smart' | 'semantic' | 'late' | 'auto';

/**
 * A/B 테스트 변형 타입
 *
 * - control: 대조군 (기존 전략, 주로 smart)
 * - treatment: 처리군 (신규 전략, 주로 semantic)
 */
export type ExperimentVariant = 'control' | 'treatment';

/**
 * 청킹 실험 설정
 *
 * chatbots.experimentConfig JSONB 필드에 저장됨
 */
export interface ExperimentConfig {
  /** 청킹 전략 */
  chunkingStrategy: ChunkingStrategy;

  /** A/B 테스트 활성화 */
  abTestEnabled: boolean;

  /** semantic 트래픽 비율 (0-100), A/B 테스트 시 사용 */
  semanticTrafficPercent?: number;

  /** 실험 시작일 (ISO 8601 형식) */
  experimentStartedAt?: string;

  /** 실험 종료일 (ISO 8601 형식) */
  experimentEndedAt?: string;

  /** 실험 메모 */
  experimentNote?: string;
}

/**
 * 기본 실험 설정
 */
export const DEFAULT_EXPERIMENT_CONFIG: ExperimentConfig = {
  chunkingStrategy: 'auto',
  abTestEnabled: false,
  semanticTrafficPercent: 50,
};

/**
 * 점수 분포 구간
 */
export interface ScoreDistribution {
  /** 85점 이상 (우수) */
  excellent: number;
  /** 70-84점 (양호) */
  good: number;
  /** 50-69점 (보통) */
  fair: number;
  /** 50점 미만 (미흡) */
  poor: number;
}

/**
 * 전략별 품질 메트릭
 */
export interface QualityMetrics {
  /** 청킹 전략 */
  strategy: string;

  /** A/B 테스트 변형 (null = A/B 테스트 아님) */
  variant: ExperimentVariant | null;

  /** 총 청크 수 */
  totalChunks: number;

  /** 평균 품질 점수 (0-100) */
  avgQualityScore: number;

  /** 자동 승인율 (0-1) */
  autoApprovedRate: number;

  /** 점수 분포 */
  scoreDistribution: ScoreDistribution;
}

/**
 * A/B 테스트 권장 조치
 *
 * - adopt_treatment: 처리군(신규 전략) 채택 권장
 * - keep_control: 대조군(기존 전략) 유지 권장
 * - need_more_data: 더 많은 데이터 필요 (최소 샘플 미달)
 */
export type ABTestRecommendation =
  | 'adopt_treatment'
  | 'keep_control'
  | 'need_more_data';

/**
 * A/B 테스트 분석 결과
 */
export interface ABTestResult {
  /** 대조군(기존 전략) 메트릭 */
  controlMetrics: QualityMetrics;

  /** 처리군(신규 전략) 메트릭 */
  treatmentMetrics: QualityMetrics;

  /** 품질 점수 차이 (treatment - control) */
  qualityDelta: number;

  /** 품질 점수 차이 백분율 */
  qualityDeltaPercent: number;

  /** 통계적 유의성 여부 */
  isSignificant: boolean;

  /** 권장 조치 */
  recommendation: ABTestRecommendation;

  /** 샘플 크기 충분 여부 */
  hasEnoughData: boolean;

  /** 최소 필요 샘플 수 */
  minSampleSize: number;
}

/**
 * 전체 품질 통계 요약
 */
export interface OverallQualityStats {
  /** 총 청크 수 */
  totalChunks: number;

  /** 평균 품질 점수 */
  avgQualityScore: number;

  /** 자동 승인율 */
  autoApprovedRate: number;

  /** A/B 실험 진행 중 여부 */
  hasExperiment: boolean;

  /** 전략별 청크 수 */
  strategyBreakdown?: Record<string, number>;
}

/**
 * 품질 메트릭 API 응답
 */
export interface QualityMetricsResponse {
  /** 전략별 메트릭 */
  metrics: QualityMetrics[];

  /** A/B 테스트 결과 (있는 경우) */
  abTestResult: ABTestResult | null;

  /** 조회 기간 */
  dateRange: {
    from: string;
    to: string;
  } | null;

  /** 조회 시점 */
  queriedAt: string;
}

/**
 * 청크 메타데이터에 포함되는 실험 정보
 */
export interface ChunkExperimentMetadata {
  /** 사용된 청킹 전략 */
  chunkingStrategy: ChunkingStrategy;

  /** A/B 테스트 변형 (null = A/B 테스트 아님) */
  experimentVariant: ExperimentVariant | null;

  /** 전략 결정 사유 */
  strategyReason: 'global_setting' | 'ab_test' | 'fixed_strategy';
}
