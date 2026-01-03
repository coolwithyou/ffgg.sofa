'use client';

/**
 * 회원가입 페이지
 * [Phase 1] 폼 간소화 + Google SSO + 실시간 검증
 */

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useTransition, Suspense, useCallback, useEffect } from 'react';

// 비밀번호 강도 레벨
type PasswordStrength = 'weak' | 'medium' | 'strong';

interface PasswordValidation {
  valid: boolean;
  message: string;
  checks: {
    length: boolean;
    uppercase: boolean;
    lowercase: boolean;
    number: boolean;
    special: boolean;
  };
}

function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const plan = searchParams.get('plan') || 'starter';
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // 폼 상태
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  // 실시간 검증 상태
  const [emailError, setEmailError] = useState<string | null>(null);
  const [emailValid, setEmailValid] = useState(false);
  const [isCheckingEmail, setIsCheckingEmail] = useState(false);
  const [passwordValidation, setPasswordValidation] = useState<PasswordValidation>({
    valid: false,
    message: '',
    checks: {
      length: false,
      uppercase: false,
      lowercase: false,
      number: false,
      special: false,
    },
  });

  // 비밀번호 복잡성 검증 함수 (서버 lib/auth/password.ts와 동기화)
  const validatePassword = useCallback((pwd: string): PasswordValidation => {
    const checks = {
      length: pwd.length >= 8 && pwd.length <= 128,
      uppercase: /[A-Z]/.test(pwd),
      lowercase: /[a-z]/.test(pwd),
      number: /[0-9]/.test(pwd),
      special: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(pwd),
    };

    const allValid = Object.values(checks).every(Boolean);

    let message = '';
    if (!allValid) {
      if (!checks.length) message = '8자 이상 입력하세요';
      else if (!checks.uppercase) message = '대문자를 포함하세요';
      else if (!checks.lowercase) message = '소문자를 포함하세요';
      else if (!checks.number) message = '숫자를 포함하세요';
      else if (!checks.special) message = '특수문자를 포함하세요';
    }

    return { valid: allValid, message, checks };
  }, []);

  // 비밀번호 강도 계산
  const getPasswordStrength = useCallback((pwd: string): PasswordStrength => {
    if (!pwd) return 'weak';

    let score = 0;
    if (pwd.length >= 8) score += 1;
    if (pwd.length >= 12) score += 1;
    if (/[a-z]/.test(pwd)) score += 1;
    if (/[A-Z]/.test(pwd)) score += 1;
    if (/[0-9]/.test(pwd)) score += 1;
    if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(pwd)) score += 1;

    if (score <= 2) return 'weak';
    if (score <= 4) return 'medium';
    return 'strong';
  }, []);

  // 이메일 형식 검증
  const validateEmailFormat = useCallback((emailValue: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(emailValue);
  }, []);

  // 이메일 중복 확인 (디바운스 적용)
  useEffect(() => {
    if (!email || !validateEmailFormat(email)) {
      setEmailValid(false);
      setEmailError(email ? '유효한 이메일 주소를 입력하세요' : null);
      return;
    }

    setEmailError(null);
    const timer = setTimeout(async () => {
      setIsCheckingEmail(true);
      try {
        const response = await fetch(`/api/auth/check-email?email=${encodeURIComponent(email)}`);
        const data = await response.json();

        if (data.exists) {
          setEmailError('이미 등록된 이메일입니다');
          setEmailValid(false);
        } else {
          setEmailValid(true);
          setEmailError(null);
        }
      } catch {
        // API 없으면 형식만 검증
        setEmailValid(true);
      } finally {
        setIsCheckingEmail(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [email, validateEmailFormat]);

  // 비밀번호 실시간 검증
  useEffect(() => {
    setPasswordValidation(validatePassword(password));
  }, [password, validatePassword]);

  // Google SSO 핸들러
  function handleGoogleSignup() {
    // Google OAuth 시작
    window.location.href = `/api/auth/google?plan=${plan}`;
  }

  // Kakao SSO 핸들러
  function handleKakaoSignup() {
    // Kakao OAuth 시작
    window.location.href = `/api/auth/kakao?plan=${plan}`;
  }

  // 폼 제출
  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    // 클라이언트 검증
    if (!validateEmailFormat(email)) {
      setError('유효한 이메일 주소를 입력하세요.');
      return;
    }

    if (!passwordValidation.valid) {
      setError(passwordValidation.message || '비밀번호 요구사항을 확인하세요.');
      return;
    }

    if (!agreedToTerms) {
      setError('서비스 이용약관에 동의해주세요.');
      return;
    }

    startTransition(async () => {
      try {
        const response = await fetch('/api/auth/signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email,
            password,
            plan,
            agreedToTerms,
          }),
        });

        const result = await response.json();

        if (!response.ok) {
          const errorMessage =
            typeof result.error === 'string'
              ? result.error
              : result.error?.message || '회원가입에 실패했습니다.';
          setError(errorMessage);
          return;
        }

        // 가입 완료 후 콘솔로 이동
        router.push('/console');
        router.refresh();
      } catch {
        setError('서버 연결에 실패했습니다.');
      }
    });
  }

  const passwordStrength = getPasswordStrength(password);
  const strengthColors = {
    weak: 'bg-destructive',
    medium: 'bg-yellow-500',
    strong: 'bg-green-500',
  };
  const strengthLabels = {
    weak: '약함',
    medium: '보통',
    strong: '강함',
  };
  const strengthWidths = {
    weak: 'w-1/3',
    medium: 'w-2/3',
    strong: 'w-full',
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
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
            14일 무료 체험 시작하기
          </h1>
          <p className="mt-2 text-muted-foreground">
            신용카드 없이 바로 시작하세요
          </p>
        </div>

        {/* SSO 버튼들 */}
        <div className="mb-6 flex flex-col gap-3">
          {/* Google SSO 버튼 */}
          <button
            type="button"
            onClick={handleGoogleSignup}
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
            Google로 시작하기
          </button>

          {/* Kakao SSO 버튼 */}
          <button
            type="button"
            onClick={handleKakaoSignup}
            className="flex w-full items-center justify-center gap-3 rounded-lg py-3 font-medium transition-colors hover:opacity-90"
            style={{ backgroundColor: '#FEE500', color: '#000000' }}
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24">
              <path
                fill="#000000"
                d="M12 3c-5.52 0-10 3.59-10 8.03 0 2.86 1.88 5.37 4.72 6.81-.21.79-.76 2.87-.87 3.31-.14.55.2.55.42.4.17-.12 2.72-1.85 3.83-2.6.6.09 1.22.13 1.9.13 5.52 0 10-3.59 10-8.03S17.52 3 12 3z"
              />
            </svg>
            카카오로 시작하기
          </button>
        </div>

        {/* 구분선 */}
        <div className="relative mb-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="bg-background px-4 text-muted-foreground">또는</span>
          </div>
        </div>

        {/* 회원가입 폼 */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div role="alert" className="rounded-lg bg-destructive/10 p-4 text-sm text-destructive">
              {error}
            </div>
          )}

          {/* 이메일 필드 */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-foreground">
              이메일
            </label>
            <div className="relative mt-1">
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className={`block w-full rounded-lg border bg-background px-4 py-3 pr-10 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 ${
                  emailError
                    ? 'border-destructive focus:border-destructive focus:ring-destructive'
                    : emailValid
                    ? 'border-green-500 focus:border-green-500 focus:ring-green-500'
                    : 'border-border focus:border-primary focus:ring-primary'
                }`}
                placeholder="email@example.com"
              />
              <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                {isCheckingEmail && (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                )}
                {!isCheckingEmail && emailValid && (
                  <svg className="h-5 w-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                )}
                {!isCheckingEmail && emailError && email && (
                  <svg className="h-5 w-5 text-destructive" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                )}
              </div>
            </div>
            {emailError && (
              <p className="mt-1 text-xs text-destructive">{emailError}</p>
            )}
          </div>

          {/* 비밀번호 필드 */}
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-foreground">
              비밀번호
            </label>
            <div className="relative mt-1">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="new-password"
                minLength={8}
                className={`block w-full rounded-lg border bg-background px-4 py-3 pr-10 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 ${
                  password && !passwordValidation.valid
                    ? 'border-destructive focus:border-destructive focus:ring-destructive'
                    : password && passwordValidation.valid
                    ? 'border-green-500 focus:border-green-500 focus:ring-green-500'
                    : 'border-border focus:border-primary focus:ring-primary'
                }`}
                placeholder="비밀번호 입력"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? (
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  </svg>
                ) : (
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>

            {/* 비밀번호 강도 표시 */}
            {password && (
              <div className="mt-2">
                <div className="flex items-center gap-2">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className={`h-full transition-all ${strengthColors[passwordStrength]} ${strengthWidths[passwordStrength]}`}
                    />
                  </div>
                  <span className={`text-xs font-medium ${
                    passwordStrength === 'weak' ? 'text-destructive' :
                    passwordStrength === 'medium' ? 'text-yellow-500' : 'text-green-500'
                  }`}>
                    {strengthLabels[passwordStrength]}
                  </span>
                </div>
                {!passwordValidation.valid && passwordValidation.message && (
                  <p className="mt-1 text-xs text-destructive">{passwordValidation.message}</p>
                )}
              </div>
            )}

            {!password && (
              <p className="mt-1 text-xs text-muted-foreground">
                영문 대/소문자, 숫자, 특수문자 포함 8자 이상
              </p>
            )}
          </div>

          {/* 약관 동의 */}
          <div className="flex items-start gap-2 rounded-lg bg-muted p-4">
            <input
              type="checkbox"
              id="agreedToTerms"
              checked={agreedToTerms}
              onChange={(e) => setAgreedToTerms(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-border text-primary focus:ring-primary"
            />
            <label htmlFor="agreedToTerms" className="text-sm text-muted-foreground">
              <Link href="/terms" target="_blank" className="text-primary hover:underline">
                이용약관
              </Link>
              {' 및 '}
              <Link href="/privacy" target="_blank" className="text-primary hover:underline">
                개인정보처리방침
              </Link>
              에 동의합니다
            </label>
          </div>

          {/* 제출 버튼 */}
          <button
            type="submit"
            disabled={isPending || !emailValid || !passwordValidation.valid || !agreedToTerms}
            className="w-full rounded-lg bg-primary py-3 font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPending ? '가입 중...' : '무료로 시작하기'}
          </button>
        </form>

        {/* 로그인 링크 */}
        <p className="mt-6 text-center text-muted-foreground">
          이미 계정이 있으신가요?{' '}
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

        {/* 신뢰 배지 */}
        <div className="mt-8 text-center text-sm text-muted-foreground">
          <p>신용카드 불필요 · 14일 무료 체험 · 언제든 취소</p>
        </div>
      </div>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-muted-foreground">로딩 중...</p>
        </div>
      </div>
    }>
      <SignupForm />
    </Suspense>
  );
}
