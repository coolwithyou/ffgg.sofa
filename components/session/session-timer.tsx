'use client';

/**
 * 세션 타이머 컴포넌트
 * 남은 세션 시간을 초 단위로 표시하고 연장 버튼 제공
 */

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

interface SessionTimerProps {
  initialExpiresAt: number; // 서버에서 전달받은 만료 시간 (Unix timestamp, 초)
}

// 5분 = 300초 (경고 임계값)
const WARNING_THRESHOLD = 300;

/**
 * 초를 HH:MM:SS 형식으로 변환
 */
function formatTime(seconds: number): string {
  if (seconds <= 0) return '00:00:00';

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export function SessionTimer({ initialExpiresAt }: SessionTimerProps) {
  const router = useRouter();
  const [expiresAt, setExpiresAt] = useState(initialExpiresAt);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [isExtending, setIsExtending] = useState(false);

  // 남은 시간 계산
  const calculateRemaining = useCallback(() => {
    const nowSeconds = Math.floor(Date.now() / 1000);
    return Math.max(0, expiresAt - nowSeconds);
  }, [expiresAt]);

  // 자동 로그아웃
  const handleAutoLogout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // 로그아웃 실패해도 로그인 페이지로 이동
    }
    router.push('/login?reason=session_expired');
  }, [router]);

  // 1초마다 타이머 업데이트
  useEffect(() => {
    // 초기값 설정
    setRemainingSeconds(calculateRemaining());

    const interval = setInterval(() => {
      const remaining = calculateRemaining();
      setRemainingSeconds(remaining);

      // 만료 시 자동 로그아웃
      if (remaining <= 0) {
        clearInterval(interval);
        handleAutoLogout();
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [calculateRemaining, handleAutoLogout]);

  // 세션 연장
  const handleExtend = async () => {
    if (isExtending) return;

    setIsExtending(true);
    try {
      const response = await fetch('/api/auth/session/extend', {
        method: 'POST',
      });

      if (!response.ok) {
        // 세션 만료 등의 이유로 연장 실패
        handleAutoLogout();
        return;
      }

      const data = await response.json();
      setExpiresAt(data.expiresAt);
    } catch {
      console.error('세션 연장 실패');
    } finally {
      setIsExtending(false);
    }
  };

  const isWarning = remainingSeconds <= WARNING_THRESHOLD && remainingSeconds > 0;

  return (
    <div className="flex items-center gap-2">
      {/* 시계 아이콘 */}
      <ClockIcon className={`h-4 w-4 ${isWarning ? 'text-destructive' : 'text-muted-foreground'}`} />

      {/* 남은 시간 표시 */}
      <span
        className={`font-mono text-sm ${isWarning ? 'font-medium text-destructive' : 'text-muted-foreground'}`}
      >
        {formatTime(remainingSeconds)}
      </span>

      {/* 연장 버튼 */}
      <button
        onClick={handleExtend}
        disabled={isExtending}
        className="rounded border border-border px-2 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
      >
        {isExtending ? '...' : '+60분'}
      </button>
    </div>
  );
}

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      strokeWidth={2}
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
