'use client';

/**
 * 사용량 추이 차트
 * 최근 30일간의 일별 토큰 사용량과 비용 추이를 표시합니다.
 */

import type { DailyUsage } from '@/lib/usage/types';

interface UsageTrendChartProps {
  trend: DailyUsage[];
}

export function UsageTrendChart({ trend }: UsageTrendChartProps) {
  if (trend.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-6">
        <h2 className="mb-4 text-lg font-semibold text-foreground">일별 사용량 추이</h2>
        <div className="flex h-48 items-center justify-center">
          <p className="text-muted-foreground">데이터가 없습니다.</p>
        </div>
      </div>
    );
  }

  // 최대값 계산 (차트 스케일용)
  const maxCost = Math.max(...trend.map((d) => d.totalCostUsd), 0.01);
  const maxTokens = Math.max(...trend.map((d) => d.totalTokens), 1);

  // 최근 7일 평균
  const recentDays = trend.slice(-7);
  const avgCost =
    recentDays.length > 0
      ? recentDays.reduce((sum, d) => sum + d.totalCostUsd, 0) / recentDays.length
      : 0;

  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">일별 사용량 추이</h2>
        <div className="text-sm text-muted-foreground">
          7일 평균: <span className="font-medium text-foreground">${avgCost.toFixed(2)}/일</span>
        </div>
      </div>

      {/* 차트 영역 */}
      <div className="relative h-48">
        {/* Y축 라벨 */}
        <div className="absolute left-0 top-0 flex h-full w-12 flex-col justify-between text-right text-xs text-muted-foreground">
          <span>${maxCost.toFixed(2)}</span>
          <span>${(maxCost / 2).toFixed(2)}</span>
          <span>$0</span>
        </div>

        {/* 차트 바 */}
        <div className="ml-14 flex h-full items-end gap-0.5">
          {trend.map((day, index) => {
            const height = (day.totalCostUsd / maxCost) * 100;
            const date = new Date(day.date);
            const isToday = isDateToday(date);
            const isWeekend = date.getDay() === 0 || date.getDay() === 6;

            return (
              <div
                key={day.date.toISOString()}
                className="group relative flex flex-1 flex-col items-center"
              >
                {/* 바 */}
                <div className="flex h-full w-full items-end justify-center">
                  <div
                    className={`w-full max-w-3 rounded-t transition-all group-hover:opacity-80 ${
                      isToday
                        ? 'bg-primary'
                        : isWeekend
                          ? 'bg-muted-foreground/40'
                          : 'bg-primary/60'
                    }`}
                    style={{ height: `${Math.max(height, 2)}%` }}
                  />
                </div>

                {/* 툴팁 */}
                <div className="absolute bottom-full left-1/2 z-10 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded bg-foreground px-2 py-1 text-xs text-background group-hover:block">
                  <div className="font-medium">{formatDate(date)}</div>
                  <div>${day.totalCostUsd.toFixed(4)}</div>
                  <div>{day.totalTokens.toLocaleString()} 토큰</div>
                </div>

                {/* X축 라벨 (일부만 표시) */}
                {(index === 0 ||
                  index === Math.floor(trend.length / 2) ||
                  index === trend.length - 1) && (
                  <span className="mt-1 text-xs text-muted-foreground">
                    {formatShortDate(date)}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 범례 */}
      <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          <div className="h-2 w-2 rounded-full bg-primary" />
          <span>오늘</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="h-2 w-2 rounded-full bg-primary/60" />
          <span>평일</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="h-2 w-2 rounded-full bg-muted-foreground/40" />
          <span>주말</span>
        </div>
      </div>
    </div>
  );
}

function isDateToday(date: Date): boolean {
  const today = new Date();
  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
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
