'use client';

/**
 * 로그인 기록 컴포넌트
 * 최근 로그인 시도 목록 표시
 */

import { useEffect, useState } from 'react';

interface LoginAttempt {
  id: string;
  ipAddress: string | null;
  success: boolean;
  createdAt: string;
}

export function LoginHistory() {
  const [history, setHistory] = useState<LoginAttempt[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/user/login-history?limit=20');
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || '로그인 기록을 불러올 수 없습니다');
      }

      setHistory(data.history);
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다');
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <h2 className="mb-4 text-lg font-semibold text-foreground">
        로그인 기록
      </h2>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : error ? (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      ) : history.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          로그인 기록이 없습니다.
        </p>
      ) : (
        <div className="space-y-2">
          {history.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between rounded-lg bg-muted/50 p-3"
            >
              <div className="flex items-center gap-3">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full ${
                    item.success
                      ? 'bg-green-500/20 text-green-500'
                      : 'bg-destructive/20 text-destructive'
                  }`}
                >
                  {item.success ? (
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {item.success ? '로그인 성공' : '로그인 실패'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    IP: {item.ipAddress || '알 수 없음'}
                  </p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                {formatDate(item.createdAt)}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
