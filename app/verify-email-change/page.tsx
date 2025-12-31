'use client';

/**
 * 이메일 변경 인증 페이지
 * Phase 3.1: 이메일 링크 클릭 시 토큰 검증 및 이메일 변경 완료
 */

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';

type VerifyStatus = 'loading' | 'success' | 'error';

function VerifyEmailChangeContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');

  const [status, setStatus] = useState<VerifyStatus>('loading');
  const [message, setMessage] = useState('');
  const [newEmail, setNewEmail] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('인증 토큰이 없습니다.');
      return;
    }

    verifyToken(token);
  }, [token]);

  const verifyToken = async (token: string) => {
    try {
      const res = await fetch('/api/user/verify-email-change', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || '인증에 실패했습니다.');
      }

      setStatus('success');
      setMessage(data.message || '이메일이 성공적으로 변경되었습니다.');
      setNewEmail(data.newEmail);

      // 5초 후 로그인 페이지로 리다이렉트
      setTimeout(() => {
        router.push('/login');
      }, 5000);
    } catch (err) {
      setStatus('error');
      setMessage(
        err instanceof Error ? err.message : '인증에 실패했습니다.'
      );
    }
  };

  return (
    <>
      {/* 상태별 UI */}
      {status === 'loading' && (
        <div className="space-y-4">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-muted-foreground">이메일을 인증하는 중...</p>
        </div>
      )}

      {status === 'success' && (
        <div className="space-y-4">
          {/* 성공 아이콘 */}
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-500/10">
            <svg
              className="h-8 w-8 text-green-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-foreground">
              이메일 변경 완료
            </h2>
            <p className="mt-2 text-muted-foreground">{message}</p>
            {newEmail && (
              <p className="mt-2 font-medium text-primary">{newEmail}</p>
            )}
          </div>

          <p className="text-sm text-muted-foreground">
            5초 후 로그인 페이지로 이동합니다...
          </p>

          <Link
            href="/login"
            className="inline-block rounded-md bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            지금 로그인
          </Link>
        </div>
      )}

      {status === 'error' && (
        <div className="space-y-4">
          {/* 오류 아이콘 */}
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
            <svg
              className="h-8 w-8 text-destructive"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-destructive">
              인증 실패
            </h2>
            <p className="mt-2 text-muted-foreground">{message}</p>
          </div>

          <div className="space-y-2">
            <Link
              href="/mypage/profile"
              className="inline-block rounded-md bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              다시 시도
            </Link>
            <p className="text-sm text-muted-foreground">
              또는{' '}
              <Link href="/login" className="text-primary hover:underline">
                로그인
              </Link>
            </p>
          </div>
        </div>
      )}
    </>
  );
}

function LoadingFallback() {
  return (
    <div className="space-y-4">
      <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      <p className="text-muted-foreground">페이지를 불러오는 중...</p>
    </div>
  );
}

export default function VerifyEmailChangePage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="rounded-lg border border-border bg-card p-8 text-center shadow-lg">
          {/* 로고 */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-foreground">SOFA</h1>
            <p className="text-sm text-muted-foreground">이메일 변경 인증</p>
          </div>

          <Suspense fallback={<LoadingFallback />}>
            <VerifyEmailChangeContent />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
