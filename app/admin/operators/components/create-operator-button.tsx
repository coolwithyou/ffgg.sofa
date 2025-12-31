'use client';

/**
 * 관리자 생성 버튼 및 모달 컴포넌트
 */

import { useState, useTransition, useRef } from 'react';
import { createOperator } from '../actions';
import type { AdminRole } from '@/lib/auth/admin-permissions';
import { ADMIN_ROLE_LABELS, ADMIN_ROLE_DESCRIPTIONS } from '@/lib/auth/admin-permissions';

export function CreateOperatorButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [createdEmail, setCreatedEmail] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      const result = await createOperator(formData);

      if (result.success && result.data) {
        setTempPassword(result.data.temporaryPassword);
        setCreatedEmail(result.data.email);
        formRef.current?.reset();
      } else {
        setError(result.error || '관리자 생성에 실패했습니다.');
      }
    });
  };

  const handleClose = () => {
    setIsOpen(false);
    setError(null);
    setTempPassword(null);
    setCreatedEmail(null);
    formRef.current?.reset();
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
      >
        관리자 추가
      </button>

      {/* 모달 오버레이 */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-lg">
            {/* 성공 상태 */}
            {tempPassword && createdEmail ? (
              <div className="space-y-4">
                <div className="text-center">
                  <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-500/10">
                    <svg
                      className="h-6 w-6 text-green-500"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </div>
                  <h2 className="text-lg font-semibold text-foreground">관리자 생성 완료</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{createdEmail}</p>
                </div>

                <div className="rounded-lg border border-border bg-muted p-4">
                  <p className="text-sm font-medium text-foreground">임시 비밀번호</p>
                  <code className="mt-1 block rounded bg-card px-3 py-2 font-mono text-lg">
                    {tempPassword}
                  </code>
                  <p className="mt-2 text-xs text-muted-foreground">
                    이 비밀번호를 관리자에게 안전하게 전달하세요.
                    <br />
                    첫 로그인 시 비밀번호 변경이 필요합니다.
                  </p>
                </div>

                <button
                  onClick={handleClose}
                  className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  확인
                </button>
              </div>
            ) : (
              <>
                {/* 모달 헤더 */}
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-foreground">새 관리자 추가</h2>
                  <button
                    onClick={handleClose}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>

                {/* 에러 메시지 */}
                {error && (
                  <div className="mb-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                    {error}
                  </div>
                )}

                {/* 폼 */}
                <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label
                      htmlFor="email"
                      className="block text-sm font-medium text-foreground"
                    >
                      이메일
                    </label>
                    <input
                      type="email"
                      id="email"
                      name="email"
                      required
                      className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                      placeholder="admin@example.com"
                    />
                  </div>

                  <div>
                    <label htmlFor="name" className="block text-sm font-medium text-foreground">
                      이름
                    </label>
                    <input
                      type="text"
                      id="name"
                      name="name"
                      required
                      className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                      placeholder="홍길동"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="adminRole"
                      className="block text-sm font-medium text-foreground"
                    >
                      역할
                    </label>
                    <select
                      id="adminRole"
                      name="adminRole"
                      required
                      defaultValue="VIEWER"
                      className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      {(['SUPER_ADMIN', 'ADMIN', 'SUPPORT', 'VIEWER'] as AdminRole[]).map(
                        (role) => (
                          <option key={role} value={role}>
                            {ADMIN_ROLE_LABELS[role]} - {ADMIN_ROLE_DESCRIPTIONS[role]}
                          </option>
                        )
                      )}
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="adminNotes"
                      className="block text-sm font-medium text-foreground"
                    >
                      메모 (선택)
                    </label>
                    <textarea
                      id="adminNotes"
                      name="adminNotes"
                      rows={2}
                      className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                      placeholder="관리자에 대한 메모..."
                    />
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={handleClose}
                      className="flex-1 rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
                    >
                      취소
                    </button>
                    <button
                      type="submit"
                      disabled={isPending}
                      className="flex-1 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                    >
                      {isPending ? '생성 중...' : '생성'}
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
