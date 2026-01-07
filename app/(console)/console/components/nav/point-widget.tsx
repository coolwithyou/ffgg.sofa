'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { Gem, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { LOW_POINTS_THRESHOLD } from '@/lib/points/constants';
import { Progress } from '@/components/ui/progress';
import { SidebarMenu, SidebarMenuItem, SidebarMenuButton } from '@/components/ui/sidebar';
import { Skeleton } from '@/components/ui/skeleton';
import { usePointsStore } from '@/lib/stores/points-store';

/**
 * 사이드바 포인트 현황 위젯
 *
 * - Zustand 스토어를 통한 전역 상태 관리
 * - 실시간 포인트 업데이트 지원
 * - 현재 포인트 잔액 표시
 * - 이번 달 사용량 프로그레스 바
 * - 포인트 부족 시 경고 스타일
 * - 클릭 시 구독 관리 페이지로 이동
 */
export function PointWidget() {
  const {
    balance,
    monthlyPointsBase,
    monthlyUsed,
    isLow,
    isLoading,
    error,
    fetchPoints,
  } = usePointsStore();

  useEffect(() => {
    // 초기 로드
    fetchPoints();

    // 5분마다 갱신 (백업용 폴링)
    const interval = setInterval(fetchPoints, 5 * 60 * 1000);

    // 탭 포커스 시 즉시 갱신
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchPoints();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [fetchPoints]);

  // 로딩 상태
  if (isLoading) {
    return (
      <div className="px-3 py-2">
        <Skeleton className="h-16 w-full rounded-lg" />
      </div>
    );
  }

  // 에러 상태 또는 데이터 없음
  if (error || balance === null) {
    return null;
  }

  // 월간 사용률 계산 (월간 기본 포인트 대비)
  // Free 플랜(monthlyPointsBase = 0)은 체험 포인트 500 기준
  const basePoints = monthlyPointsBase || 500;
  const usagePercent = Math.min(
    Math.round((monthlyUsed / basePoints) * 100),
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
              {balance.toLocaleString()}
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
          <span>이번 달 {monthlyUsed.toLocaleString()}P 사용</span>
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
 * Zustand 스토어 공유로 실시간 동기화
 */
export function PointWidgetCollapsed() {
  const { balance, isLow, isLoading, error, fetchPoints } = usePointsStore();

  useEffect(() => {
    // 스토어가 아직 로드되지 않았다면 로드
    if (balance === null && !isLoading && !error) {
      fetchPoints();
    }
  }, [balance, isLoading, error, fetchPoints]);

  if (isLoading || error || balance === null) {
    return null;
  }

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
