/**
 * 토큰 사용량 추적 관련 타입 정의
 */

export type ModelProvider = 'google' | 'openai' | 'anthropic';

export type ModelId =
  | 'gemini-2.5-flash-lite'
  | 'gpt-4o-mini'
  | 'text-embedding-3-small'
  | 'claude-3-haiku-20240307';

export type FeatureType = 'chat' | 'embedding' | 'rewrite' | 'context_generation';

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
  tier: 'basic' | 'standard' | 'premium';
  monthlyBudgetUsd: number;
  currentUsageUsd: number;
  usagePercentage: number;
  remainingBudgetUsd: number;
  isOverBudget: boolean;
  alertLevel: 'normal' | 'warning' | 'critical' | 'exceeded';
}
