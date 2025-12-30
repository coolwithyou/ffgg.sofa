'use client';

/**
 * 모니터링 새로고침 버튼 컴포넌트
 * [Week 10] 페이지 새로고침 기능
 */

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

export function MonitoringRefresh() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const handleRefresh = () => {
    startTransition(() => {
      router.refresh();
      setLastRefresh(new Date());
    });
  };

  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-muted-foreground">
        마지막 업데이트: {formatTime(lastRefresh)}
      </span>
      <button
        onClick={handleRefresh}
        disabled={isPending}
        className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
      >
        <RefreshIcon className={`h-4 w-4 ${isPending ? 'animate-spin' : ''}`} />
        {isPending ? '새로고침 중...' : '새로고침'}
      </button>
    </div>
  );
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function RefreshIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
      />
    </svg>
  );
}
