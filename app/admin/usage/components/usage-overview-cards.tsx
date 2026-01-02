'use client';

/**
 * 사용량 개요 카드
 * 오늘, 이번 달, 예상 비용 등 핵심 지표를 표시합니다.
 */

import type { UsageOverview, Forecast } from '@/lib/usage/types';
import { formatCompactNumber, formatCurrency } from '@/lib/format';

interface UsageOverviewCardsProps {
  todayOverview: UsageOverview;
  monthOverview: UsageOverview;
  forecast: Forecast;
}

export function UsageOverviewCards({
  todayOverview,
  monthOverview,
  forecast,
}: UsageOverviewCardsProps) {
  // 예산 대비 소진율 (기본 $200 기준, 추후 동적으로 변경 가능)
  const estimatedBudget = 200;
  const usagePercentage = (monthOverview.totalCostUsd / estimatedBudget) * 100;

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {/* 오늘 사용량 */}
      <StatCard
        title="오늘 사용량"
        value={formatCurrency(todayOverview.totalCostUsd)}
        subValue={`${formatCompactNumber(todayOverview.totalTokens)} 토큰`}
        subValueTooltip={`${todayOverview.totalTokens.toLocaleString('ko-KR')} 토큰`}
        trend={null}
      />

      {/* 이번 달 누적 */}
      <StatCard
        title="이번 달 누적"
        value={formatCurrency(monthOverview.totalCostUsd)}
        subValue={`${formatCompactNumber(monthOverview.totalTokens)} 토큰`}
        subValueTooltip={`${monthOverview.totalTokens.toLocaleString('ko-KR')} 토큰`}
        trend={null}
      />

      {/* 월말 예상 */}
      <StatCard
        title="월말 예상"
        value={formatCurrency(forecast.projectedMonthlyUsage)}
        subValue={`일평균 ${formatCurrency(forecast.dailyAverage)}`}
        trend={forecast.trend}
        trendLabel={getTrendLabel(forecast.trend)}
      />

      {/* 예산 소진율 */}
      <div className="rounded-lg border border-border bg-card p-6">
        <p className="text-sm font-medium text-muted-foreground">예산 소진율</p>
        <p className="mt-2 text-3xl font-bold text-foreground">
          {usagePercentage.toFixed(1)}%
        </p>
        <div className="mt-3">
          <div className="h-2 w-full rounded-full bg-muted">
            <div
              className={`h-2 rounded-full ${getProgressColor(usagePercentage)}`}
              style={{ width: `${Math.min(usagePercentage, 100)}%` }}
            />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {formatCurrency(monthOverview.totalCostUsd)} / {formatCurrency(estimatedBudget)}
          </p>
        </div>
      </div>
    </div>
  );
}

interface StatCardProps {
  title: string;
  value: string;
  subValue?: string;
  subValueTooltip?: string;
  trend: 'increasing' | 'stable' | 'decreasing' | null;
  trendLabel?: string;
}

function StatCard({ title, value, subValue, subValueTooltip, trend, trendLabel }: StatCardProps) {
  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <p className="text-sm font-medium text-muted-foreground">{title}</p>
      <p className="mt-2 text-3xl font-bold text-foreground">{value}</p>
      {subValue && (
        <p className="mt-1 text-sm text-muted-foreground" title={subValueTooltip}>
          {subValue}
        </p>
      )}
      {trend && trendLabel && (
        <div className={`mt-2 flex items-center gap-1 text-sm ${getTrendTextColor(trend)}`}>
          {getTrendIcon(trend)}
          <span>{trendLabel}</span>
        </div>
      )}
    </div>
  );
}

function getTrendLabel(trend: 'increasing' | 'stable' | 'decreasing'): string {
  switch (trend) {
    case 'increasing':
      return '증가 추세';
    case 'decreasing':
      return '감소 추세';
    default:
      return '안정';
  }
}

function getTrendIcon(trend: 'increasing' | 'stable' | 'decreasing') {
  switch (trend) {
    case 'increasing':
      return (
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
        </svg>
      );
    case 'decreasing':
      return (
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      );
    default:
      return (
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14" />
        </svg>
      );
  }
}

function getTrendTextColor(trend: 'increasing' | 'stable' | 'decreasing'): string {
  switch (trend) {
    case 'increasing':
      return 'text-yellow-500';
    case 'decreasing':
      return 'text-green-500';
    default:
      return 'text-muted-foreground';
  }
}

function getProgressColor(percentage: number): string {
  if (percentage >= 90) return 'bg-red-500';
  if (percentage >= 70) return 'bg-yellow-500';
  return 'bg-green-500';
}
