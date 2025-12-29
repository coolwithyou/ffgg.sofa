'use client';

/**
 * 비밀번호 찾기 페이지
 */

import Link from 'next/link';
import { useState, useTransition } from 'react';

export default function ForgotPasswordPage() {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;

    startTransition(async () => {
      try {
        const response = await fetch('/api/auth/forgot-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        });

        const data = await response.json();

        if (!response.ok) {
          setError(data.error?.message || '요청 처리에 실패했습니다.');
          return;
        }

        setSuccess(true);
      } catch {
        setError('서버 연결에 실패했습니다.');
      }
    });
  }

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-md text-center">
          <div className="mb-8">
            <Link href="/" className="inline-flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
                <span className="text-xl font-bold text-primary-foreground">S</span>
              </div>
              <span className="text-2xl font-bold text-foreground">SOFA</span>
            </Link>
          </div>

          <div className="rounded-xl border border-border bg-card p-8">
            <div className="mb-4 flex justify-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-500/10">
                <svg className="h-6 w-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>
            <h1 className="text-xl font-bold text-foreground">이메일을 확인하세요</h1>
            <p className="mt-2 text-muted-foreground">
              입력하신 이메일 주소로 비밀번호 재설정 링크를 발송했습니다.
              이메일을 확인하고 링크를 클릭해주세요.
            </p>
            <p className="mt-4 text-sm text-muted-foreground">
              이메일이 도착하지 않으면 스팸 폴더를 확인해주세요.
            </p>
          </div>

          <div className="mt-6">
            <Link href="/login" className="text-sm text-primary hover:text-primary/80">
              로그인으로 돌아가기
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        {/* 로고 */}
        <div className="mb-8 text-center">
          <Link href="/" className="inline-flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
              <span className="text-xl font-bold text-primary-foreground">S</span>
            </div>
            <span className="text-2xl font-bold text-foreground">SOFA</span>
          </Link>
          <h1 className="mt-6 text-2xl font-bold text-foreground">비밀번호 찾기</h1>
          <p className="mt-2 text-muted-foreground">
            가입한 이메일 주소를 입력하세요
          </p>
        </div>

        {/* 폼 */}
        <form onSubmit={handleSubmit} className="rounded-xl border border-border bg-card p-8">
          {error && (
            <div role="alert" className="mb-4 rounded-lg bg-destructive/10 p-4 text-sm text-destructive">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-foreground">
              이메일
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              className="mt-1 block w-full rounded-lg border border-border bg-background px-4 py-3 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="email@example.com"
            />
          </div>

          <button
            type="submit"
            disabled={isPending}
            className="mt-6 w-full rounded-lg bg-primary py-3 font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPending ? '전송 중...' : '재설정 링크 발송'}
          </button>
        </form>

        {/* 로그인 링크 */}
        <p className="mt-6 text-center text-muted-foreground">
          비밀번호가 기억나셨나요?{' '}
          <Link href="/login" className="font-medium text-primary hover:text-primary/80">
            로그인
          </Link>
        </p>

        {/* 홈으로 */}
        <div className="mt-8 text-center">
          <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
            ← 홈으로 돌아가기
          </Link>
        </div>
      </div>
    </div>
  );
}
