'use client';

/**
 * 보안 탭
 * 비밀번호 변경 및 2FA 설정
 */

import { useState } from 'react';

export default function SecurityPage() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();

    // 클라이언트 검증
    if (!currentPassword || !newPassword || !confirmPassword) {
      setMessage({ type: 'error', text: '모든 필드를 입력해주세요' });
      return;
    }

    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: '새 비밀번호가 일치하지 않습니다' });
      return;
    }

    if (newPassword.length < 8) {
      setMessage({ type: 'error', text: '비밀번호는 8자 이상이어야 합니다' });
      return;
    }

    try {
      setIsSubmitting(true);
      setMessage(null);

      const res = await fetch('/api/user/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword,
          newPassword,
          confirmPassword,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || '비밀번호 변경에 실패했습니다');
      }

      setMessage({ type: 'success', text: data.message });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : '오류가 발생했습니다',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* 비밀번호 변경 */}
      <div className="rounded-lg border border-border bg-card p-6">
        <h2 className="mb-6 text-lg font-semibold text-foreground">
          비밀번호 변경
        </h2>

        {message && (
          <div
            className={`mb-4 rounded-lg border p-4 ${
              message.type === 'success'
                ? 'border-green-500/50 bg-green-500/10 text-green-500'
                : 'border-destructive/50 bg-destructive/10 text-destructive'
            }`}
          >
            {message.text}
          </div>
        )}

        <form onSubmit={handlePasswordChange} className="space-y-4">
          <div>
            <label
              htmlFor="currentPassword"
              className="block text-sm font-medium text-muted-foreground"
            >
              현재 비밀번호
            </label>
            <input
              id="currentPassword"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="mt-1 block w-full rounded-md border border-border bg-background px-3 py-2 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="현재 비밀번호"
            />
          </div>

          <div>
            <label
              htmlFor="newPassword"
              className="block text-sm font-medium text-muted-foreground"
            >
              새 비밀번호
            </label>
            <input
              id="newPassword"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="mt-1 block w-full rounded-md border border-border bg-background px-3 py-2 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="새 비밀번호 (8자 이상)"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              대문자, 소문자, 숫자, 특수문자를 포함하면 더 안전합니다
            </p>
          </div>

          <div>
            <label
              htmlFor="confirmPassword"
              className="block text-sm font-medium text-muted-foreground"
            >
              새 비밀번호 확인
            </label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="mt-1 block w-full rounded-md border border-border bg-background px-3 py-2 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="새 비밀번호 확인"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {isSubmitting ? '변경 중...' : '비밀번호 변경'}
          </button>
        </form>
      </div>

      {/* 2단계 인증 (2FA) */}
      <div className="rounded-lg border border-border bg-card p-6">
        <h2 className="mb-2 text-lg font-semibold text-foreground">
          2단계 인증 (2FA)
        </h2>
        <p className="mb-4 text-sm text-muted-foreground">
          TOTP 앱(Google Authenticator 등)을 사용하여 계정 보안을 강화하세요.
        </p>

        <div className="flex items-center justify-between rounded-lg bg-muted/50 p-4">
          <div>
            <p className="font-medium text-foreground">2단계 인증</p>
            <p className="text-sm text-muted-foreground">비활성화됨</p>
          </div>
          <button
            onClick={() => {
              // TODO: 2FA 설정 다이얼로그 표시
              alert('2FA 설정 기능은 곧 구현됩니다');
            }}
            className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
          >
            설정하기
          </button>
        </div>
      </div>

      {/* 로그인 기록 */}
      <div className="rounded-lg border border-border bg-card p-6">
        <h2 className="mb-4 text-lg font-semibold text-foreground">
          로그인 기록
        </h2>
        <p className="text-sm text-muted-foreground">
          로그인 기록 조회 기능은 곧 제공될 예정입니다.
        </p>
      </div>
    </div>
  );
}
