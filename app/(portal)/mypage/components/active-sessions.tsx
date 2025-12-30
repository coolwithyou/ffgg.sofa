'use client';

/**
 * 활성 세션 관리 컴포넌트
 * 현재 로그인된 세션 목록 및 로그아웃 기능
 */

import { useEffect, useState } from 'react';

interface Session {
  id: string;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  expiresAt: string;
}

export function ActiveSessions() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    fetchSessions();
  }, []);

  const fetchSessions = async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/user/sessions');
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || '세션 정보를 불러올 수 없습니다');
      }

      setSessions(data.sessions);
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다');
    } finally {
      setIsLoading(false);
    }
  };

  const logoutSession = async (sessionId: string) => {
    try {
      setActionLoading(sessionId);
      const res = await fetch('/api/user/sessions', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || '세션 로그아웃에 실패했습니다');
      }

      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다');
    } finally {
      setActionLoading(null);
    }
  };

  const logoutAllSessions = async () => {
    if (!confirm('현재 세션을 포함한 모든 세션에서 로그아웃됩니다. 계속하시겠습니까?')) {
      return;
    }

    try {
      setActionLoading('all');
      const res = await fetch('/api/user/sessions', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ logoutAll: true }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || '모든 세션 로그아웃에 실패했습니다');
      }

      // 모든 세션 로그아웃 후 로그인 페이지로 이동
      window.location.href = '/login';
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다');
      setActionLoading(null);
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

  const parseUserAgent = (ua: string | null) => {
    if (!ua) return { browser: '알 수 없음', os: '알 수 없음' };

    let browser = '알 수 없음';
    let os = '알 수 없음';

    // 브라우저 감지
    if (ua.includes('Chrome') && !ua.includes('Edg')) {
      browser = 'Chrome';
    } else if (ua.includes('Firefox')) {
      browser = 'Firefox';
    } else if (ua.includes('Safari') && !ua.includes('Chrome')) {
      browser = 'Safari';
    } else if (ua.includes('Edg')) {
      browser = 'Edge';
    }

    // OS 감지
    if (ua.includes('Windows')) {
      os = 'Windows';
    } else if (ua.includes('Mac')) {
      os = 'macOS';
    } else if (ua.includes('Linux')) {
      os = 'Linux';
    } else if (ua.includes('Android')) {
      os = 'Android';
    } else if (ua.includes('iPhone') || ua.includes('iPad')) {
      os = 'iOS';
    }

    return { browser, os };
  };

  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">
          활성 세션
        </h2>
        {sessions.length > 0 && (
          <button
            onClick={logoutAllSessions}
            disabled={actionLoading === 'all'}
            className="rounded-md border border-destructive/50 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10 disabled:opacity-50"
          >
            {actionLoading === 'all' ? '처리 중...' : '모든 기기 로그아웃'}
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : error ? (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      ) : sessions.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          활성 세션이 없습니다.
        </p>
      ) : (
        <div className="space-y-3">
          {sessions.map((session, index) => {
            const { browser, os } = parseUserAgent(session.userAgent);
            const isFirst = index === 0;

            return (
              <div
                key={session.id}
                className={`flex items-center justify-between rounded-lg p-3 ${
                  isFirst ? 'border border-primary/50 bg-primary/10' : 'bg-muted/50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-background">
                    <svg className="h-5 w-5 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {browser} on {os}
                      {isFirst && (
                        <span className="ml-2 rounded bg-primary/20 px-2 py-0.5 text-xs text-primary">
                          현재 세션
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      IP: {session.ipAddress || '알 수 없음'} · 로그인: {formatDate(session.createdAt)}
                    </p>
                  </div>
                </div>
                {!isFirst && (
                  <button
                    onClick={() => logoutSession(session.id)}
                    disabled={actionLoading === session.id}
                    className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
                  >
                    {actionLoading === session.id ? '처리 중...' : '로그아웃'}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
