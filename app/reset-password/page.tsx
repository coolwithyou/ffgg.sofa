'use client';

/**
 * 비밀번호 재설정 페이지
 */

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useState, useTransition, Suspense } from 'react';

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // 비밀번호 복잡성 검증
  function validatePassword(password: string): { valid: boolean; message: string } {
    if (password.length < 8) {
      return { valid: false, message: '비밀번호는 8자 이상이어야 합니다.' };
    }
    if (!/[A-Za-z]/.test(password)) {
      return { valid: false, message: '비밀번호에 영문자를 포함해야 합니다.' };
    }
    if (!/\d/.test(password)) {
      return { valid: false, message: '비밀번호에 숫자를 포함해야 합니다.' };
    }
    if (!/[@$!%*#?&]/.test(password)) {
      return { valid: false, message: '비밀번호에 특수문자(@$!%*#?&)를 포함해야 합니다.' };
    }
    return { valid: true, message: '' };
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const formData = new FormData(e.currentTarget);
    const password = formData.get('password') as string;
    const passwordConfirm = formData.get('passwordConfirm') as string;

    // 비밀번호 일치 확인
    if (password !== passwordConfirm) {
      setError('비밀번호가 일치하지 않습니다.');
      return;
    }

    // 비밀번호 복잡성 검사
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      setError(passwordValidation.message);
      return;
    }

    startTransition(async () => {
      try {
        const response = await fetch('/api/auth/reset-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, password }),
        });

        const data = await response.json();

        if (!response.ok) {
          setError(data.error?.message || '비밀번호 재설정에 실패했습니다.');
          return;
        }

        setSuccess(true);
      } catch {
        setError('서버 연결에 실패했습니다.');
      }
    });
  }

  // 토큰이 없는 경우
  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-md text-center">
          <div className="rounded-xl bg-white p-8 shadow-sm">
            <div className="mb-4 flex justify-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
                <svg className="h-6 w-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
            </div>
            <h1 className="text-xl font-bold text-gray-900">잘못된 접근</h1>
            <p className="mt-2 text-gray-600">
              유효하지 않은 비밀번호 재설정 링크입니다.
            </p>
          </div>
          <div className="mt-6">
            <Link href="/forgot-password" className="text-sm text-orange-500 hover:text-orange-600">
              비밀번호 찾기로 돌아가기
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // 성공 화면
  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-md text-center">
          <div className="rounded-xl bg-white p-8 shadow-sm">
            <div className="mb-4 flex justify-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                <svg className="h-6 w-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>
            <h1 className="text-xl font-bold text-gray-900">비밀번호가 변경되었습니다</h1>
            <p className="mt-2 text-gray-600">
              새 비밀번호로 로그인할 수 있습니다.
            </p>
          </div>
          <div className="mt-6">
            <Link
              href="/login"
              className="inline-block rounded-lg bg-orange-500 px-6 py-3 font-medium text-white hover:bg-orange-600"
            >
              로그인하기
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md">
        {/* 로고 */}
        <div className="mb-8 text-center">
          <Link href="/" className="inline-flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-500">
              <span className="text-xl font-bold text-white">S</span>
            </div>
            <span className="text-2xl font-bold text-gray-900">SOFA</span>
          </Link>
          <h1 className="mt-6 text-2xl font-bold text-gray-900">새 비밀번호 설정</h1>
          <p className="mt-2 text-gray-600">
            새로운 비밀번호를 입력하세요
          </p>
        </div>

        {/* 폼 */}
        <form onSubmit={handleSubmit} className="rounded-xl bg-white p-8 shadow-sm">
          {error && (
            <div role="alert" className="mb-4 rounded-lg bg-red-50 p-4 text-sm text-red-600">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                새 비밀번호
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                autoComplete="new-password"
                className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-3 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                placeholder="8자 이상 입력"
              />
              <p className="mt-1 text-xs text-gray-500">
                영문, 숫자, 특수문자 조합 8자 이상
              </p>
            </div>

            <div>
              <label htmlFor="passwordConfirm" className="block text-sm font-medium text-gray-700">
                비밀번호 확인
              </label>
              <input
                id="passwordConfirm"
                name="passwordConfirm"
                type="password"
                required
                autoComplete="new-password"
                className="mt-1 block w-full rounded-lg border border-gray-300 px-4 py-3 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                placeholder="비밀번호 재입력"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isPending}
            className="mt-6 w-full rounded-lg bg-orange-500 py-3 font-medium text-white hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPending ? '변경 중...' : '비밀번호 변경'}
          </button>
        </form>

        {/* 홈으로 */}
        <div className="mt-8 text-center">
          <Link href="/" className="text-sm text-gray-500 hover:text-gray-700">
            ← 홈으로 돌아가기
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-gray-500">로딩 중...</div>
      </div>
    }>
      <ResetPasswordForm />
    </Suspense>
  );
}
