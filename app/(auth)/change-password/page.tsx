/**
 * 비밀번호 변경 페이지
 * 임시 비밀번호로 로그인한 관리자의 필수 비밀번호 변경
 */

import { redirect } from 'next/navigation';
import { validateSession } from '@/lib/auth';
import { ChangePasswordForm } from './change-password-form';

export default async function ChangePasswordPage() {
  const session = await validateSession();

  if (!session) {
    redirect('/login');
  }

  // 비밀번호 변경이 필요하지 않으면 대시보드로
  if (!session.mustChangePassword) {
    redirect('/dashboard');
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="rounded-lg border border-border bg-card p-8 shadow-sm">
          <div className="mb-6 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-yellow-500/10">
              <svg
                className="h-6 w-6 text-yellow-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-foreground">비밀번호 변경 필요</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              보안을 위해 임시 비밀번호를 변경해주세요.
            </p>
          </div>

          <ChangePasswordForm email={session.email} />
        </div>
      </div>
    </div>
  );
}
