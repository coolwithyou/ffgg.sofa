'use client';

/**
 * 관리자 헤더 컴포넌트
 * [Week 10] 운영 도구 헤더
 */

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
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
              {/* 마이페이지 메뉴 */}
              <Link
                href="/mypage/profile"
                onClick={() => setIsMenuOpen(false)}
                className="flex w-full items-center gap-2 px-4 py-2 text-sm text-foreground hover:bg-muted"
              >
                <UserIcon className="h-4 w-4" />
                프로필
              </Link>
              <Link
                href="/mypage/security"
                onClick={() => setIsMenuOpen(false)}
                className="flex w-full items-center gap-2 px-4 py-2 text-sm text-foreground hover:bg-muted"
              >
                <ShieldIcon className="h-4 w-4" />
                보안
              </Link>
              <Link
                href="/mypage/notifications"
                onClick={() => setIsMenuOpen(false)}
                className="flex w-full items-center gap-2 px-4 py-2 text-sm text-foreground hover:bg-muted"
              >
                <BellIcon className="h-4 w-4" />
                알림
              </Link>
              <Link
                href="/mypage/subscription"
                onClick={() => setIsMenuOpen(false)}
                className="flex w-full items-center gap-2 px-4 py-2 text-sm text-foreground hover:bg-muted"
              >
                <CreditCardIcon className="h-4 w-4" />
                구독
              </Link>

              {/* 구분선 */}
              <div className="my-1 border-t border-border" />

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

function UserIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
      />
    </svg>
  );
}

function ShieldIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
      />
    </svg>
  );
}

function BellIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
      />
    </svg>
  );
}

function CreditCardIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
      />
    </svg>
  );
}
