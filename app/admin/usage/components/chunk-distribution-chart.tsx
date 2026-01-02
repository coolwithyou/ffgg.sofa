'use client';

/**
 * 청크 분포 히스토그램
 * RAG 파이프라인에서 검색에 사용된 청크 수의 분포를 막대 그래프로 표시합니다.
 */

import type { ChunkDistribution } from '@/lib/usage/types';

interface ChunkDistributionChartProps {
  data: ChunkDistribution[];
}

// 청크 범위별 색상 (낮은 청크 수 = 효율적 = 녹색, 높은 청크 수 = 주황색)
function getBarColor(index: number, total: number): string {
  // 인덱스에 따라 녹색 → 주황색 그라데이션
  const hue = 145 - (index / Math.max(total - 1, 1)) * 60; // 145 (green) → 85 (orange)
  return `oklch(0.65 0.18 ${hue})`;
}

export function ChunkDistributionChart({ data }: ChunkDistributionChartProps) {
  if (data.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-6">
        <h3 className="mb-4 text-lg font-semibold text-foreground">청크 분포</h3>
        <div className="flex h-48 items-center justify-center">
          <p className="text-muted-foreground">데이터가 없습니다.</p>
        </div>
      </div>
    );
  }

  // 최대 비율 계산 (스케일링용)
  const maxPercentage = Math.max(...data.map((d) => d.percentage), 1);
  const totalCount = data.reduce((sum, d) => sum + d.count, 0);

  // 중앙값/최빈값 찾기
  const modeRange = data.reduce((max, d) => (d.count > max.count ? d : max), data[0]);

  // 가중 평균 계산 (범위의 중간값 사용)
  const getRangeMidpoint = (range: string): number => {
    if (range.includes('+')) {
      return parseInt(range.replace('+', '')) + 1; // "9+" → 10
    }
    const [min, max] = range.split('-').map(Number);
    return (min + max) / 2;
  };

  const weightedSum = data.reduce((sum, d) => sum + getRangeMidpoint(d.range) * d.count, 0);
  const avgChunks = totalCount > 0 ? weightedSum / totalCount : 0;

  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">청크 분포</h3>
        <div className="text-sm text-muted-foreground">
          평균:{' '}
          <span className="font-medium text-foreground">{avgChunks.toFixed(1)}개</span>
        </div>
      </div>

      {/* 히스토그램 차트 */}
      <div className="relative h-48">
        {/* Y축 라벨 */}
        <div className="absolute left-0 top-0 flex h-full w-10 flex-col justify-between text-right text-xs text-muted-foreground">
          <span>{maxPercentage.toFixed(0)}%</span>
          <span>{(maxPercentage / 2).toFixed(0)}%</span>
          <span>0%</span>
        </div>

        {/* 차트 바 */}
        <div className="ml-12 flex h-full items-end gap-2">
          {data.map((bin, index) => {
            const height = (bin.percentage / maxPercentage) * 100;
            const color = getBarColor(index, data.length);

            return (
              <div
                key={bin.range}
                className="group relative flex flex-1 flex-col items-center"
              >
                {/* 바 */}
                <div className="flex h-full w-full items-end justify-center">
                  <div
                    className="w-full max-w-12 rounded-t transition-all group-hover:opacity-80"
                    style={{
                      height: `${Math.max(height, 2)}%`,
                      backgroundColor: color,
                    }}
                  />
                </div>

                {/* 툴팁 */}
                <div className="absolute bottom-full left-1/2 z-10 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded bg-foreground px-2 py-1 text-xs text-background group-hover:block">
                  <div className="font-medium">{bin.range}개 청크</div>
                  <div>{bin.count.toLocaleString()}건</div>
                  <div>{bin.percentage.toFixed(1)}%</div>
                </div>

                {/* X축 라벨 */}
                <span className="mt-2 text-xs text-muted-foreground">{bin.range}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 통계 요약 */}
      <div className="mt-4 grid grid-cols-3 gap-2 border-t border-border pt-3 text-center text-sm">
        <div>
          <div className="text-muted-foreground">총 요청</div>
          <div className="font-medium text-foreground">{totalCount.toLocaleString()}건</div>
        </div>
        <div>
          <div className="text-muted-foreground">평균</div>
          <div className="font-medium text-foreground">{avgChunks.toFixed(1)}개</div>
        </div>
        <div>
          <div className="text-muted-foreground">최빈값</div>
          <div className="font-medium text-foreground">{modeRange.range}개</div>
        </div>
      </div>

      {/* 인사이트 */}
      <div className="mt-3 text-xs text-muted-foreground">
        {avgChunks <= 3 ? (
          <span className="flex items-center gap-1">
            <span className="text-green-500">✓</span>
            효율적인 청크 검색입니다. 적은 청크로 충분한 컨텍스트를 제공하고 있습니다.
          </span>
        ) : avgChunks <= 5 ? (
          <span className="flex items-center gap-1">
            <span className="text-yellow-500">💡</span>
            적정 수준의 청크를 사용하고 있습니다.
          </span>
        ) : (
          <span className="flex items-center gap-1">
            <span className="text-orange-500">⚠️</span>
            청크 수가 많습니다. 청킹 전략이나 검색 알고리즘 최적화를 고려하세요.
          </span>
        )}
      </div>
    </div>
  );
}
