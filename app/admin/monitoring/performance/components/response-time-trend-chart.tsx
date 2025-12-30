'use client';

/**
 * 응답 시간 추이 차트 컴포넌트
 * 시간별/실시간 응답 시간 변화를 시각화합니다.
 */

import { useState } from 'react';

interface TrendDataPoint {
  periodStart: string;
  avgMs: number;
  p95Ms: number;
  requestCount: number;
}

interface ResponseTimeTrendChartProps {
  trendData: TrendDataPoint[];
  realtimeTrend: TrendDataPoint[];
}

export function ResponseTimeTrendChart({ trendData, realtimeTrend }: ResponseTimeTrendChartProps) {
  const [viewMode, setViewMode] = useState<'hourly' | 'realtime'>('hourly');

  const data = viewMode === 'hourly' ? trendData : realtimeTrend;

  // 최대값 계산 (차트 스케일링용)
  const maxP95 = Math.max(...data.map((d) => d.p95Ms), 1);
  const maxRequests = Math.max(...data.map((d) => d.requestCount), 1);

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    if (viewMode === 'realtime') {
      return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
  };

  const formatMs = (ms: number) => {
    if (ms >= 1000) {
      return `${(ms / 1000).toFixed(1)}s`;
    }
    return `${Math.round(ms)}ms`;
  };

  if (data.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">응답 시간 추이</h2>
        </div>
        <div className="flex h-64 items-center justify-center">
          <p className="text-muted-foreground">데이터가 없습니다.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">응답 시간 추이</h2>
        <div className="flex rounded-md border border-border">
          <button
            onClick={() => setViewMode('hourly')}
            className={`px-3 py-1 text-sm ${
              viewMode === 'hourly'
                ? 'bg-primary text-primary-foreground'
                : 'bg-card text-muted-foreground hover:bg-muted'
            } rounded-l-md`}
          >
            시간별
          </button>
          <button
            onClick={() => setViewMode('realtime')}
            className={`px-3 py-1 text-sm ${
              viewMode === 'realtime'
                ? 'bg-primary text-primary-foreground'
                : 'bg-card text-muted-foreground hover:bg-muted'
            } rounded-r-md`}
          >
            실시간
          </button>
        </div>
      </div>

      {/* 간단한 바 차트 */}
      <div className="relative h-64">
        <div className="absolute inset-0 flex items-end gap-1 overflow-x-auto">
          {data.slice(-24).map((point, idx) => (
            <div
              key={idx}
              className="group relative flex flex-1 min-w-[24px] flex-col items-center"
            >
              {/* P95 바 */}
              <div
                className="w-full rounded-t bg-primary/30 transition-all hover:bg-primary/50"
                style={{ height: `${(point.p95Ms / maxP95) * 200}px` }}
              />
              {/* 평균 바 (오버레이) */}
              <div
                className="absolute bottom-0 w-full rounded-t bg-primary transition-all"
                style={{ height: `${(point.avgMs / maxP95) * 200}px` }}
              />

              {/* 툴팁 */}
              <div className="absolute bottom-full mb-2 hidden rounded bg-card border border-border px-2 py-1 text-xs shadow-lg group-hover:block z-10">
                <div className="font-medium text-foreground">{formatTime(point.periodStart)}</div>
                <div className="text-muted-foreground">평균: {formatMs(point.avgMs)}</div>
                <div className="text-muted-foreground">P95: {formatMs(point.p95Ms)}</div>
                <div className="text-muted-foreground">요청: {point.requestCount}건</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 범례 */}
      <div className="mt-4 flex items-center justify-center gap-6 text-xs">
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded bg-primary" />
          <span className="text-muted-foreground">평균 응답 시간</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded bg-primary/30" />
          <span className="text-muted-foreground">P95 응답 시간</span>
        </div>
      </div>
    </div>
  );
}
