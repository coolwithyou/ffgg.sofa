'use client';

/**
 * 파이프라인 지연시간 차트
 * RAG 파이프라인의 각 단계별 평균 지연시간을 스택드 바로 표시합니다.
 */

import type { PipelineLatency } from '@/lib/usage/types';

interface PipelineLatencyChartProps {
  data: PipelineLatency;
}

// 파이프라인 단계별 색상 및 라벨
const PIPELINE_STAGES = [
  { key: 'llmAvgMs', label: 'LLM 생성', color: 'oklch(0.65 0.2 280)' }, // Purple
  { key: 'searchAvgMs', label: '검색', color: 'oklch(0.7 0.15 200)' }, // Cyan
  { key: 'rewriteAvgMs', label: '쿼리 재작성', color: 'oklch(0.7 0.15 85)' }, // Amber
  { key: 'otherAvgMs', label: '기타', color: 'oklch(0.6 0.1 250)' }, // Muted blue
] as const;

export function PipelineLatencyChart({ data }: PipelineLatencyChartProps) {
  const hasData = data.totalAvgMs > 0;

  if (!hasData) {
    return (
      <div className="rounded-lg border border-border bg-card p-6">
        <h3 className="mb-4 text-lg font-semibold text-foreground">파이프라인 지연시간</h3>
        <div className="flex h-48 items-center justify-center">
          <p className="text-muted-foreground">데이터가 없습니다.</p>
        </div>
      </div>
    );
  }

  // 각 단계 데이터 추출
  const stages = PIPELINE_STAGES.map((stage) => ({
    ...stage,
    value: data[stage.key as keyof PipelineLatency] as number,
    percentage: ((data[stage.key as keyof PipelineLatency] as number) / data.totalAvgMs) * 100,
  }));

  // 총 시간 형식화
  const formatMs = (ms: number): string => {
    if (ms >= 1000) {
      return `${(ms / 1000).toFixed(2)}s`;
    }
    return `${Math.round(ms)}ms`;
  };

  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">파이프라인 지연시간</h3>
        <div className="text-sm">
          <span className="text-muted-foreground">평균 총 지연:</span>{' '}
          <span className="font-medium text-foreground">{formatMs(data.totalAvgMs)}</span>
        </div>
      </div>

      {/* 스택드 바 (수평) */}
      <div className="mb-4">
        <div className="relative h-12 w-full overflow-hidden rounded-lg bg-muted">
          <div className="absolute inset-0 flex">
            {stages.map((stage, index) => (
              <div
                key={stage.key}
                className="group relative flex h-full items-center justify-center transition-all hover:opacity-80"
                style={{
                  width: `${stage.percentage}%`,
                  backgroundColor: stage.color,
                  borderRadius:
                    index === 0
                      ? '0.5rem 0 0 0.5rem'
                      : index === stages.length - 1
                        ? '0 0.5rem 0.5rem 0'
                        : '0',
                }}
              >
                {/* 라벨 (너비가 충분하면 표시) */}
                {stage.percentage > 15 && (
                  <span className="text-xs font-medium text-white">
                    {stage.percentage.toFixed(0)}%
                  </span>
                )}

                {/* 툴팁 */}
                <div className="absolute bottom-full left-1/2 z-10 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded bg-foreground px-2 py-1 text-xs text-background group-hover:block">
                  <div className="font-medium">{stage.label}</div>
                  <div>{formatMs(stage.value)}</div>
                  <div className="text-muted-foreground">({stage.percentage.toFixed(1)}%)</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 상세 테이블 */}
      <div className="space-y-2">
        {stages.map((stage) => (
          <div
            key={stage.key}
            className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-2"
          >
            <div className="flex items-center gap-2">
              <div
                className="h-3 w-3 shrink-0 rounded-full"
                style={{ backgroundColor: stage.color }}
              />
              <span className="text-sm text-foreground">{stage.label}</span>
            </div>
            <div className="flex items-center gap-4 text-sm">
              <span className="font-medium tabular-nums text-foreground">
                {formatMs(stage.value)}
              </span>
              <span className="w-12 text-right tabular-nums text-muted-foreground">
                {stage.percentage.toFixed(1)}%
              </span>
            </div>
          </div>
        ))}

        {/* 합계 */}
        <div className="flex items-center justify-between rounded-md border-t border-border bg-muted/30 px-3 py-2 font-medium">
          <span className="text-foreground">총 지연시간</span>
          <span className="tabular-nums text-foreground">{formatMs(data.totalAvgMs)}</span>
        </div>
      </div>

      {/* 성능 힌트 */}
      <div className="mt-4 border-t border-border pt-3">
        <div className="text-xs text-muted-foreground">
          {data.llmAvgMs > data.searchAvgMs * 2 ? (
            <span className="flex items-center gap-1">
              <span className="text-yellow-500">⚡</span>
              LLM 생성이 전체 지연의 대부분을 차지합니다. 모델 최적화를 고려하세요.
            </span>
          ) : data.searchAvgMs > 500 ? (
            <span className="flex items-center gap-1">
              <span className="text-yellow-500">🔍</span>
              검색 지연이 높습니다. 인덱스 최적화를 고려하세요.
            </span>
          ) : (
            <span className="flex items-center gap-1">
              <span className="text-green-500">✓</span>
              파이프라인 성능이 양호합니다.
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
