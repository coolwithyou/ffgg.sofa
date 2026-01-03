'use client';

/**
 * 계정 삭제 다이얼로그
 * 30일 유예 기간 안내 및 삭제 확인
 */

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

interface DeleteAccountDialogProps {
  isOpen: boolean;
  onClose: () => void;
  /** 삭제 후 리다이렉트 경로 (기본: /login?deleted=pending) */
  redirectPath?: string;
}

export default function DeleteAccountDialog({
  isOpen,
  onClose,
  redirectPath = '/login?deleted=pending',
}: DeleteAccountDialogProps) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);

  const [step, setStep] = useState<'warning' | 'confirm'>('warning');
  const [password, setPassword] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 다이얼로그 열기/닫기
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen) {
      dialog.showModal();
    } else {
      dialog.close();
    }
  }, [isOpen]);

  // 닫을 때 초기화
  const handleClose = () => {
    setStep('warning');
    setPassword('');
    setConfirmText('');
    setError(null);
    onClose();
  };

  // 배경 클릭 시 닫기
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === dialogRef.current) {
      handleClose();
    }
  };

  // ESC 키로 닫기
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const handleDelete = async () => {
    setError(null);

    if (!password) {
      setError('비밀번호를 입력해주세요.');
      return;
    }

    if (confirmText !== '탈퇴합니다') {
      setError('"탈퇴합니다"를 정확히 입력해주세요.');
      return;
    }

    try {
      setIsLoading(true);

      const res = await fetch('/api/user/account', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, confirmText }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || '계정 삭제 요청에 실패했습니다.');
      }

      // 성공 시 리다이렉트
      router.push(redirectPath);
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <dialog
      ref={dialogRef}
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 m-0 h-full w-full max-h-none max-w-none bg-transparent p-0 backdrop:bg-black/50"
    >
      <div className="flex min-h-full items-center justify-center p-4">
        <div
          className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-xl"
          onClick={(e) => e.stopPropagation()}
        >
          {step === 'warning' && (
            <>
              {/* 경고 아이콘 */}
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
                <svg
                  className="h-6 w-6 text-destructive"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>

              <h2 className="mb-2 text-center text-lg font-semibold text-foreground">
                정말 계정을 삭제하시겠습니까?
              </h2>

              <div className="mb-6 space-y-3 text-sm text-muted-foreground">
                <p>계정을 삭제하면 다음 사항이 적용됩니다:</p>
                <ul className="ml-4 list-disc space-y-1">
                  <li>
                    <strong className="text-foreground">30일 유예 기간</strong>{' '}
                    후 모든 데이터가 영구 삭제됩니다.
                  </li>
                  <li>유예 기간 내 다시 로그인하면 삭제를 취소할 수 있습니다.</li>
                  <li>모든 챗봇, 데이터셋, 문서가 삭제됩니다.</li>
                  <li>대화 기록 및 사용량 데이터가 삭제됩니다.</li>
                </ul>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleClose}
                  className="flex-1 rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
                >
                  취소
                </button>
                <button
                  onClick={() => setStep('confirm')}
                  className="flex-1 rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90"
                >
                  계속 진행
                </button>
              </div>
            </>
          )}

          {step === 'confirm' && (
            <>
              <h2 className="mb-4 text-lg font-semibold text-foreground">
                계정 삭제 확인
              </h2>

              {error && (
                <div className="mb-4 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                  {error}
                </div>
              )}

              <div className="space-y-4">
                {/* 비밀번호 입력 */}
                <div>
                  <label
                    htmlFor="deletePassword"
                    className="mb-1 block text-sm font-medium text-foreground"
                  >
                    현재 비밀번호
                  </label>
                  <input
                    type="password"
                    id="deletePassword"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    placeholder="비밀번호 입력"
                    autoComplete="current-password"
                    disabled={isLoading}
                  />
                </div>

                {/* 확인 문구 입력 */}
                <div>
                  <label
                    htmlFor="confirmText"
                    className="mb-1 block text-sm font-medium text-foreground"
                  >
                    확인을 위해{' '}
                    <span className="font-bold text-destructive">탈퇴합니다</span>
                    를 입력하세요
                  </label>
                  <input
                    type="text"
                    id="confirmText"
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-foreground placeholder:text-muted-foreground focus:border-destructive focus:outline-none focus:ring-1 focus:ring-destructive"
                    placeholder="탈퇴합니다"
                    autoComplete="off"
                    disabled={isLoading}
                  />
                </div>
              </div>

              <div className="mt-6 flex gap-3">
                <button
                  onClick={() => {
                    setStep('warning');
                    setError(null);
                  }}
                  disabled={isLoading}
                  className="flex-1 rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50"
                >
                  이전
                </button>
                <button
                  onClick={handleDelete}
                  disabled={isLoading || confirmText !== '탈퇴합니다'}
                  className="flex-1 rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
                >
                  {isLoading ? '처리 중...' : '계정 삭제'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </dialog>
  );
}
