'use client';

/**
 * 캐시 비용 비교 도넛 차트
 * CSS conic-gradient를 사용하여 캐시/비캐시 요청 비율과 절감 비용을 표시합니다.
 */

import type { CacheCostComparison } from '@/lib/usage/types';

interface CacheCostDonutProps {
  data: CacheCostComparison;
}

// 색상 정의 (OKLCH)
const COLORS = {
  cached: 'oklch(0.65 0.2 145)', // Green
  nonCached: 'oklch(0.6 0.15 250)', // Blue/Purple
  savings: 'oklch(0.7 0.18 145)', // Light green
};

export function CacheCostDonut({ data }: CacheCostDonutProps) {
  const totalRequests = data.cachedRequests + data.nonCachedRequests;

  if (totalRequests === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-6">
        <h3 className="mb-4 text-lg font-semibold text-foreground">캐시 비용 비교</h3>
        <div className="flex h-48 items-center justify-center">
          <p className="text-muted-foreground">데이터가 없습니다.</p>
        </div>
      </div>
    );
  }

  // 캐시 히트율 계산
  const cacheHitRate = (data.cachedRequests / totalRequests) * 100;
  const cachedAngle = (cacheHitRate / 100) * 360;

  // 도넛 차트 그라데이션
  const donutGradient = `conic-gradient(
    ${COLORS.cached} 0deg ${cachedAngle}deg,
    ${COLORS.nonCached} ${cachedAngle}deg 360deg
  )`;

  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">캐시 비용 비교</h3>
        <span className="text-sm text-muted-foreground">
          히트율:{' '}
          <span className="font-medium text-foreground">{cacheHitRate.toFixed(1)}%</span>
        </span>
      </div>

      {/* 도넛 차트와 통계 */}
      <div className="flex items-center gap-6">
        {/* 도넛 차트 */}
        <div className="relative">
          <div
            className="h-32 w-32 rounded-full"
            style={{ background: donutGradient }}
          >
            {/* 도넛 구멍 (가운데 빈 원) */}
            <div className="absolute inset-4 flex items-center justify-center rounded-full bg-card">
              <div className="text-center">
                <div className="text-2xl font-bold text-foreground">
                  {cacheHitRate.toFixed(0)}%
                </div>
                <div className="text-xs text-muted-foreground">캐시 히트</div>
              </div>
            </div>
          </div>
        </div>

        {/* 통계 정보 */}
        <div className="flex-1 space-y-3">
          {/* 캐시된 요청 */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div
                className="h-3 w-3 rounded-full"
                style={{ backgroundColor: COLORS.cached }}
              />
              <span className="text-sm text-foreground">캐시됨</span>
            </div>
            <span className="text-sm font-medium tabular-nums text-foreground">
              {data.cachedRequests.toLocaleString()}건
            </span>
          </div>

          {/* 비캐시 요청 */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div
                className="h-3 w-3 rounded-full"
                style={{ backgroundColor: COLORS.nonCached }}
              />
              <span className="text-sm text-foreground">비캐시</span>
            </div>
            <span className="text-sm font-medium tabular-nums text-foreground">
              {data.nonCachedRequests.toLocaleString()}건
            </span>
          </div>

          {/* 구분선 */}
          <div className="border-t border-border" />

          {/* 절감 비용 */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">추정 절감</span>
            <span
              className="text-lg font-bold"
              style={{ color: COLORS.savings }}
            >
              ${data.estimatedSavings.toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      {/* 절감 효과 시각화 바 */}
      <div className="mt-4 border-t border-border pt-3">
        <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
          <span>비용 절감 효과</span>
          <span>총 {totalRequests.toLocaleString()}건 처리</span>
        </div>
        <div className="relative h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="absolute left-0 top-0 h-full rounded-full transition-all"
            style={{
              width: `${cacheHitRate}%`,
              backgroundColor: COLORS.cached,
            }}
          />
        </div>
      </div>

      {/* 인사이트 */}
      <div className="mt-3 text-xs text-muted-foreground">
        {cacheHitRate >= 70 ? (
          <span className="flex items-center gap-1">
            <span className="text-green-500">✓</span>
            캐시 효율이 우수합니다. 비용을 효과적으로 절감하고 있습니다.
          </span>
        ) : cacheHitRate >= 40 ? (
          <span className="flex items-center gap-1">
            <span className="text-yellow-500">💡</span>
            캐시 히트율 개선 여지가 있습니다. 자주 사용되는 쿼리 패턴을 분석해보세요.
          </span>
        ) : (
          <span className="flex items-center gap-1">
            <span className="text-orange-500">⚠️</span>
            캐시 히트율이 낮습니다. 캐시 전략 재검토를 권장합니다.
          </span>
        )}
      </div>
    </div>
  );
}
