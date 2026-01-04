'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Gem, AlertTriangle, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { LOW_POINTS_THRESHOLD } from '@/lib/points/constants';
import { Progress } from '@/components/ui/progress';
import { SidebarMenu, SidebarMenuItem, SidebarMenuButton } from '@/components/ui/sidebar';
import { Skeleton } from '@/components/ui/skeleton';

interface PointsData {
  balance: {
    balance: number;
    monthlyPointsBase: number;
    isLow: boolean;
  };
  monthlyUsage: {
    used: number;
    transactionCount: number;
  };
}

/**
 * 사이드바 포인트 현황 위젯
 *
 * - 현재 포인트 잔액 표시
 * - 이번 달 사용량 프로그레스 바
 * - 포인트 부족 시 경고 스타일
 * - 클릭 시 구독 관리 페이지로 이동
 */
export function PointWidget() {
  const [data, setData] = useState<PointsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    async function fetchPoints() {
      try {
        const res = await fetch('/api/points');
        if (!res.ok) throw new Error('Failed to fetch');
        const json = await res.json();
        setData(json);
        setError(false);
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    }

    fetchPoints();

    // 5분마다 갱신
    const interval = setInterval(fetchPoints, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // 로딩 상태
  if (loading) {
    return (
      <div className="px-3 py-2">
        <Skeleton className="h-16 w-full rounded-lg" />
      </div>
    );
  }

  // 에러 상태
  if (error || !data) {
    return null; // 에러 시 위젯 숨김
  }

  const { balance, monthlyUsage } = data;
  const isLow = balance.balance <= LOW_POINTS_THRESHOLD;

  // 월간 사용률 계산 (월간 기본 포인트 대비)
  // Free 플랜(monthlyPointsBase = 0)은 체험 포인트 500 기준
  const basePoints = balance.monthlyPointsBase || 500;
  const usagePercent = Math.min(
    Math.round((monthlyUsage.used / basePoints) * 100),
    100
  );

  return (
    <div className="px-2 pb-2">
      <Link
        href="/console/account/subscription"
        className={cn(
          'flex flex-col gap-2 rounded-lg border p-3 transition-colors',
          'hover:bg-accent',
          isLow
            ? 'border-destructive/50 bg-destructive/5'
            : 'border-border bg-card'
        )}
      >
        {/* 상단: 포인트 잔액 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isLow ? (
              <AlertTriangle className="h-4 w-4 text-destructive" />
            ) : (
              <Gem className="h-4 w-4 text-primary" />
            )}
            <span
              className={cn(
                'text-lg font-bold tabular-nums',
                isLow ? 'text-destructive' : 'text-foreground'
              )}
            >
              {balance.balance.toLocaleString()}
              <span className="ml-0.5 text-sm font-medium">P</span>
            </span>
          </div>

          {/* 충전 유도 (포인트 부족 시) */}
          {isLow && (
            <span className="text-xs text-destructive">충전 필요</span>
          )}
        </div>

        {/* 중단: 프로그레스 바 */}
        <Progress
          value={usagePercent}
          className={cn(
            'h-1.5',
            isLow ? '[&>div]:bg-destructive' : '[&>div]:bg-primary'
          )}
        />

        {/* 하단: 사용량 텍스트 */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>이번 달 {monthlyUsage.used.toLocaleString()}P 사용</span>
          <span>{usagePercent}%</span>
        </div>
      </Link>
    </div>
  );
}

/**
 * 축소된 사이드바용 포인트 아이콘
 *
 * SidebarMenuButton 스타일과 일관성 유지
 */
export function PointWidgetCollapsed() {
  const [balance, setBalance] = useState<number | null>(null);
  const [isLow, setIsLow] = useState(false);

  useEffect(() => {
    async function fetchPoints() {
      try {
        const res = await fetch('/api/points');
        if (!res.ok) throw new Error('Failed to fetch');
        const json: PointsData = await res.json();
        setBalance(json.balance.balance);
        setIsLow(json.balance.balance <= LOW_POINTS_THRESHOLD);
      } catch {
        // 에러 시 무시
      }
    }

    fetchPoints();
    const interval = setInterval(fetchPoints, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  if (balance === null) return null;

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton
          asChild
          tooltip={`${balance.toLocaleString()}P 잔여`}
        >
          <Link
            href="/console/account/subscription"
            className={cn(isLow && 'text-destructive')}
          >
            {isLow ? (
              <AlertTriangle className="h-4 w-4" />
            ) : (
              <Gem className="h-4 w-4" />
            )}
            <span className="tabular-nums">{balance.toLocaleString()}P</span>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
