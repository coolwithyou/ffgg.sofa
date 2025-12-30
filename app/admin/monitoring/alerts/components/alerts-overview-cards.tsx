'use client';

/**
 * 알림 개요 카드
 * 전체 알림 수, 미확인 알림, 오늘 알림, 유형별 통계를 표시합니다.
 */

import type { AlertsOverview } from '../actions';

interface AlertsOverviewCardsProps {
  overview: AlertsOverview;
}

export function AlertsOverviewCards({ overview }: AlertsOverviewCardsProps) {
  const cards = [
    {
      title: '전체 알림',
      value: overview.total,
      color: 'text-foreground',
      bgColor: 'bg-muted',
    },
    {
      title: '미확인',
      value: overview.unacknowledged,
      color: 'text-destructive',
      bgColor: 'bg-destructive/10',
      highlight: overview.unacknowledged > 0,
    },
    {
      title: '오늘 발생',
      value: overview.today,
      color: 'text-primary',
      bgColor: 'bg-primary/10',
    },
    {
      title: '예산 초과',
      value: overview.byType.budget_exceeded,
      color: 'text-red-500',
      bgColor: 'bg-red-500/10',
      highlight: overview.byType.budget_exceeded > 0,
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <div
          key={card.title}
          className={`rounded-lg border p-4 ${
            card.highlight ? 'border-destructive/50' : 'border-border'
          } bg-card`}
        >
          <p className="text-sm text-muted-foreground">{card.title}</p>
          <div className="mt-2 flex items-center gap-3">
            <div className={`rounded-full p-2 ${card.bgColor}`}>
              <span className={`text-lg font-bold ${card.color}`}>{card.value}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * 알림 유형별 분포 카드
 */
export function AlertTypeBreakdown({ overview }: AlertsOverviewCardsProps) {
  const types = [
    {
      type: 'budget_warning',
      label: '예산 경고',
      count: overview.byType.budget_warning,
      color: 'bg-yellow-500',
    },
    {
      type: 'budget_critical',
      label: '예산 위험',
      count: overview.byType.budget_critical,
      color: 'bg-orange-500',
    },
    {
      type: 'budget_exceeded',
      label: '예산 초과',
      count: overview.byType.budget_exceeded,
      color: 'bg-red-500',
    },
    {
      type: 'anomaly_spike',
      label: '이상 급증',
      count: overview.byType.anomaly_spike,
      color: 'bg-purple-500',
    },
  ];

  const total = types.reduce((sum, t) => sum + t.count, 0) || 1;

  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <h2 className="mb-4 text-lg font-semibold text-foreground">알림 유형 분포</h2>
      <div className="space-y-3">
        {types.map((item) => {
          const percentage = (item.count / total) * 100;
          return (
            <div key={item.type}>
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{item.label}</span>
                <span className="font-medium text-foreground">{item.count}건</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className={`h-full ${item.color}`}
                  style={{ width: `${Math.max(percentage, 2)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
