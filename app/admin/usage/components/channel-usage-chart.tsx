'use client';

/**
 * 채널별 사용량 차트
 * 웹/카카오 채널별 일간 사용량을 스택드 바 차트로 표시합니다.
 */

import type { ChannelUsage } from '@/lib/usage/types';

interface ChannelUsageChartProps {
  data: ChannelUsage[];
}

// 채널별 색상 (OKLCH)
const CHANNEL_COLORS = {
  web: 'oklch(0.65 0.2 250)', // Primary blue
  kakao: 'oklch(0.75 0.15 90)', // Kakao yellow
};

export function ChannelUsageChart({ data }: ChannelUsageChartProps) {
  if (data.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-6">
        <h3 className="mb-4 text-lg font-semibold text-foreground">채널별 사용량</h3>
        <div className="flex h-48 items-center justify-center">
          <p className="text-muted-foreground">데이터가 없습니다.</p>
        </div>
      </div>
    );
  }

  // 최대값 계산
  const maxTotal = Math.max(...data.map((d) => d.total), 1);

  // 채널별 합계
  const totalWeb = data.reduce((sum, d) => sum + d.web, 0);
  const totalKakao = data.reduce((sum, d) => sum + d.kakao, 0);
  const grandTotal = totalWeb + totalKakao;

  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">채널별 사용량</h3>
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <span>총 {grandTotal.toLocaleString()}건</span>
        </div>
      </div>

      {/* 차트 영역 */}
      <div className="relative h-48">
        {/* Y축 라벨 */}
        <div className="absolute left-0 top-0 flex h-full w-10 flex-col justify-between text-right text-xs text-muted-foreground">
          <span>{maxTotal}</span>
          <span>{Math.floor(maxTotal / 2)}</span>
          <span>0</span>
        </div>

        {/* 스택드 바 차트 */}
        <div className="ml-12 flex h-full items-end gap-0.5">
          {data.map((day, index) => {
            const webHeight = (day.web / maxTotal) * 100;
            const kakaoHeight = (day.kakao / maxTotal) * 100;
            const date = new Date(day.date);

            return (
              <div
                key={day.date}
                className="group relative flex h-full flex-1 flex-col items-center"
              >
                {/* 스택드 바 */}
                <div className="flex h-full w-full flex-col items-center justify-end">
                  <div className="flex w-full max-w-3 flex-col-reverse">
                    {/* Web (하단) */}
                    <div
                      className="w-full rounded-b transition-all group-hover:opacity-80"
                      style={{
                        height: `${Math.max(webHeight, day.web > 0 ? 2 : 0)}%`,
                        backgroundColor: CHANNEL_COLORS.web,
                      }}
                    />
                    {/* Kakao (상단) */}
                    <div
                      className="w-full rounded-t transition-all group-hover:opacity-80"
                      style={{
                        height: `${Math.max(kakaoHeight, day.kakao > 0 ? 2 : 0)}%`,
                        backgroundColor: CHANNEL_COLORS.kakao,
                      }}
                    />
                  </div>
                </div>

                {/* 툴팁 */}
                <div className="absolute bottom-full left-1/2 z-10 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded bg-foreground px-2 py-1 text-xs text-background group-hover:block">
                  <div className="font-medium">{formatDate(date)}</div>
                  <div className="flex items-center gap-1.5">
                    <div
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: CHANNEL_COLORS.web }}
                    />
                    웹: {day.web.toLocaleString()}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: CHANNEL_COLORS.kakao }}
                    />
                    카카오: {day.kakao.toLocaleString()}
                  </div>
                  <div className="mt-1 border-t border-background/20 pt-1">
                    합계: {day.total.toLocaleString()}
                  </div>
                </div>

                {/* X축 라벨 */}
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

      {/* 범례 및 요약 */}
      <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <div
              className="h-3 w-3 rounded-full"
              style={{ backgroundColor: CHANNEL_COLORS.web }}
            />
            <span className="text-muted-foreground">웹</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div
              className="h-3 w-3 rounded-full"
              style={{ backgroundColor: CHANNEL_COLORS.kakao }}
            />
            <span className="text-muted-foreground">카카오</span>
          </div>
        </div>

        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-1.5">
            <div
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: CHANNEL_COLORS.web }}
            />
            <span className="font-medium text-foreground">
              {totalWeb.toLocaleString()}
            </span>
            <span className="text-muted-foreground">
              ({grandTotal > 0 ? ((totalWeb / grandTotal) * 100).toFixed(0) : 0}%)
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <div
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: CHANNEL_COLORS.kakao }}
            />
            <span className="font-medium text-foreground">
              {totalKakao.toLocaleString()}
            </span>
            <span className="text-muted-foreground">
              ({grandTotal > 0 ? ((totalKakao / grandTotal) * 100).toFixed(0) : 0}%)
            </span>
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
