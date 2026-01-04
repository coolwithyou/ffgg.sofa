/**
 * 토큰 사용량 추적 관련 타입 정의
 */

export type ModelProvider = 'google' | 'openai' | 'anthropic';

export type ModelId =
  | 'gemini-2.5-flash-lite'
  | 'gemini-2.0-flash'
  | 'gpt-4o-mini'
  | 'text-embedding-3-small'
  | 'claude-3-haiku-20240307'
  | (string & {}); // Allow any string for future model IDs

export type FeatureType = 'chat' | 'embedding' | 'rewrite' | 'context_generation' | 'rerank';

export interface TokenUsageParams {
  tenantId: string;
  chatbotId?: string;
  conversationId?: string;
  modelProvider: ModelProvider;
  modelId: ModelId;
  featureType: FeatureType;
  inputTokens: number;
  outputTokens: number;
}

export interface ModelPrice {
  provider: ModelProvider;
  modelId: ModelId;
  displayName: string;
  inputPricePerMillion: number;
  outputPricePerMillion: number;
  isEmbedding: boolean;
}

export interface CostBreakdown {
  inputCostUsd: number;
  outputCostUsd: number;
  totalCostUsd: number;
}

export interface DailyUsage {
  date: Date;
  totalTokens: number;
  totalCostUsd: number;
  byModel: Record<
    string,
    {
      inputTokens: number;
      outputTokens: number;
      totalCostUsd: number;
    }
  >;
}

export interface UsageOverview {
  period: 'today' | 'week' | 'month';
  totalTokens: number;
  totalCostUsd: number;
  inputTokens: number;
  outputTokens: number;
  byModel: Array<{
    provider: ModelProvider;
    modelId: ModelId;
    displayName: string;
    inputTokens: number;
    outputTokens: number;
    totalCostUsd: number;
    percentage: number;
  }>;
  byFeature: Array<{
    featureType: FeatureType;
    totalTokens: number;
    totalCostUsd: number;
    percentage: number;
  }>;
}

export interface Forecast {
  currentMonthUsage: number;
  projectedMonthlyUsage: number;
  daysRemaining: number;
  dailyAverage: number;
  trend: 'increasing' | 'stable' | 'decreasing';
  confidenceLevel: 'high' | 'medium' | 'low';
}

export interface BudgetStatus {
  tenantId: string;
  tier: 'free' | 'pro' | 'business';
  monthlyBudgetUsd: number;
  currentUsageUsd: number;
  usagePercentage: number;
  remainingBudgetUsd: number;
  isOverBudget: boolean;
  alertLevel: 'normal' | 'warning' | 'critical' | 'exceeded';
}

// ============================================================
// AI 인사이트 대시보드 타입 정의
// ============================================================

/**
 * 모델별 토큰 효율성 분석
 * 입력/출력 토큰 비율과 비용 효율성을 분석합니다.
 */
export interface TokenEfficiency {
  modelId: ModelId;
  displayName: string;
  avgInputTokens: number;
  avgOutputTokens: number;
  totalCost: number;
  requestCount: number;
  /** 출력/입력 토큰 비율 (outputTokens / inputTokens) */
  ioRatio: number;
}

/**
 * Feature별 토큰 분포
 * 기능별 토큰 사용량 비율을 분석합니다.
 */
export interface FeatureDistribution {
  featureType: FeatureType;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  percentage: number;
}

/**
 * 일별 캐시 히트율 추이
 * 캐시 효율성을 시계열로 분석합니다.
 */
export interface CacheHitTrend {
  date: string;
  hitRate: number;
  hitCount: number;
  totalCount: number;
}

/**
 * 캐시 비용 비교
 * 캐시 히트/미스 요청 수와 추정 절감 비용을 분석합니다.
 */
export interface CacheCostComparison {
  cachedRequests: number;
  nonCachedRequests: number;
  /** 캐시로 절감한 추정 비용 (USD) */
  estimatedSavings: number;
}

/**
 * 시간대별 사용량 셀 (Heatmap용)
 * 요일×시간 조합별 사용량을 분석합니다.
 */
export interface HourlyUsageCell {
  /** 요일 (0=일요일, 1=월요일, ..., 6=토요일) */
  dayOfWeek: number;
  /** 시간 (0-23) */
  hour: number;
  count: number;
  cost: number;
  /** 0-1 정규화된 강도 (Heatmap 색상용) */
  intensity: number;
}

/**
 * 채널별 사용량
 * 웹/카카오 채널별 일간 사용량을 분석합니다.
 */
export interface ChannelUsage {
  date: string;
  web: number;
  kakao: number;
  total: number;
}

/**
 * 청크 분포
 * RAG 검색에서 사용된 청크 수 분포를 분석합니다.
 */
export interface ChunkDistribution {
  /** 범위 (예: "1-2", "3-4", "5-6", "7-8", "9+") */
  range: string;
  count: number;
  percentage: number;
}

/**
 * 파이프라인 지연시간
 * RAG 파이프라인 각 단계별 평균 지연시간을 분석합니다.
 */
export interface PipelineLatency {
  llmAvgMs: number;
  searchAvgMs: number;
  rewriteAvgMs: number;
  otherAvgMs: number;
  totalAvgMs: number;
}

/**
 * 인사이트 대시보드 데이터
 * 기존 UsageDashboardData를 확장하여 심층 분석 데이터를 포함합니다.
 */
export interface InsightsDashboardData {
  // 기존 대시보드 데이터
  overview: { today: UsageOverview; month: UsageOverview };
  trend: DailyUsage[];
  forecast: Forecast;
  topTenants: Array<{
    tenantId: string;
    tenantName: string;
    totalTokens: number;
    totalCostUsd: number;
  }>;
  budgetStatuses: BudgetStatus[];
  anomalies: Array<{
    tenantId: string;
    tenantName: string;
    todayCost: number;
    yesterdayCost: number;
    increaseRatio: number;
  }>;

  // 새로운 인사이트 데이터
  tokenEfficiency: TokenEfficiency[];
  featureDistribution: FeatureDistribution[];
  cacheHitTrend: CacheHitTrend[];
  cacheCostComparison: CacheCostComparison;
  usageHeatmap: HourlyUsageCell[];
  channelUsage: ChannelUsage[];
  chunkDistribution: ChunkDistribution[];
  pipelineLatency: PipelineLatency;
}
