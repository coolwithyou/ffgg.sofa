'use client';

/**
 * 포털 헤더 컴포넌트
 * [Week 9] 사용자 정보 및 액션
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface PortalHeaderProps {
  userName: string;
}

export function PortalHeader({ userName }: PortalHeaderProps) {
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
    <header className="flex h-16 items-center justify-between border-b bg-white px-6">
      {/* 좌측: 페이지 타이틀 영역 (필요시 확장) */}
      <div />

      {/* 우측: 사용자 메뉴 */}
      <div className="relative">
        <button
          onClick={() => setShowDropdown(!showDropdown)}
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
        >
          {/* 아바타 */}
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-sm font-medium text-white">
            {userName.charAt(0).toUpperCase()}
          </div>
          <span>{userName}</span>
          <ChevronDownIcon className="h-4 w-4" />
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
            <div className="absolute right-0 z-20 mt-2 w-48 rounded-lg border bg-white py-1 shadow-lg">
              <button
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="flex w-full items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-50"
              >
                <LogoutIcon className="h-4 w-4" />
                {isLoggingOut ? '로그아웃 중...' : '로그아웃'}
              </button>
            </div>
          </>
        )}
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
