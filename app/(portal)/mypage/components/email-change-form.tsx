'use client';

/**
 * 이메일 변경 폼 컴포넌트
 * Phase 3.1: 새 이메일로 인증 메일 발송 요청
 */

import { useState } from 'react';

interface EmailChangeFormProps {
  currentEmail: string;
  onSuccess?: () => void;
}

export default function EmailChangeForm({
  currentEmail,
  onSuccess,
}: EmailChangeFormProps) {
  const [newEmail, setNewEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (!newEmail.trim() || !password) {
      setMessage({ type: 'error', text: '모든 필드를 입력해주세요.' });
      return;
    }

    // 이메일 형식 검증
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail)) {
      setMessage({ type: 'error', text: '유효한 이메일 주소를 입력해주세요.' });
      return;
    }

    // 동일한 이메일인지 확인
    if (newEmail.toLowerCase() === currentEmail.toLowerCase()) {
      setMessage({ type: 'error', text: '현재 이메일과 동일합니다.' });
      return;
    }

    try {
      setIsLoading(true);

      const res = await fetch('/api/user/change-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newEmail, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || '이메일 변경 요청에 실패했습니다.');
      }

      setMessage({
        type: 'success',
        text: data.message || '인증 이메일이 발송되었습니다.',
      });
      setNewEmail('');
      setPassword('');
      setIsExpanded(false);
      onSuccess?.();
    } catch (err) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : '오류가 발생했습니다.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    setNewEmail('');
    setPassword('');
    setMessage(null);
    setIsExpanded(false);
  };

  return (
    <div className="space-y-4">
      {/* 현재 이메일 표시 */}
      <div className="flex items-center justify-between">
        <div>
          <label className="text-sm font-medium text-muted-foreground">
            이메일
          </label>
          <p className="mt-1 text-foreground">{currentEmail}</p>
        </div>
        {!isExpanded && (
          <button
            onClick={() => setIsExpanded(true)}
            className="text-sm text-primary hover:text-primary/80"
          >
            변경
          </button>
        )}
      </div>

      {/* 알림 메시지 */}
      {message && (
        <div
          className={`rounded-lg border p-3 text-sm ${
            message.type === 'success'
              ? 'border-green-500/50 bg-green-500/10 text-green-500'
              : 'border-destructive/50 bg-destructive/10 text-destructive'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* 이메일 변경 폼 */}
      {isExpanded && (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="rounded-lg border border-border bg-muted/30 p-4">
            <p className="mb-4 text-sm text-muted-foreground">
              새 이메일 주소로 인증 링크가 발송됩니다. 24시간 내에 인증을
              완료해주세요.
            </p>

            <div className="space-y-3">
              {/* 새 이메일 */}
              <div>
                <label
                  htmlFor="newEmail"
                  className="block text-sm font-medium text-foreground"
                >
                  새 이메일 주소
                </label>
                <input
                  type="email"
                  id="newEmail"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-border bg-background px-3 py-2 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder="new@example.com"
                  autoComplete="email"
                  disabled={isLoading}
                />
              </div>

              {/* 현재 비밀번호 */}
              <div>
                <label
                  htmlFor="emailChangePassword"
                  className="block text-sm font-medium text-foreground"
                >
                  현재 비밀번호
                </label>
                <input
                  type="password"
                  id="emailChangePassword"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-border bg-background px-3 py-2 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder="비밀번호 확인"
                  autoComplete="current-password"
                  disabled={isLoading}
                />
              </div>
            </div>

            {/* 버튼 */}
            <div className="mt-4 flex gap-2">
              <button
                type="submit"
                disabled={isLoading}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {isLoading ? '처리 중...' : '인증 메일 발송'}
              </button>
              <button
                type="button"
                onClick={handleCancel}
                disabled={isLoading}
                className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50"
              >
                취소
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
