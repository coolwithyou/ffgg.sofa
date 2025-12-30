'use client';

/**
 * 알림 설정 탭
 * Phase 3.2: 알림 유형별 설정 관리
 */

import { useState, useEffect } from 'react';

interface NotificationSettings {
  security: boolean;
  usage: boolean;
  marketing: boolean;
}

const NOTIFICATION_OPTIONS = [
  {
    key: 'security' as const,
    title: '보안 알림',
    description: '새 기기 로그인, 비밀번호 변경, 2FA 설정 변경 시 알림을 받습니다.',
    icon: (
      <svg
        className="h-5 w-5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
        />
      </svg>
    ),
    recommended: true,
  },
  {
    key: 'usage' as const,
    title: '사용량 알림',
    description: '사용량 한도 80% 도달, 한도 초과 시 알림을 받습니다.',
    icon: (
      <svg
        className="h-5 w-5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
        />
      </svg>
    ),
    recommended: true,
  },
  {
    key: 'marketing' as const,
    title: '마케팅 알림',
    description: '새로운 기능, 프로모션, 이벤트 소식을 받습니다.',
    icon: (
      <svg
        className="h-5 w-5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z"
        />
      </svg>
    ),
    recommended: false,
  },
];

export default function NotificationsPage() {
  const [settings, setSettings] = useState<NotificationSettings>({
    security: true,
    usage: true,
    marketing: false,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const [pendingChanges, setPendingChanges] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const res = await fetch('/api/user/notification-settings');
      if (!res.ok) {
        throw new Error('설정을 불러올 수 없습니다.');
      }

      const data = await res.json();
      setSettings(data.settings);
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggle = async (key: keyof NotificationSettings) => {
    const newValue = !settings[key];
    const newSettings = { ...settings, [key]: newValue };

    // 낙관적 업데이트
    setSettings(newSettings);
    setPendingChanges((prev) => new Set(prev).add(key));
    setSaveStatus(null);

    try {
      const res = await fetch('/api/user/notification-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: { [key]: newValue } }),
      });

      if (!res.ok) {
        // 실패 시 롤백
        setSettings(settings);
        throw new Error('설정 저장에 실패했습니다.');
      }

      setSaveStatus({ type: 'success', text: '설정이 저장되었습니다.' });
      setTimeout(() => setSaveStatus(null), 2000);
    } catch (err) {
      setSaveStatus({
        type: 'error',
        text: err instanceof Error ? err.message : '오류가 발생했습니다.',
      });
    } finally {
      setPendingChanges((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive">
        {error}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* 안내 문구 */}
      <div className="rounded-lg border border-border bg-card p-6">
        <h2 className="mb-2 text-lg font-semibold text-foreground">
          알림 설정
        </h2>
        <p className="text-sm text-muted-foreground">
          이메일로 받을 알림 유형을 선택하세요. 보안 알림은 계정 보호를 위해
          활성화하는 것을 권장합니다.
        </p>
      </div>

      {/* 저장 상태 메시지 */}
      {saveStatus && (
        <div
          className={`rounded-lg border p-3 text-sm ${
            saveStatus.type === 'success'
              ? 'border-green-500/50 bg-green-500/10 text-green-500'
              : 'border-destructive/50 bg-destructive/10 text-destructive'
          }`}
        >
          {saveStatus.text}
        </div>
      )}

      {/* 알림 설정 목록 */}
      <div className="rounded-lg border border-border bg-card divide-y divide-border">
        {NOTIFICATION_OPTIONS.map((option) => (
          <div
            key={option.key}
            className="flex items-center justify-between p-4"
          >
            <div className="flex items-start gap-4">
              {/* 아이콘 */}
              <div className="mt-0.5 text-muted-foreground">{option.icon}</div>

              {/* 텍스트 */}
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-foreground">
                    {option.title}
                  </span>
                  {option.recommended && (
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                      권장
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {option.description}
                </p>
              </div>
            </div>

            {/* 토글 스위치 */}
            <button
              onClick={() => handleToggle(option.key)}
              disabled={pendingChanges.has(option.key)}
              className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                settings[option.key] ? 'bg-primary' : 'bg-muted'
              } ${pendingChanges.has(option.key) ? 'opacity-50' : ''}`}
              role="switch"
              aria-checked={settings[option.key]}
            >
              <span
                className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                  settings[option.key] ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        ))}
      </div>

      {/* 추가 안내 */}
      <p className="text-center text-sm text-muted-foreground">
        알림 설정은 즉시 적용됩니다. 필수 알림(비밀번호 재설정 등)은 항상 발송됩니다.
      </p>
    </div>
  );
}
