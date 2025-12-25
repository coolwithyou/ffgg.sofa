'use client';

/**
 * 이메일 인증 페이지
 */

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useState, useEffect, Suspense } from 'react';

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('유효하지 않은 인증 링크입니다.');
      return;
    }

    async function verifyEmail() {
      try {
        const response = await fetch('/api/auth/verify-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });

        const data = await response.json();

        if (!response.ok) {
          setStatus('error');
          setMessage(data.error?.message || '이메일 인증에 실패했습니다.');
          return;
        }

        setStatus('success');
        setMessage('이메일이 성공적으로 인증되었습니다.');
      } catch {
        setStatus('error');
        setMessage('서버 연결에 실패했습니다.');
      }
    }

    verifyEmail();
  }, [token]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md text-center">
        {/* 로고 */}
        <div className="mb-8">
          <Link href="/" className="inline-flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-500">
              <span className="text-xl font-bold text-white">S</span>
            </div>
            <span className="text-2xl font-bold text-gray-900">SOFA</span>
          </Link>
        </div>

        <div className="rounded-xl bg-white p-8 shadow-sm">
          {status === 'loading' && (
            <>
              <div className="mb-4 flex justify-center">
                <div className="h-12 w-12 animate-spin rounded-full border-4 border-orange-500 border-t-transparent" />
              </div>
              <h1 className="text-xl font-bold text-gray-900">이메일 인증 중...</h1>
              <p className="mt-2 text-gray-600">잠시만 기다려주세요.</p>
            </>
          )}

          {status === 'success' && (
            <>
              <div className="mb-4 flex justify-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                  <svg className="h-6 w-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              </div>
              <h1 className="text-xl font-bold text-gray-900">인증 완료</h1>
              <p className="mt-2 text-gray-600">{message}</p>
              <Link
                href="/login"
                className="mt-6 inline-block rounded-lg bg-orange-500 px-6 py-3 font-medium text-white hover:bg-orange-600"
              >
                로그인하기
              </Link>
            </>
          )}

          {status === 'error' && (
            <>
              <div className="mb-4 flex justify-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
                  <svg className="h-6 w-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
              </div>
              <h1 className="text-xl font-bold text-gray-900">인증 실패</h1>
              <p className="mt-2 text-gray-600">{message}</p>
              <p className="mt-4 text-sm text-gray-500">
                링크가 만료되었거나 이미 인증이 완료된 경우일 수 있습니다.
              </p>
            </>
          )}
        </div>

        {/* 홈으로 */}
        <div className="mt-8">
          <Link href="/" className="text-sm text-gray-500 hover:text-gray-700">
            ← 홈으로 돌아가기
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-gray-500">로딩 중...</div>
      </div>
    }>
      <VerifyEmailContent />
    </Suspense>
  );
}
