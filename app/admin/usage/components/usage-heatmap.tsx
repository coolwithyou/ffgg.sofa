'use client';

/**
 * 사용량 히트맵 차트
 * 요일×시간대별 사용량 패턴을 CSS Grid 기반 히트맵으로 표시합니다.
 */

import type { HourlyUsageCell } from '@/lib/usage/types';

interface UsageHeatmapProps {
  data: HourlyUsageCell[];
}

// 요일 라벨 (일요일부터 시작)
const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

// 시간 라벨 (6시간 간격)
const HOUR_LABELS = [0, 6, 12, 18, 23];

/**
 * 강도에 따른 히트맵 색상 반환 (OKLCH 기반)
 * 낮은 강도: 밝은 배경, 높은 강도: 진한 primary 색상
 */
function getHeatColor(intensity: number): string {
  if (intensity === 0) return 'oklch(0.95 0 0)'; // 거의 투명한 회색

  // 강도에 따라 밝기 조절 (0.9 → 0.4)
  const lightness = 0.9 - intensity * 0.5;
  // 채도도 강도에 따라 증가 (0.05 → 0.2)
  const chroma = 0.05 + intensity * 0.15;
  // 색상: primary 계열 (250 = 파란색)
  return `oklch(${lightness.toFixed(2)} ${chroma.toFixed(2)} 250)`;
}

export function UsageHeatmap({ data }: UsageHeatmapProps) {
  if (data.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-6">
        <h3 className="mb-4 text-lg font-semibold text-foreground">요일×시간 사용량 히트맵</h3>
        <div className="flex h-48 items-center justify-center">
          <p className="text-muted-foreground">데이터가 없습니다.</p>
        </div>
      </div>
    );
  }

  // 7×24 그리드 데이터 맵 생성
  const cellMap = new Map<string, HourlyUsageCell>();
  for (const cell of data) {
    cellMap.set(`${cell.dayOfWeek}-${cell.hour}`, cell);
  }

  // 최대 요청 수 (툴팁용)
  const maxCount = Math.max(...data.map((d) => d.count), 1);

  // 피크 시간대 찾기
  const peakCell = data.reduce((max, cell) => (cell.count > max.count ? cell : max), data[0]);
  const peakDay = DAY_LABELS[peakCell.dayOfWeek];
  const peakHour = peakCell.hour;

  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">요일×시간 사용량 히트맵</h3>
        <div className="text-sm text-muted-foreground">
          피크:{' '}
          <span className="font-medium text-foreground">
            {peakDay} {peakHour}시
          </span>
        </div>
      </div>

      {/* 히트맵 그리드 */}
      <div className="overflow-x-auto">
        <div className="min-w-[400px]">
          {/* 시간 라벨 (상단) */}
          <div className="mb-1 flex">
            <div className="w-8 shrink-0" /> {/* 요일 라벨 공간 */}
            <div className="flex flex-1 justify-between text-xs text-muted-foreground">
              {HOUR_LABELS.map((hour) => (
                <span key={hour} className="w-8 text-center">
                  {hour}시
                </span>
              ))}
            </div>
          </div>

          {/* 히트맵 행 (요일별) */}
          <div className="space-y-0.5">
            {DAY_LABELS.map((dayLabel, dayIndex) => (
              <div key={dayIndex} className="flex items-center gap-1">
                {/* 요일 라벨 */}
                <div className="w-8 shrink-0 text-right text-xs text-muted-foreground">
                  {dayLabel}
                </div>

                {/* 24시간 셀 */}
                <div className="flex flex-1 gap-0.5">
                  {Array.from({ length: 24 }, (_, hour) => {
                    const cell = cellMap.get(`${dayIndex}-${hour}`);
                    const intensity = cell?.intensity ?? 0;
                    const count = cell?.count ?? 0;
                    const cost = cell?.cost ?? 0;

                    return (
                      <div
                        key={hour}
                        className="group relative aspect-square flex-1 cursor-pointer rounded-sm transition-transform hover:scale-110 hover:z-10"
                        style={{ backgroundColor: getHeatColor(intensity) }}
                      >
                        {/* 툴팁 */}
                        <div className="absolute bottom-full left-1/2 z-20 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded bg-foreground px-2 py-1 text-xs text-background group-hover:block">
                          <div className="font-medium">
                            {dayLabel}요일 {hour}시
                          </div>
                          <div>요청: {count.toLocaleString()}건</div>
                          <div>비용: ${cost.toFixed(3)}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 범례 */}
      <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>낮음</span>
          <div className="flex gap-0.5">
            {[0.1, 0.3, 0.5, 0.7, 0.9].map((intensity) => (
              <div
                key={intensity}
                className="h-4 w-4 rounded-sm"
                style={{ backgroundColor: getHeatColor(intensity) }}
              />
            ))}
          </div>
          <span>높음</span>
        </div>

        <div className="text-xs text-muted-foreground">
          총 {data.reduce((sum, d) => sum + d.count, 0).toLocaleString()}건
        </div>
      </div>

      {/* 인사이트 */}
      <div className="mt-3 text-xs text-muted-foreground">
        {peakCell.dayOfWeek === 0 || peakCell.dayOfWeek === 6 ? (
          <span className="flex items-center gap-1">
            <span className="text-yellow-500">📅</span>
            주말에 사용량이 가장 높습니다.
          </span>
        ) : peakHour >= 9 && peakHour <= 18 ? (
          <span className="flex items-center gap-1">
            <span className="text-green-500">💼</span>
            업무 시간대 사용량이 높습니다.
          </span>
        ) : (
          <span className="flex items-center gap-1">
            <span className="text-purple-500">🌙</span>
            업무 외 시간 사용량이 높습니다.
          </span>
        )}
      </div>
    </div>
  );
}
