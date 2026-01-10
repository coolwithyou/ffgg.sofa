'use client';

/**
 * 로그인 페이지
 * [Week 12] 런칭 준비
 * 2FA (TOTP) 지원 추가
 */

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition, useEffect } from 'react';

type LoginStep = 'credentials' | 'totp';

export default function LoginPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<LoginStep>('credentials');
  const [credentials, setCredentials] = useState({ email: '', password: '' });
  const [totpCode, setTotpCode] = useState('');
  const [useBackupCode, setUseBackupCode] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  // 이미 로그인된 사용자 리다이렉트
  useEffect(() => {
    async function checkAuth() {
      try {
        const response = await fetch('/api/auth/me');
        if (response.ok) {
          const data = await response.json();
          // 역할에 따라 리다이렉트 (플랫폼 관리자 우선 체크)
          if (data.user?.isPlatformAdmin || data.user?.role === 'internal_operator') {
            router.replace('/admin/dashboard');
          } else {
            router.replace('/console');
          }
          return;
        }
      } catch {
        // 인증 실패 시 무시 (로그인 페이지 표시)
      }
      setIsCheckingAuth(false);
    }
    checkAuth();
  }, [router]);

  async function handleCredentialsSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;

    // 자격 증명 저장 (2FA 단계에서 재사용)
    setCredentials({ email, password });

    startTransition(async () => {
      try {
        const response = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });

        const data = await response.json();

        // 2FA 필요
        if (data.totpRequired) {
          setStep('totp');
          return;
        }

        if (!response.ok) {
          // AppError.toSafeResponse()는 { error: { code, message } } 형태 반환
          const errorMessage =
            typeof data.error === 'object'
              ? data.error?.message
              : data.error;
          setError(errorMessage || '로그인에 실패했습니다.');
          return;
        }

        // 역할에 따라 리다이렉트 (플랫폼 관리자 우선 체크)
        // Note: startTransition 내부에서 router.push() 사용 시 서버 컴포넌트 렌더링 완료까지
        // isPending이 유지되어 "로그인 중..." 상태가 멈출 수 있음. 하드 리다이렉트 사용.
        if (data.user?.isPlatformAdmin || data.user?.role === 'internal_operator') {
          window.location.href = '/admin/dashboard';
        } else {
          window.location.href = '/console';
        }
      } catch {
        setError('서버 연결에 실패했습니다.');
      }
    });
  }

  async function handleTotpSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      try {
        const response = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: credentials.email,
            password: credentials.password,
            totpToken: totpCode,
            useBackupCode,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          // AppError.toSafeResponse()는 { error: { code, message } } 형태 반환
          const errorMessage =
            typeof data.error === 'object'
              ? data.error?.message
              : data.error;
          setError(errorMessage || '인증에 실패했습니다.');
          return;
        }

        // 역할에 따라 리다이렉트 (플랫폼 관리자 우선 체크)
        // Note: startTransition 내부에서 router.push() 사용 시 서버 컴포넌트 렌더링 완료까지
        // isPending이 유지되어 "로그인 중..." 상태가 멈출 수 있음. 하드 리다이렉트 사용.
        if (data.user?.isPlatformAdmin || data.user?.role === 'internal_operator') {
          window.location.href = '/admin/dashboard';
        } else {
          window.location.href = '/console';
        }
      } catch {
        setError('서버 연결에 실패했습니다.');
      }
    });
  }

  function handleBackToCredentials() {
    setStep('credentials');
    setTotpCode('');
    setError(null);
    setUseBackupCode(false);
  }

  // 인증 상태 확인 중 로딩 표시
  if (isCheckingAuth) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-muted-foreground">로딩 중...</p>
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
          <h1 className="mt-6 text-2xl font-bold text-foreground">
            {step === 'credentials' ? '로그인' : '2단계 인증'}
          </h1>
          <p className="mt-2 text-muted-foreground">
            {step === 'credentials'
              ? '계정에 로그인하세요'
              : '인증 앱의 코드를 입력하세요'}
          </p>
        </div>

        {/* SSO 로그인 - 자격 증명 단계에서만 표시 */}
        {step === 'credentials' && (
          <div className="mb-6">
            <div className="flex flex-col gap-3">
              {/* Google 로그인 */}
              <button
                type="button"
                onClick={() => {
                  window.location.href = '/api/auth/google?mode=login';
                }}
                className="flex w-full items-center justify-center gap-3 rounded-lg border border-border bg-card py-3 font-medium text-foreground transition-colors hover:bg-muted"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                Google로 로그인
              </button>

              {/* Kakao 로그인 */}
              <button
                type="button"
                onClick={() => {
                  window.location.href = '/api/auth/kakao?mode=login';
                }}
                className="flex w-full items-center justify-center gap-3 rounded-lg py-3 font-medium transition-colors hover:opacity-90"
                style={{ backgroundColor: '#FEE500', color: '#000000' }}
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24">
                  <path
                    fill="#000000"
                    d="M12 3c-5.52 0-10 3.59-10 8.03 0 2.86 1.88 5.37 4.72 6.81-.21.79-.76 2.87-.87 3.31-.14.55.2.55.42.4.17-.12 2.72-1.85 3.83-2.6.6.09 1.22.13 1.9.13 5.52 0 10-3.59 10-8.03S17.52 3 12 3z"
                  />
                </svg>
                카카오로 로그인
              </button>
            </div>
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="bg-background px-4 text-muted-foreground">또는</span>
              </div>
            </div>
          </div>
        )}

        {/* 자격 증명 폼 */}
        {step === 'credentials' && (
          <form onSubmit={handleCredentialsSubmit} className="rounded-xl border border-border bg-card p-8">
            {error && (
              <div role="alert" className="mb-4 rounded-lg bg-destructive/10 p-4 text-sm text-destructive">
                {error}
              </div>
            )}

            <div className="space-y-4">
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
                  defaultValue={credentials.email}
                  className="mt-1 block w-full rounded-lg border border-border bg-background px-4 py-3 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder="email@example.com"
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-foreground">
                  비밀번호
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  autoComplete="current-password"
                  className="mt-1 block w-full rounded-lg border border-border bg-background px-4 py-3 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder="••••••••"
                />
              </div>

              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    name="remember"
                    className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                  />
                  <span className="text-sm text-muted-foreground">로그인 유지</span>
                </label>
                <Link
                  href="/forgot-password"
                  className="text-sm text-primary hover:text-primary/80"
                >
                  비밀번호 찾기
                </Link>
              </div>
            </div>

            <button
              type="submit"
              disabled={isPending}
              className="mt-6 w-full rounded-lg bg-primary py-3 font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isPending ? '로그인 중...' : '로그인'}
            </button>
          </form>
        )}

        {/* 2FA 폼 */}
        {step === 'totp' && (
          <form onSubmit={handleTotpSubmit} className="rounded-xl border border-border bg-card p-8">
            {error && (
              <div role="alert" className="mb-4 rounded-lg bg-destructive/10 p-4 text-sm text-destructive">
                {error}
              </div>
            )}

            <div className="mb-6 flex justify-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                <svg className="h-8 w-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label htmlFor="totpCode" className="block text-sm font-medium text-foreground">
                  {useBackupCode ? '백업 코드' : '인증 코드'}
                </label>
                <input
                  id="totpCode"
                  type="text"
                  value={totpCode}
                  onChange={(e) => {
                    const value = useBackupCode
                      ? e.target.value.toUpperCase()
                      : e.target.value.replace(/\D/g, '');
                    setTotpCode(value.slice(0, useBackupCode ? 9 : 6));
                  }}
                  required
                  autoComplete="one-time-code"
                  className="mt-1 block w-full rounded-lg border border-border bg-background px-4 py-3 text-center text-2xl font-mono tracking-widest text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder={useBackupCode ? 'XXXX-XXXX' : '000000'}
                  maxLength={useBackupCode ? 9 : 6}
                />
              </div>

              <div className="flex items-center justify-center">
                <button
                  type="button"
                  onClick={() => {
                    setUseBackupCode(!useBackupCode);
                    setTotpCode('');
                  }}
                  className="text-sm text-primary hover:text-primary/80"
                >
                  {useBackupCode ? '인증 앱 사용' : '백업 코드 사용'}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isPending || (useBackupCode ? totpCode.length < 9 : totpCode.length < 6)}
              className="mt-6 w-full rounded-lg bg-primary py-3 font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isPending ? '인증 중...' : '인증'}
            </button>

            <button
              type="button"
              onClick={handleBackToCredentials}
              className="mt-3 w-full rounded-lg border border-border py-3 font-medium text-foreground hover:bg-muted"
            >
              돌아가기
            </button>
          </form>
        )}

        {/* 회원가입 링크 */}
        {step === 'credentials' && (
          <p className="mt-6 text-center text-muted-foreground">
            계정이 없으신가요?{' '}
            <Link href="/signup" className="font-medium text-primary hover:text-primary/80">
              회원가입
            </Link>
          </p>
        )}

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
