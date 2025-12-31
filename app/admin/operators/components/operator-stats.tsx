'use client';

/**
 * 관리자 통계 카드 컴포넌트
 */

import type { OperatorStats as Stats } from '../actions';

interface OperatorStatsProps {
  stats: Stats;
}

export function OperatorStats({ stats }: OperatorStatsProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {/* 전체 관리자 수 */}
      <div className="rounded-lg border border-border bg-card p-4">
        <p className="text-2xl font-bold text-foreground">{stats.total}</p>
        <p className="text-sm text-muted-foreground">전체 관리자</p>
      </div>

      {/* 역할별 분포 */}
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-baseline gap-2">
          <p className="text-2xl font-bold text-foreground">{stats.byRole.SUPER_ADMIN}</p>
          <span className="text-sm text-muted-foreground">슈퍼</span>
          <p className="text-xl font-semibold text-foreground">{stats.byRole.ADMIN}</p>
          <span className="text-sm text-muted-foreground">관리자</span>
        </div>
        <p className="text-sm text-muted-foreground">역할별 분포</p>
      </div>

      {/* 활성/비활성 */}
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-baseline gap-2">
          <p className="text-2xl font-bold text-green-500">{stats.active}</p>
          <span className="text-sm text-muted-foreground">활성</span>
          <p className="text-xl font-semibold text-muted-foreground">{stats.inactive}</p>
          <span className="text-sm text-muted-foreground">비활성</span>
        </div>
        <p className="text-sm text-muted-foreground">상태별 현황</p>
      </div>

      {/* 2FA 현황 */}
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-baseline gap-2">
          <p className="text-2xl font-bold text-primary">{stats.with2FA}</p>
          <span className="text-sm text-muted-foreground">활성화</span>
          <p className="text-xl font-semibold text-muted-foreground">{stats.without2FA}</p>
          <span className="text-sm text-muted-foreground">미설정</span>
        </div>
        <p className="text-sm text-muted-foreground">2FA 현황</p>
      </div>
    </div>
  );
}
