'use client';

/**
 * 성능 개요 카드 컴포넌트
 * 핵심 응답 시간 지표를 표시합니다.
 */

interface OverviewData {
  avgMs: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  requestCount: number;
  cacheHitRate: number;
  trend: 'up' | 'down' | 'stable';
  trendPercent: number;
}

interface PerformanceOverviewCardsProps {
  overview: OverviewData;
}

export function PerformanceOverviewCards({ overview }: PerformanceOverviewCardsProps) {
  const formatMs = (ms: number) => {
    if (ms >= 1000) {
      return `${(ms / 1000).toFixed(1)}s`;
    }
    return `${Math.round(ms)}ms`;
  };

  const getTrendIcon = (trend: 'up' | 'down' | 'stable') => {
    if (trend === 'up') {
      return (
        <svg className="h-4 w-4 text-destructive" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
        </svg>
      );
    }
    if (trend === 'down') {
      return (
        <svg className="h-4 w-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      );
    }
    return (
      <svg className="h-4 w-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14" />
      </svg>
    );
  };

  const getP95Status = (p95Ms: number) => {
    if (p95Ms < 2000) return { color: 'text-green-500', bg: 'bg-green-500/10', label: '양호' };
    if (p95Ms < 3000) return { color: 'text-yellow-500', bg: 'bg-yellow-500/10', label: '주의' };
    return { color: 'text-destructive', bg: 'bg-destructive/10', label: '위험' };
  };

  const p95Status = getP95Status(overview.p95Ms);

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {/* 평균 응답 시간 */}
      <div className="rounded-lg border border-border bg-card p-6">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-muted-foreground">평균 응답 시간</p>
          <div className="flex items-center gap-1">
            {getTrendIcon(overview.trend)}
            {overview.trendPercent > 0 && (
              <span className={`text-xs ${overview.trend === 'up' ? 'text-destructive' : 'text-green-500'}`}>
                {overview.trendPercent.toFixed(1)}%
              </span>
            )}
          </div>
        </div>
        <p className="mt-2 text-3xl font-bold text-foreground">{formatMs(overview.avgMs)}</p>
        <p className="mt-1 text-xs text-muted-foreground">최근 24시간</p>
      </div>

      {/* P95 응답 시간 */}
      <div className="rounded-lg border border-border bg-card p-6">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-muted-foreground">P95 응답 시간</p>
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${p95Status.bg} ${p95Status.color}`}>
            {p95Status.label}
          </span>
        </div>
        <p className="mt-2 text-3xl font-bold text-foreground">{formatMs(overview.p95Ms)}</p>
        <p className="mt-1 text-xs text-muted-foreground">95%의 요청이 이 시간 내 응답</p>
      </div>

      {/* 요청 수 */}
      <div className="rounded-lg border border-border bg-card p-6">
        <p className="text-sm font-medium text-muted-foreground">요청 수</p>
        <p className="mt-2 text-3xl font-bold text-foreground">
          {overview.requestCount.toLocaleString()}
        </p>
        <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
          <span>P50: {formatMs(overview.p50Ms)}</span>
          <span>•</span>
          <span>P99: {formatMs(overview.p99Ms)}</span>
        </div>
      </div>

      {/* 캐시 히트율 */}
      <div className="rounded-lg border border-border bg-card p-6">
        <p className="text-sm font-medium text-muted-foreground">캐시 히트율</p>
        <p className="mt-2 text-3xl font-bold text-foreground">
          {overview.cacheHitRate.toFixed(1)}%
        </p>
        <div className="mt-2">
          <div className="h-2 w-full rounded-full bg-muted">
            <div
              className="h-2 rounded-full bg-primary"
              style={{ width: `${Math.min(overview.cacheHitRate, 100)}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
