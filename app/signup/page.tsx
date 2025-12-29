'use client';

/**
 * 회원가입 페이지
 * [Week 12] 런칭 준비
 */

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useTransition, Suspense } from 'react';

function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const plan = searchParams.get('plan') || 'starter';
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState(1);

  // 비밀번호 복잡성 검증 함수
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

  // Step 1 유효성 검사 후 다음 단계로 이동
  function handleNextStep() {
    const form = document.querySelector('form');
    const email = form?.querySelector<HTMLInputElement>('#email')?.value?.trim();
    const password = form?.querySelector<HTMLInputElement>('#password')?.value;
    const passwordConfirm = form?.querySelector<HTMLInputElement>('#passwordConfirm')?.value;

    if (!email || !password || !passwordConfirm) {
      setError('모든 필드를 입력해주세요.');
      return;
    }

    // 이메일 형식 검사
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('유효한 이메일 주소를 입력해주세요.');
      return;
    }

    // 비밀번호 복잡성 검사
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      setError(passwordValidation.message);
      return;
    }

    // 비밀번호 일치 확인
    if (password !== passwordConfirm) {
      setError('비밀번호가 일치하지 않습니다.');
      return;
    }

    setError(null);
    setStep(2);
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const formData = new FormData(e.currentTarget);
    const agreedToTerms = formData.get('agreedToTerms') === 'on';
    const agreedToPrivacy = formData.get('agreedToPrivacy') === 'on';

    // 약관 동의 확인
    if (!agreedToTerms || !agreedToPrivacy) {
      setError('이용약관과 개인정보처리방침에 모두 동의해주세요.');
      return;
    }

    const data = {
      companyName: formData.get('companyName') as string,
      email: formData.get('email') as string,
      password: formData.get('password') as string,
      passwordConfirm: formData.get('passwordConfirm') as string,
      contactName: formData.get('contactName') as string,
      contactPhone: formData.get('contactPhone') as string,
      plan,
      agreedToTerms,
      agreedToPrivacy,
    };

    // 비밀번호 확인
    if (data.password !== data.passwordConfirm) {
      setError('비밀번호가 일치하지 않습니다.');
      return;
    }

    // 비밀번호 복잡성 검사
    const passwordValidation = validatePassword(data.password);
    if (!passwordValidation.valid) {
      setError(passwordValidation.message);
      return;
    }

    startTransition(async () => {
      try {
        const response = await fetch('/api/auth/signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });

        const result = await response.json();

        if (!response.ok) {
          setError(result.error || '회원가입에 실패했습니다.');
          return;
        }

        // 가입 완료 후 대시보드로 이동
        router.push('/dashboard');
        router.refresh();
      } catch {
        setError('서버 연결에 실패했습니다.');
      }
    });
  }

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
            {plan === 'pro' ? '프로 플랜' : '스타터 플랜'}으로 시작합니다
          </p>
        </div>

        {/* 단계 표시 */}
        <div className="mb-8">
          <div className="flex items-center justify-center gap-2">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
                step >= 1
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              1
            </div>
            <div
              className={`h-1 w-12 rounded ${
                step >= 2 ? 'bg-primary' : 'bg-muted'
              }`}
            />
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
                step >= 2
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              2
            </div>
          </div>
          <div className="mt-2 flex justify-center gap-16 text-sm text-muted-foreground">
            <span>계정 정보</span>
            <span>회사 정보</span>
          </div>
        </div>

        {/* 회원가입 폼 */}
        <form onSubmit={handleSubmit} className="rounded-xl border border-border bg-card p-8">
          {error && (
            <div role="alert" className="mb-4 rounded-lg bg-destructive/10 p-4 text-sm text-destructive">
              {error}
            </div>
          )}

          {step === 1 && (
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
                  autoComplete="new-password"
                  minLength={8}
                  className="mt-1 block w-full rounded-lg border border-border bg-background px-4 py-3 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder="8자 이상 입력"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  영문, 숫자, 특수문자 조합 8자 이상
                </p>
              </div>

              <div>
                <label htmlFor="passwordConfirm" className="block text-sm font-medium text-foreground">
                  비밀번호 확인
                </label>
                <input
                  id="passwordConfirm"
                  name="passwordConfirm"
                  type="password"
                  required
                  autoComplete="new-password"
                  className="mt-1 block w-full rounded-lg border border-border bg-background px-4 py-3 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder="비밀번호 재입력"
                />
              </div>

              <button
                type="button"
                onClick={handleNextStep}
                className="mt-6 w-full rounded-lg bg-primary py-3 font-medium text-primary-foreground hover:bg-primary/90"
              >
                다음
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div>
                <label htmlFor="companyName" className="block text-sm font-medium text-foreground">
                  회사/서비스명
                </label>
                <input
                  id="companyName"
                  name="companyName"
                  type="text"
                  required
                  className="mt-1 block w-full rounded-lg border border-border bg-background px-4 py-3 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder="SOFA 주식회사"
                />
              </div>

              <div>
                <label htmlFor="contactName" className="block text-sm font-medium text-foreground">
                  담당자 이름
                </label>
                <input
                  id="contactName"
                  name="contactName"
                  type="text"
                  required
                  autoComplete="name"
                  className="mt-1 block w-full rounded-lg border border-border bg-background px-4 py-3 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder="홍길동"
                />
              </div>

              <div>
                <label htmlFor="contactPhone" className="block text-sm font-medium text-foreground">
                  연락처
                </label>
                <input
                  id="contactPhone"
                  name="contactPhone"
                  type="tel"
                  autoComplete="tel"
                  className="mt-1 block w-full rounded-lg border border-border bg-background px-4 py-3 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder="010-1234-5678 (선택)"
                />
              </div>

              <div className="space-y-3 rounded-lg bg-muted p-4">
                <div className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    id="agreedToTerms"
                    name="agreedToTerms"
                    required
                    className="mt-1 h-4 w-4 rounded border-border text-primary focus:ring-primary"
                  />
                  <label htmlFor="agreedToTerms" className="text-sm text-muted-foreground">
                    <Link href="/terms" target="_blank" className="text-primary hover:underline">
                      이용약관
                    </Link>
                    에 동의합니다 (필수)
                  </label>
                </div>
                <div className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    id="agreedToPrivacy"
                    name="agreedToPrivacy"
                    required
                    className="mt-1 h-4 w-4 rounded border-border text-primary focus:ring-primary"
                  />
                  <label htmlFor="agreedToPrivacy" className="text-sm text-muted-foreground">
                    <Link href="/privacy" target="_blank" className="text-primary hover:underline">
                      개인정보처리방침
                    </Link>
                    에 동의합니다 (필수)
                  </label>
                </div>
              </div>

              <div className="mt-6 flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="flex-1 rounded-lg border border-border py-3 font-medium text-foreground hover:bg-muted"
                >
                  이전
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="flex-1 rounded-lg bg-primary py-3 font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isPending ? '가입 중...' : '가입하기'}
                </button>
              </div>
            </div>
          )}
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
        <div className="text-muted-foreground">로딩 중...</div>
      </div>
    }>
      <SignupForm />
    </Suspense>
  );
}
