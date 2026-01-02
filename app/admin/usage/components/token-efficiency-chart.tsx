'use client';

/**
 * 토큰 효율성 버블 차트
 * 모델별 입력/출력 토큰 비율과 비용을 버블 매트릭스로 시각화합니다.
 * X축: 평균 입력 토큰, Y축: 평균 출력 토큰, 버블 크기: 비용
 */

import type { TokenEfficiency } from '@/lib/usage/types';
import { formatCompactNumber, formatWithCommas } from '@/lib/format';

interface TokenEfficiencyChartProps {
  data: TokenEfficiency[];
}

// 모델별 색상 (OKLCH)
const MODEL_COLORS: Record<string, string> = {
  'gpt-4o': 'oklch(0.65 0.2 280)', // Purple
  'gpt-4o-mini': 'oklch(0.7 0.18 320)', // Pink
  'gpt-4-turbo': 'oklch(0.65 0.15 250)', // Blue
  'gpt-3.5-turbo': 'oklch(0.7 0.15 200)', // Cyan
  'text-embedding-3-large': 'oklch(0.7 0.15 85)', // Amber
  'text-embedding-3-small': 'oklch(0.75 0.12 85)', // Light amber
  claude: 'oklch(0.65 0.2 30)', // Orange/red
};

function getModelColor(modelId: string): string {
  return MODEL_COLORS[modelId] || 'oklch(0.6 0.1 250)';
}

export function TokenEfficiencyChart({ data }: TokenEfficiencyChartProps) {
  if (data.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-6">
        <h3 className="mb-4 text-lg font-semibold text-foreground">모델별 토큰 효율성</h3>
        <div className="flex h-48 items-center justify-center">
          <p className="text-muted-foreground">데이터가 없습니다.</p>
        </div>
      </div>
    );
  }

  // 스케일링을 위한 최대값 계산
  const maxInputTokens = Math.max(...data.map((d) => d.avgInputTokens), 1);
  const maxOutputTokens = Math.max(...data.map((d) => d.avgOutputTokens), 1);
  const maxCost = Math.max(...data.map((d) => d.totalCost), 1);

  // 총 비용
  const totalCost = data.reduce((sum, d) => sum + d.totalCost, 0);

  // 가장 효율적인 모델 (비용 대비 요청 수)
  const mostEfficientModel = data.reduce((best, d) => {
    const efficiency = d.requestCount / (d.totalCost || 1);
    const bestEfficiency = best.requestCount / (best.totalCost || 1);
    return efficiency > bestEfficiency ? d : best;
  }, data[0]);

  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">모델별 토큰 효율성</h3>
        <span className="text-sm text-muted-foreground">
          총 비용: <span className="font-medium text-foreground">${totalCost.toFixed(2)}</span>
        </span>
      </div>

      {/* 버블 차트 영역 */}
      <div className="relative h-56">
        {/* Y축 라벨 */}
        <div className="absolute left-0 top-0 flex h-full w-12 flex-col justify-between text-right text-xs text-muted-foreground">
          <span title={`${formatWithCommas(maxOutputTokens)} tokens`}>
            {formatCompactNumber(maxOutputTokens)}
          </span>
          <span className="rotate-[-90deg] whitespace-nowrap text-[10px]">출력 토큰</span>
          <span>0</span>
        </div>

        {/* 차트 영역 */}
        <div className="relative ml-14 h-full rounded-md bg-muted/30">
          {/* 그리드 라인 */}
          <div className="absolute inset-0">
            <div className="absolute left-0 right-0 top-1/2 border-t border-dashed border-border/50" />
            <div className="absolute bottom-0 left-1/2 top-0 border-l border-dashed border-border/50" />
          </div>

          {/* 버블들 */}
          {data.map((model) => {
            // 위치 계산 (0-100%)
            const xPercent = (model.avgInputTokens / maxInputTokens) * 85 + 5; // 5-90% 범위
            const yPercent = 100 - ((model.avgOutputTokens / maxOutputTokens) * 85 + 10); // 반전 (위가 높음)

            // 버블 크기 (비용 비례, 최소 24px ~ 최대 64px)
            const sizeRatio = model.totalCost / maxCost;
            const bubbleSize = Math.max(24, Math.min(64, 24 + sizeRatio * 40));

            const color = getModelColor(model.modelId);

            return (
              <div
                key={model.modelId}
                className="group absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer transition-transform hover:scale-110 hover:z-10"
                style={{
                  left: `${xPercent}%`,
                  top: `${yPercent}%`,
                }}
              >
                {/* 버블 */}
                <div
                  className="flex items-center justify-center rounded-full opacity-80 shadow-md transition-opacity hover:opacity-100"
                  style={{
                    width: bubbleSize,
                    height: bubbleSize,
                    backgroundColor: color,
                  }}
                >
                  <span className="text-xs font-medium text-white">
                    {model.ioRatio.toFixed(1)}
                  </span>
                </div>

                {/* 툴팁 */}
                <div className="absolute bottom-full left-1/2 z-20 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded bg-foreground px-3 py-2 text-xs text-background group-hover:block">
                  <div className="font-medium">{model.displayName}</div>
                  <div className="mt-1 space-y-0.5 text-muted-foreground">
                    <div>입력: {formatCompactNumber(model.avgInputTokens)} avg</div>
                    <div>출력: {formatCompactNumber(model.avgOutputTokens)} avg</div>
                    <div>비용: ${model.totalCost.toFixed(2)}</div>
                    <div>요청: {model.requestCount.toLocaleString()}건</div>
                    <div>I/O 비율: {model.ioRatio.toFixed(2)}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* X축 라벨 */}
        <div className="ml-14 mt-2 flex justify-between text-xs text-muted-foreground">
          <span>0</span>
          <span>입력 토큰</span>
          <span title={`${formatWithCommas(maxInputTokens)} tokens`}>
            {formatCompactNumber(maxInputTokens)}
          </span>
        </div>
      </div>

      {/* 범례 */}
      <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-border pt-3 text-xs">
        {data.map((model) => (
          <div key={model.modelId} className="flex items-center gap-1.5">
            <div
              className="h-3 w-3 rounded-full"
              style={{ backgroundColor: getModelColor(model.modelId) }}
            />
            <span className="text-muted-foreground">{model.displayName}</span>
          </div>
        ))}
      </div>

      {/* 인사이트 */}
      <div className="mt-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="text-green-500">💡</span>
          가장 효율적: <span className="font-medium text-foreground">{mostEfficientModel.displayName}</span>
          {' '}(요청당 ${(mostEfficientModel.totalCost / mostEfficientModel.requestCount).toFixed(4)})
        </span>
      </div>
    </div>
  );
}
