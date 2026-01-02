'use client';

/**
 * Feature별 토큰 분포 차트
 * 기능별(chat, embedding, rewrite, context_generation) 토큰 사용량을 수평 막대로 표시합니다.
 */

import type { FeatureDistribution } from '@/lib/usage/types';
import { formatCompactNumber, formatWithCommas } from '@/lib/format';

interface FeatureTokenDistributionProps {
  data: FeatureDistribution[];
}

const FEATURE_COLORS: Record<string, string> = {
  chat: 'oklch(0.65 0.2 280)', // Purple
  embedding: 'oklch(0.7 0.15 85)', // Amber
  rewrite: 'oklch(0.7 0.15 200)', // Cyan
  context_generation: 'oklch(0.65 0.2 330)', // Pink
};

const FEATURE_LABELS: Record<string, string> = {
  chat: '채팅 응답',
  embedding: '임베딩',
  rewrite: '쿼리 재작성',
  context_generation: '컨텍스트 생성',
};

export function FeatureTokenDistribution({ data }: FeatureTokenDistributionProps) {
  if (data.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-6">
        <h3 className="mb-4 text-lg font-semibold text-foreground">Feature별 토큰 분포</h3>
        <div className="flex h-48 items-center justify-center">
          <p className="text-muted-foreground">데이터가 없습니다.</p>
        </div>
      </div>
    );
  }

  // 최대값 계산 (스케일링용)
  const maxTokens = Math.max(...data.map((d) => d.totalTokens), 1);
  const totalTokens = data.reduce((sum, d) => sum + d.totalTokens, 0);

  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">Feature별 토큰 분포</h3>
        <span
          className="text-sm text-muted-foreground"
          title={`${formatWithCommas(totalTokens)} 토큰`}
        >
          총 {formatCompactNumber(totalTokens)} 토큰
        </span>
      </div>

      {/* 수평 막대 차트 */}
      <div className="space-y-4">
        {data.map((feature) => {
          const widthPercent = (feature.totalTokens / maxTokens) * 100;
          const color = FEATURE_COLORS[feature.featureType] || 'oklch(0.5 0 0)';
          const label = FEATURE_LABELS[feature.featureType] || feature.featureType;

          return (
            <div key={feature.featureType} className="group">
              {/* 라벨과 수치 */}
              <div className="mb-1.5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className="h-3 w-3 shrink-0 rounded-full"
                    style={{ backgroundColor: color }}
                  />
                  <span className="text-sm font-medium text-foreground">{label}</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <span
                    className="text-muted-foreground"
                    title={`${formatWithCommas(feature.totalTokens)} 토큰`}
                  >
                    {formatCompactNumber(feature.totalTokens)}
                  </span>
                  <span className="w-12 text-right font-medium text-foreground">
                    {feature.percentage.toFixed(1)}%
                  </span>
                </div>
              </div>

              {/* 막대 */}
              <div className="relative h-6 w-full overflow-hidden rounded-md bg-muted">
                {/* 입력 토큰 (밝은 색) */}
                <div
                  className="absolute left-0 top-0 h-full transition-all group-hover:opacity-80"
                  style={{
                    width: `${(feature.inputTokens / maxTokens) * 100}%`,
                    backgroundColor: color,
                    opacity: 0.5,
                  }}
                />
                {/* 출력 토큰 (진한 색, 입력 위에 겹침) */}
                <div
                  className="absolute left-0 top-0 h-full transition-all group-hover:opacity-80"
                  style={{
                    width: `${(feature.outputTokens / maxTokens) * 100}%`,
                    backgroundColor: color,
                  }}
                />

                {/* 툴팁 */}
                <div className="absolute inset-0 flex items-center justify-end pr-2 opacity-0 transition-opacity group-hover:opacity-100">
                  <div className="rounded bg-foreground px-2 py-0.5 text-xs text-background">
                    입력: {formatCompactNumber(feature.inputTokens)} / 출력:{' '}
                    {formatCompactNumber(feature.outputTokens)}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 범례 */}
      <div className="mt-4 flex items-center gap-4 border-t border-border pt-3 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <div className="h-2.5 w-4 rounded bg-primary" />
          <span>출력 토큰</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-2.5 w-4 rounded bg-primary/50" />
          <span>입력 토큰</span>
        </div>
      </div>
    </div>
  );
}
