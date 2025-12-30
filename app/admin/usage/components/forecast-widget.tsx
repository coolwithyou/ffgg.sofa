'use client';

/**
 * 예측 위젯
 * 월말 예상 비용과 트렌드를 표시합니다.
 */

import type { Forecast } from '@/lib/usage/types';

interface ForecastWidgetProps {
  forecast: Forecast;
}

export function ForecastWidget({ forecast }: ForecastWidgetProps) {
  const {
    currentMonthUsage,
    projectedMonthlyUsage,
    daysRemaining,
    dailyAverage,
    trend,
    confidenceLevel,
  } = forecast;

  const projectedIncrease = projectedMonthlyUsage - currentMonthUsage;

  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">월말 예측</h2>
        <ConfidenceBadge level={confidenceLevel} />
      </div>

      {/* 메인 예측 값 */}
      <div className="mb-6 text-center">
        <div className="text-3xl font-bold text-foreground">
          ${projectedMonthlyUsage.toFixed(2)}
        </div>
        <div className="mt-1 flex items-center justify-center gap-2 text-sm">
          <TrendIndicator trend={trend} />
          <span className="text-muted-foreground">예상 월간 비용</span>
        </div>
      </div>

      {/* 상세 정보 */}
      <div className="space-y-3">
        <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2">
          <span className="text-sm text-muted-foreground">현재 사용량</span>
          <span className="font-medium text-foreground">${currentMonthUsage.toFixed(2)}</span>
        </div>

        <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2">
          <span className="text-sm text-muted-foreground">일평균 비용</span>
          <span className="font-medium text-foreground">${dailyAverage.toFixed(4)}</span>
        </div>

        <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2">
          <span className="text-sm text-muted-foreground">남은 일수</span>
          <span className="font-medium text-foreground">{daysRemaining}일</span>
        </div>

        <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2">
          <span className="text-sm text-muted-foreground">예상 추가 비용</span>
          <span
            className={`font-medium ${projectedIncrease > 0 ? 'text-yellow-500' : 'text-green-500'}`}
          >
            +${projectedIncrease.toFixed(2)}
          </span>
        </div>
      </div>

      {/* 트렌드 분석 */}
      <div className="mt-4 rounded-lg border border-border p-3">
        <div className="flex items-start gap-2">
          <TrendIcon trend={trend} />
          <div>
            <div className="text-sm font-medium text-foreground">{getTrendTitle(trend)}</div>
            <p className="mt-0.5 text-xs text-muted-foreground">{getTrendDescription(trend)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function ConfidenceBadge({ level }: { level: 'low' | 'medium' | 'high' }) {
  const config = {
    low: { label: '낮음', className: 'bg-muted text-muted-foreground' },
    medium: { label: '보통', className: 'bg-yellow-500/10 text-yellow-500' },
    high: { label: '높음', className: 'bg-green-500/10 text-green-500' },
  };

  const { label, className } = config[level];

  return (
    <span className={`rounded px-2 py-0.5 text-xs font-medium ${className}`}>신뢰도: {label}</span>
  );
}

function TrendIndicator({ trend }: { trend: 'increasing' | 'decreasing' | 'stable' }) {
  if (trend === 'increasing') {
    return (
      <span className="flex items-center text-yellow-500">
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
        </svg>
        <span className="ml-0.5 text-xs">증가</span>
      </span>
    );
  }

  if (trend === 'decreasing') {
    return (
      <span className="flex items-center text-green-500">
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
        </svg>
        <span className="ml-0.5 text-xs">감소</span>
      </span>
    );
  }

  return (
    <span className="flex items-center text-muted-foreground">
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14" />
      </svg>
      <span className="ml-0.5 text-xs">안정</span>
    </span>
  );
}

function TrendIcon({ trend }: { trend: 'increasing' | 'decreasing' | 'stable' }) {
  if (trend === 'increasing') {
    return (
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-yellow-500/10 text-yellow-500">
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
        </svg>
      </div>
    );
  }

  if (trend === 'decreasing') {
    return (
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-500/10 text-green-500">
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0v-8m0 8l-8-8-4 4-6-6" />
        </svg>
      </div>
    );
  }

  return (
    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14" />
      </svg>
    </div>
  );
}

function getTrendTitle(trend: 'increasing' | 'decreasing' | 'stable'): string {
  switch (trend) {
    case 'increasing':
      return '사용량 증가 추세';
    case 'decreasing':
      return '사용량 감소 추세';
    case 'stable':
      return '안정적인 사용량';
  }
}

function getTrendDescription(trend: 'increasing' | 'decreasing' | 'stable'): string {
  switch (trend) {
    case 'increasing':
      return '최근 7일간 사용량이 이전 7일 대비 10% 이상 증가했습니다.';
    case 'decreasing':
      return '최근 7일간 사용량이 이전 7일 대비 10% 이상 감소했습니다.';
    case 'stable':
      return '최근 사용량이 안정적으로 유지되고 있습니다.';
  }
}
