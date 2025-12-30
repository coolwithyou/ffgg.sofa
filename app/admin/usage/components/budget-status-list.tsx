'use client';

/**
 * 예산 상태 리스트
 * 모든 테넌트의 예산 사용 현황을 표시합니다.
 */

import type { BudgetStatus } from '@/lib/usage/types';

interface BudgetStatusListProps {
  budgetStatuses: BudgetStatus[];
}

export function BudgetStatusList({ budgetStatuses }: BudgetStatusListProps) {
  if (budgetStatuses.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-6">
        <h2 className="mb-4 text-lg font-semibold text-foreground">예산 현황</h2>
        <div className="flex h-32 items-center justify-center">
          <p className="text-muted-foreground">데이터가 없습니다.</p>
        </div>
      </div>
    );
  }

  // 경고 상태인 테넌트 수
  const warningCount = budgetStatuses.filter((s) => s.alertLevel !== 'normal').length;
  const criticalCount = budgetStatuses.filter(
    (s) => s.alertLevel === 'critical' || s.isOverBudget
  ).length;

  // 정렬: 사용률 높은 순
  const sortedStatuses = [...budgetStatuses].sort(
    (a, b) => b.usagePercentage - a.usagePercentage
  );

  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">예산 현황</h2>
        <div className="flex items-center gap-3">
          {criticalCount > 0 && (
            <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
              위험 {criticalCount}
            </span>
          )}
          {warningCount > 0 && (
            <span className="rounded-full bg-yellow-500/10 px-2 py-0.5 text-xs font-medium text-yellow-500">
              주의 {warningCount}
            </span>
          )}
        </div>
      </div>

      <div className="space-y-3">
        {sortedStatuses.slice(0, 10).map((status) => (
          <div
            key={status.tenantId}
            className={`rounded-lg border p-3 ${
              status.isOverBudget
                ? 'border-destructive/50 bg-destructive/5'
                : status.alertLevel === 'critical'
                  ? 'border-destructive/30 bg-destructive/5'
                  : status.alertLevel === 'warning'
                    ? 'border-yellow-500/30 bg-yellow-500/5'
                    : 'border-border bg-background'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm text-foreground">
                  {truncateTenantId(status.tenantId)}
                </span>
                <TierBadge tier={status.tier} />
              </div>
              <AlertBadge alertLevel={status.alertLevel} isOverBudget={status.isOverBudget} />
            </div>

            <div className="mt-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  ${status.currentUsageUsd.toFixed(2)} / ${status.monthlyBudgetUsd.toFixed(2)}
                </span>
                <span
                  className={`font-medium ${
                    status.isOverBudget
                      ? 'text-destructive'
                      : status.usagePercentage >= 90
                        ? 'text-destructive'
                        : status.usagePercentage >= 80
                          ? 'text-yellow-500'
                          : 'text-foreground'
                  }`}
                >
                  {status.usagePercentage.toFixed(1)}%
                </span>
              </div>

              <div className="mt-1 h-2 w-full rounded-full bg-muted">
                <div
                  className={`h-2 rounded-full transition-all ${
                    status.isOverBudget
                      ? 'bg-destructive'
                      : status.usagePercentage >= 90
                        ? 'bg-destructive'
                        : status.usagePercentage >= 80
                          ? 'bg-yellow-500'
                          : 'bg-primary'
                  }`}
                  style={{ width: `${Math.min(status.usagePercentage, 100)}%` }}
                />
              </div>

              <div className="mt-1 text-xs text-muted-foreground">
                남은 예산: ${status.remainingBudgetUsd.toFixed(2)}
              </div>
            </div>
          </div>
        ))}
      </div>

      {budgetStatuses.length > 10 && (
        <div className="mt-4 text-center">
          <button className="text-sm text-primary hover:underline">
            전체 {budgetStatuses.length}개 보기
          </button>
        </div>
      )}
    </div>
  );
}

function TierBadge({ tier }: { tier: string }) {
  const config: Record<string, string> = {
    basic: 'bg-muted text-muted-foreground',
    standard: 'bg-primary/10 text-primary',
    premium: 'bg-purple-500/10 text-purple-500',
  };

  return (
    <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${config[tier] || config.basic}`}>
      {tier}
    </span>
  );
}

function AlertBadge({
  alertLevel,
  isOverBudget,
}: {
  alertLevel: string;
  isOverBudget: boolean;
}) {
  if (isOverBudget) {
    return (
      <span className="rounded-full bg-destructive px-2 py-0.5 text-xs font-medium text-destructive-foreground">
        초과
      </span>
    );
  }

  if (alertLevel === 'critical') {
    return (
      <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
        위험
      </span>
    );
  }

  if (alertLevel === 'warning') {
    return (
      <span className="rounded-full bg-yellow-500/10 px-2 py-0.5 text-xs font-medium text-yellow-500">
        주의
      </span>
    );
  }

  return (
    <span className="rounded-full bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-500">
      정상
    </span>
  );
}

function truncateTenantId(id: string): string {
  if (id.length <= 12) return id;
  return `${id.slice(0, 8)}...${id.slice(-4)}`;
}
