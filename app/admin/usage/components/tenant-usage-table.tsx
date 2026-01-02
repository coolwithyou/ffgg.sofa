'use client';

/**
 * 테넌트별 사용량 테이블
 * 사용량이 많은 상위 테넌트 목록을 표시합니다.
 */

import { formatCompactNumber, formatWithCommas } from '@/lib/format';

interface TopTenant {
  tenantId: string;
  tenantName: string;
  totalTokens: number;
  totalCostUsd: number;
}

interface TenantUsageTableProps {
  topTenants: TopTenant[];
}

export function TenantUsageTable({ topTenants }: TenantUsageTableProps) {
  if (topTenants.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-6">
        <h2 className="mb-4 text-lg font-semibold text-foreground">테넌트별 사용량</h2>
        <div className="flex h-32 items-center justify-center">
          <p className="text-muted-foreground">데이터가 없습니다.</p>
        </div>
      </div>
    );
  }

  // 총 비용 계산
  const totalCost = topTenants.reduce((sum, t) => sum + t.totalCostUsd, 0);

  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">테넌트별 사용량</h2>
        <span className="text-sm text-muted-foreground">이번 달 기준</span>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-border">
          <thead>
            <tr>
              <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                순위
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                테넌트 ID
              </th>
              <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                토큰 사용량
              </th>
              <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                비용
              </th>
              <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                비율
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {topTenants.map((tenant, index) => {
              const percentage = totalCost > 0 ? (tenant.totalCostUsd / totalCost) * 100 : 0;

              return (
                <tr key={tenant.tenantId} className="hover:bg-muted/50">
                  <td className="whitespace-nowrap px-3 py-3">
                    <span
                      className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium ${
                        index === 0
                          ? 'bg-yellow-500/10 text-yellow-500'
                          : index === 1
                            ? 'bg-muted text-muted-foreground'
                            : index === 2
                              ? 'bg-orange-500/10 text-orange-500'
                              : 'text-muted-foreground'
                      }`}
                    >
                      {index + 1}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-3">
                    <div>
                      <span className="text-sm font-medium text-foreground">
                        {tenant.tenantName}
                      </span>
                      <span className="ml-2 font-mono text-xs text-muted-foreground">
                        {truncateTenantId(tenant.tenantId)}
                      </span>
                    </div>
                  </td>
                  <td
                    className="whitespace-nowrap px-3 py-3 text-right text-sm text-foreground"
                    title={`${formatWithCommas(tenant.totalTokens)} 토큰`}
                  >
                    {formatCompactNumber(tenant.totalTokens)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-right">
                    <span className="font-medium text-foreground">
                      ${tenant.totalCostUsd.toFixed(2)}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <div className="h-1.5 w-16 rounded-full bg-muted">
                        <div
                          className="h-1.5 rounded-full bg-primary"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      <span className="w-12 text-sm text-muted-foreground">
                        {percentage.toFixed(1)}%
                      </span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 요약 */}
      <div className="mt-4 flex justify-end border-t border-border pt-3">
        <div className="text-sm">
          <span className="text-muted-foreground">상위 {topTenants.length}개 테넌트 총 비용: </span>
          <span className="font-semibold text-foreground">${totalCost.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
}

function truncateTenantId(id: string): string {
  if (id.length <= 12) return id;
  return `${id.slice(0, 8)}...${id.slice(-4)}`;
}
