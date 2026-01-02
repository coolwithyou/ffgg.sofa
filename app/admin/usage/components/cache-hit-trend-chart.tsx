'use client';

/**
 * 캐시 히트율 추이 차트
 * 일별 캐시 히트율 변화를 막대 그래프로 표시합니다.
 */

import type { CacheHitTrend } from '@/lib/usage/types';

interface CacheHitTrendChartProps {
  data: CacheHitTrend[];
}

export function CacheHitTrendChart({ data }: CacheHitTrendChartProps) {
  if (data.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-6">
        <h3 className="mb-4 text-lg font-semibold text-foreground">캐시 히트율 추이</h3>
        <div className="flex h-48 items-center justify-center">
          <p className="text-muted-foreground">데이터가 없습니다.</p>
        </div>
      </div>
    );
  }

  // 최근 7일 평균 히트율
  const recentDays = data.slice(-7);
  const avgHitRate =
    recentDays.length > 0
      ? recentDays.reduce((sum, d) => sum + d.hitRate, 0) / recentDays.length
      : 0;

  // 전체 평균
  const overallAvg = data.reduce((sum, d) => sum + d.hitRate, 0) / data.length;

  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">캐시 히트율 추이</h3>
        <div className="text-sm text-muted-foreground">
          7일 평균:{' '}
          <span className="font-medium text-foreground">{(avgHitRate * 100).toFixed(1)}%</span>
        </div>
      </div>

      {/* 차트 영역 */}
      <div className="relative h-48">
        {/* Y축 라벨 */}
        <div className="absolute left-0 top-0 flex h-full w-10 flex-col justify-between text-right text-xs text-muted-foreground">
          <span>100%</span>
          <span>50%</span>
          <span>0%</span>
        </div>

        {/* 평균 라인 */}
        <div
          className="absolute left-10 right-0 border-t border-dashed border-primary/50"
          style={{ top: `${(1 - overallAvg) * 100}%` }}
        >
          <span className="absolute -top-3 right-0 text-xs text-primary">
            평균 {(overallAvg * 100).toFixed(0)}%
          </span>
        </div>

        {/* 차트 바 */}
        <div className="ml-12 flex h-full items-end gap-0.5">
          {data.map((day, index) => {
            const height = day.hitRate * 100;
            const date = new Date(day.date);
            const isWeekend = date.getDay() === 0 || date.getDay() === 6;

            // 히트율에 따른 색상 (높을수록 녹색, 낮을수록 노란색)
            const hue = day.hitRate * 90 + 50; // 50 (노란색) ~ 140 (녹색)
            const color = `oklch(0.65 0.15 ${hue})`;

            return (
              <div
                key={day.date}
                className="group relative flex h-full flex-1 flex-col items-center"
              >
                {/* 바 */}
                <div className="flex h-full w-full items-end justify-center">
                  <div
                    className={`w-full max-w-3 rounded-t transition-all group-hover:opacity-80`}
                    style={{
                      height: `${Math.max(height, 2)}%`,
                      backgroundColor: color,
                      opacity: isWeekend ? 0.6 : 1,
                    }}
                  />
                </div>

                {/* 툴팁 */}
                <div className="absolute bottom-full left-1/2 z-10 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded bg-foreground px-2 py-1 text-xs text-background group-hover:block">
                  <div className="font-medium">{formatDate(date)}</div>
                  <div>히트율: {(day.hitRate * 100).toFixed(1)}%</div>
                  <div>
                    {day.hitCount.toLocaleString()} / {day.totalCount.toLocaleString()} 요청
                  </div>
                </div>

                {/* X축 라벨 (일부만 표시) */}
                {(index === 0 ||
                  index === Math.floor(data.length / 2) ||
                  index === data.length - 1) && (
                  <span className="mt-1 text-xs text-muted-foreground">
                    {formatShortDate(date)}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 요약 통계 */}
      <div className="mt-4 grid grid-cols-3 gap-2 border-t border-border pt-3 text-center text-sm">
        <div>
          <div className="text-muted-foreground">최고</div>
          <div className="font-medium text-green-500">
            {(Math.max(...data.map((d) => d.hitRate)) * 100).toFixed(1)}%
          </div>
        </div>
        <div>
          <div className="text-muted-foreground">평균</div>
          <div className="font-medium text-foreground">{(overallAvg * 100).toFixed(1)}%</div>
        </div>
        <div>
          <div className="text-muted-foreground">최저</div>
          <div className="font-medium text-yellow-500">
            {(Math.min(...data.map((d) => d.hitRate)) * 100).toFixed(1)}%
          </div>
        </div>
      </div>
    </div>
  );
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('ko-KR', {
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  });
}

function formatShortDate(date: Date): string {
  return `${date.getMonth() + 1}/${date.getDate()}`;
}
