'use client';

/**
 * 포털 헤더 컴포넌트
 * [Week 9] 사용자 정보 및 액션
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ThemeToggle } from '@/components/theme-toggle';
import { SessionTimer } from '@/components/session/session-timer';

interface PortalHeaderProps {
  userName: string;
  sessionExpiresAt: number;
}

export function PortalHeader({ userName, sessionExpiresAt }: PortalHeaderProps) {
  const router = useRouter();
  const [showDropdown, setShowDropdown] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
    } catch {
      setIsLoggingOut(false);
    }
  };

  return (
    <header className="flex h-14 items-center justify-between border-b border-border bg-background px-6">
      {/* 좌측: 페이지 타이틀 영역 (필요시 확장) */}
      <div />

      {/* 우측: 세션 타이머 + 테마 토글 + 사용자 메뉴 */}
      <div className="flex items-center gap-2">
        <SessionTimer initialExpiresAt={sessionExpiresAt} />
        <ThemeToggle />
        <div className="relative">
        <button
          onClick={() => setShowDropdown(!showDropdown)}
          className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
        >
          {/* 아바타 */}
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
            {userName.charAt(0).toUpperCase()}
          </div>
          <span className="text-sm text-foreground">{userName}</span>
          <ChevronDownIcon className="h-4 w-4 text-muted-foreground" />
        </button>

        {/* 드롭다운 메뉴 */}
        {showDropdown && (
          <>
            {/* 오버레이 */}
            <div
              className="fixed inset-0 z-10"
              onClick={() => setShowDropdown(false)}
            />
            {/* 메뉴 */}
            <div className="absolute right-0 z-20 mt-2 w-48 rounded-md border border-border bg-card py-1">
              {/* 마이페이지 메뉴 */}
              <Link
                href="/mypage/profile"
                onClick={() => setShowDropdown(false)}
                className="flex w-full items-center gap-2 px-4 py-2 text-sm text-foreground hover:bg-muted"
              >
                <UserIcon className="h-4 w-4" />
                프로필
              </Link>
              <Link
                href="/mypage/security"
                onClick={() => setShowDropdown(false)}
                className="flex w-full items-center gap-2 px-4 py-2 text-sm text-foreground hover:bg-muted"
              >
                <ShieldIcon className="h-4 w-4" />
                보안
              </Link>
              <Link
                href="/mypage/notifications"
                onClick={() => setShowDropdown(false)}
                className="flex w-full items-center gap-2 px-4 py-2 text-sm text-foreground hover:bg-muted"
              >
                <BellIcon className="h-4 w-4" />
                알림
              </Link>
              <Link
                href="/mypage/subscription"
                onClick={() => setShowDropdown(false)}
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
                className="flex w-full items-center gap-2 px-4 py-2 text-sm text-foreground hover:bg-muted disabled:opacity-50"
              >
                <LogoutIcon className="h-4 w-4" />
                {isLoggingOut ? '로그아웃 중...' : '로그아웃'}
              </button>
            </div>
          </>
        )}
        </div>
      </div>
    </header>
  );
}

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
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
