'use client';

/**
 * 관리자 헤더 컴포넌트
 * [Week 10] 운영 도구 헤더
 */

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

interface AdminHeaderProps {
  operatorName: string;
}

export function AdminHeader({ operatorName }: AdminHeaderProps) {
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
        // 로그아웃 실패 시에도 클라이언트 측 상태는 초기화
        setIsMenuOpen(false);
        // 사용자에게 에러 표시 (alert 대신 향후 토스트 컴포넌트로 교체 가능)
        alert('로그아웃 중 오류가 발생했습니다. 다시 시도해주세요.');
      }
    });
  };

  return (
    <header className="flex h-16 items-center justify-between border-b bg-white px-6">
      {/* 좌측: 페이지 타이틀 */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-500">운영 콘솔</span>
      </div>

      {/* 우측: 시스템 상태 + 사용자 메뉴 */}
      <div className="flex items-center gap-4">
        {/* 시스템 상태 표시 */}
        <div className="flex items-center gap-2 rounded-full bg-green-100 px-3 py-1">
          <div className="h-2 w-2 rounded-full bg-green-500" />
          <span className="text-xs font-medium text-green-700">시스템 정상</span>
        </div>

        {/* 사용자 메뉴 */}
        <div className="relative">
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="flex items-center gap-2 rounded-lg px-3 py-2 hover:bg-gray-100"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-100">
              <span className="text-sm font-medium text-orange-600">
                {operatorName.charAt(0).toUpperCase()}
              </span>
            </div>
            <span className="text-sm font-medium text-gray-700">{operatorName}</span>
          </button>

          {isMenuOpen && (
            <div className="absolute right-0 top-full mt-1 w-48 rounded-lg border bg-white py-1 shadow-lg">
              <button
                onClick={handleLogout}
                disabled={isLoggingOut}
                className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-50"
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
