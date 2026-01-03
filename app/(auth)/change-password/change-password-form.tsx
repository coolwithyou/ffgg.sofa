'use client';

/**
 * 비밀번호 변경 폼 컴포넌트
 */

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { changePassword } from './actions';

interface ChangePasswordFormProps {
  email: string;
}

export function ChangePasswordForm({ email }: ChangePasswordFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    const formData = new FormData(e.currentTarget);
    const currentPassword = formData.get('currentPassword') as string;
    const newPassword = formData.get('newPassword') as string;
    const confirmPassword = formData.get('confirmPassword') as string;

    // 클라이언트 검증
    if (newPassword.length < 8) {
      setError('새 비밀번호는 8자 이상이어야 합니다.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('새 비밀번호가 일치하지 않습니다.');
      return;
    }

    if (newPassword === currentPassword) {
      setError('새 비밀번호는 현재 비밀번호와 달라야 합니다.');
      return;
    }

    startTransition(async () => {
      const result = await changePassword(formData);

      if (result.success) {
        // 성공 시 콘솔로 이동
        router.push('/console');
        router.refresh();
      } else {
        setError(result.error || '비밀번호 변경에 실패했습니다.');
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
      )}

      <div>
        <label htmlFor="email" className="block text-sm font-medium text-foreground">
          이메일
        </label>
        <input
          type="email"
          id="email"
          value={email}
          disabled
          className="mt-1 w-full rounded-md border border-border bg-muted px-3 py-2 text-muted-foreground"
        />
      </div>

      <div>
        <label htmlFor="currentPassword" className="block text-sm font-medium text-foreground">
          현재 비밀번호 (임시 비밀번호)
        </label>
        <input
          type="password"
          id="currentPassword"
          name="currentPassword"
          required
          className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          placeholder="현재 비밀번호 입력"
        />
      </div>

      <div>
        <label htmlFor="newPassword" className="block text-sm font-medium text-foreground">
          새 비밀번호
        </label>
        <input
          type="password"
          id="newPassword"
          name="newPassword"
          required
          minLength={8}
          className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          placeholder="8자 이상의 새 비밀번호"
        />
      </div>

      <div>
        <label htmlFor="confirmPassword" className="block text-sm font-medium text-foreground">
          새 비밀번호 확인
        </label>
        <input
          type="password"
          id="confirmPassword"
          name="confirmPassword"
          required
          minLength={8}
          className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          placeholder="새 비밀번호 다시 입력"
        />
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="mt-2 w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
      >
        {isPending ? '변경 중...' : '비밀번호 변경'}
      </button>
    </form>
  );
}
