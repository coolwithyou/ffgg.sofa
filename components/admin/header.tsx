'use client';

/**
 * 관리자 헤더 컴포넌트
 * [Week 10] 운영 도구 헤더
 */

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ThemeToggle } from '@/components/theme-toggle';
import { SessionTimer } from '@/components/session/session-timer';

interface AdminHeaderProps {
  operatorName: string;
  sessionExpiresAt: number;
}

export function AdminHeader({ operatorName, sessionExpiresAt }: AdminHeaderProps) {
  const router = useRouter();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isLoggingOut, startLogout] = useTransition();

  const handleLogout = () => {
    startLogout(async () => {
      try {
        const response = await fetch('/api/auth/logout', { method: 'POST' });
        if (!response.ok) {
          throw new Error('로그아웃 요청 실패');
        }
        router.push('/login');
        router.refresh();
      } catch (error) {
        console.error('Logout failed:', error);
        setIsMenuOpen(false);
        alert('로그아웃 중 오류가 발생했습니다. 다시 시도해주세요.');
      }
    });
  };

  return (
    <header className="flex h-14 items-center justify-between border-b border-border bg-background px-6">
      {/* 좌측: 페이지 타이틀 */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Admin Console</span>
      </div>

      {/* 우측: 시스템 상태 + 세션 타이머 + 테마 토글 + 사용자 메뉴 */}
      <div className="flex items-center gap-4">
        {/* 시스템 상태 표시 */}
        <span className="text-sm text-muted-foreground">All systems operational</span>

        {/* 세션 타이머 */}
        <SessionTimer initialExpiresAt={sessionExpiresAt} />

        {/* 테마 토글 */}
        <ThemeToggle />

        {/* 사용자 메뉴 */}
        <div className="relative">
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted"
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
              {operatorName.charAt(0).toUpperCase()}
            </div>
            <span className="text-sm text-foreground">{operatorName}</span>
          </button>

          {isMenuOpen && (
            <div className="absolute right-0 top-full mt-1 w-48 rounded-md border border-border bg-card py-1">
              <button
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-foreground hover:bg-muted disabled:opacity-50"
              >
                <LogoutIcon className="h-4 w-4" />
                {isLoggingOut ? '로그아웃 중...' : '로그아웃'}
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

function LogoutIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
      />
    </svg>
  );
}
