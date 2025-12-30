'use client';

/**
 * 비용 분포 차트
 * 모델별/기능별 비용 분포를 파이 차트로 표시합니다.
 */

import type { UsageOverview } from '@/lib/usage/types';

interface CostBreakdownChartProps {
  overview: UsageOverview;
}

const MODEL_COLORS: Record<string, string> = {
  'gemini-2.5-flash-lite': '#4285F4', // Google Blue
  'gpt-4o-mini': '#10A37F', // OpenAI Green
  'text-embedding-3-small': '#FF6B6B', // Coral
};

const FEATURE_COLORS: Record<string, string> = {
  chat: '#8B5CF6', // Purple
  embedding: '#F59E0B', // Amber
  rewrite: '#06B6D4', // Cyan
};

export function CostBreakdownChart({ overview }: CostBreakdownChartProps) {
  const hasModelData = overview.byModel.length > 0;
  const hasFeatureData = overview.byFeature.length > 0;

  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <h2 className="mb-4 text-lg font-semibold text-foreground">비용 분포</h2>

      {!hasModelData && !hasFeatureData ? (
        <div className="flex h-48 items-center justify-center">
          <p className="text-muted-foreground">데이터가 없습니다.</p>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2">
          {/* 모델별 분포 */}
          <div>
            <h3 className="mb-3 text-sm font-medium text-muted-foreground">모델별</h3>
            {hasModelData ? (
              <div className="space-y-2">
                {overview.byModel.map((model) => (
                  <div key={model.modelId} className="flex items-center gap-3">
                    <div
                      className="h-3 w-3 shrink-0 rounded-full"
                      style={{ backgroundColor: MODEL_COLORS[model.modelId] || '#94A3B8' }}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <span className="truncate text-sm text-foreground">
                          {model.displayName}
                        </span>
                        <span className="ml-2 text-sm font-medium text-foreground">
                          ${model.totalCostUsd.toFixed(2)}
                        </span>
                      </div>
                      <div className="mt-1 h-1.5 w-full rounded-full bg-muted">
                        <div
                          className="h-1.5 rounded-full"
                          style={{
                            width: `${model.percentage}%`,
                            backgroundColor: MODEL_COLORS[model.modelId] || '#94A3B8',
                          }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {model.percentage.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">데이터 없음</p>
            )}
          </div>

          {/* 기능별 분포 */}
          <div>
            <h3 className="mb-3 text-sm font-medium text-muted-foreground">기능별</h3>
            {hasFeatureData ? (
              <div className="space-y-2">
                {overview.byFeature.map((feature) => (
                  <div key={feature.featureType} className="flex items-center gap-3">
                    <div
                      className="h-3 w-3 shrink-0 rounded-full"
                      style={{
                        backgroundColor: FEATURE_COLORS[feature.featureType] || '#94A3B8',
                      }}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <span className="truncate text-sm capitalize text-foreground">
                          {getFeatureLabel(feature.featureType)}
                        </span>
                        <span className="ml-2 text-sm font-medium text-foreground">
                          ${feature.totalCostUsd.toFixed(2)}
                        </span>
                      </div>
                      <div className="mt-1 h-1.5 w-full rounded-full bg-muted">
                        <div
                          className="h-1.5 rounded-full"
                          style={{
                            width: `${feature.percentage}%`,
                            backgroundColor: FEATURE_COLORS[feature.featureType] || '#94A3B8',
                          }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {feature.percentage.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">데이터 없음</p>
            )}
          </div>
        </div>
      )}

      {/* 토큰 상세 정보 */}
      {hasModelData && (
        <div className="mt-6 border-t border-border pt-4">
          <h3 className="mb-2 text-sm font-medium text-muted-foreground">토큰 상세</h3>
          <div className="grid gap-2 text-sm sm:grid-cols-2">
            <div className="flex justify-between rounded bg-muted/50 px-3 py-2">
              <span className="text-muted-foreground">입력 토큰</span>
              <span className="font-medium text-foreground">
                {overview.inputTokens.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between rounded bg-muted/50 px-3 py-2">
              <span className="text-muted-foreground">출력 토큰</span>
              <span className="font-medium text-foreground">
                {overview.outputTokens.toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function getFeatureLabel(featureType: string): string {
  switch (featureType) {
    case 'chat':
      return '채팅 응답';
    case 'embedding':
      return '임베딩';
    case 'rewrite':
      return '쿼리 재작성';
    default:
      return featureType;
  }
}
