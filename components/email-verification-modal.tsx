'use client';

/**
 * 이메일 인증 요청 모달
 *
 * Delayed Verification 전략:
 * 핵심 기능(발행/설치 등) 사용 시점에 이메일 인증이 필요할 때 표시됩니다.
 *
 * 사용법:
 * ```tsx
 * const { requireEmailVerification, EmailVerificationModal } = useEmailVerification();
 *
 * async function handlePublish() {
 *   const verified = await requireEmailVerification();
 *   if (!verified) return; // 인증 필요
 *   // 발행 로직 진행
 * }
 * ```
 */

import { useState, useCallback, createContext, useContext, ReactNode } from 'react';
import { Dialog } from '@/components/ui/dialog';
import { Mail, CheckCircle, RefreshCw, AlertCircle } from 'lucide-react';

interface EmailVerificationContextType {
  /** 이메일 인증이 필요한지 확인하고, 필요하면 모달 표시 */
  requireEmailVerification: () => Promise<boolean>;
  /** 현재 사용자의 이메일 인증 상태 */
  isEmailVerified: boolean;
  /** 인증 상태 새로고침 */
  refreshVerificationStatus: () => Promise<void>;
}

const EmailVerificationContext = createContext<EmailVerificationContextType | null>(null);

interface EmailVerificationProviderProps {
  children: ReactNode;
  /** 초기 이메일 인증 상태 */
  initialEmailVerified?: boolean;
  /** 사용자 이메일 */
  userEmail?: string;
}

export function EmailVerificationProvider({
  children,
  initialEmailVerified = false,
  userEmail = '',
}: EmailVerificationProviderProps) {
  const [isEmailVerified, setIsEmailVerified] = useState(initialEmailVerified);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [resolvePromise, setResolvePromise] = useState<((value: boolean) => void) | null>(null);
  const [sendStatus, setSendStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [email] = useState(userEmail);

  const refreshVerificationStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/auth/me');
      if (response.ok) {
        const data = await response.json();
        setIsEmailVerified(data.user?.emailVerified ?? false);
      }
    } catch (error) {
      console.error('Failed to refresh verification status:', error);
    }
  }, []);

  const requireEmailVerification = useCallback(async (): Promise<boolean> => {
    // 이미 인증된 경우 바로 true 반환
    if (isEmailVerified) {
      return true;
    }

    // 최신 상태 확인
    await refreshVerificationStatus();
    if (isEmailVerified) {
      return true;
    }

    // 모달 표시하고 Promise 대기
    return new Promise((resolve) => {
      setResolvePromise(() => resolve);
      setIsModalOpen(true);
      setSendStatus('idle');
    });
  }, [isEmailVerified, refreshVerificationStatus]);

  const handleClose = useCallback(() => {
    setIsModalOpen(false);
    if (resolvePromise) {
      resolvePromise(false);
      setResolvePromise(null);
    }
  }, [resolvePromise]);

  const handleSendEmail = useCallback(async () => {
    setSendStatus('sending');
    try {
      const response = await fetch('/api/auth/resend-verification', {
        method: 'POST',
      });
      const data = await response.json();

      if (data.alreadyVerified) {
        setIsEmailVerified(true);
        setIsModalOpen(false);
        if (resolvePromise) {
          resolvePromise(true);
          setResolvePromise(null);
        }
        return;
      }

      if (!response.ok) {
        throw new Error(data.error || '이메일 발송 실패');
      }

      setSendStatus('sent');
    } catch (error) {
      console.error('Failed to send verification email:', error);
      setSendStatus('error');
    }
  }, [resolvePromise]);

  const handleCheckVerification = useCallback(async () => {
    await refreshVerificationStatus();
    // 컴포넌트 리렌더링 후 확인
    const response = await fetch('/api/auth/me');
    if (response.ok) {
      const data = await response.json();
      if (data.user?.emailVerified) {
        setIsEmailVerified(true);
        setIsModalOpen(false);
        if (resolvePromise) {
          resolvePromise(true);
          setResolvePromise(null);
        }
      }
    }
  }, [refreshVerificationStatus, resolvePromise]);

  return (
    <EmailVerificationContext.Provider
      value={{
        requireEmailVerification,
        isEmailVerified,
        refreshVerificationStatus,
      }}
    >
      {children}

      <Dialog
        isOpen={isModalOpen}
        onClose={handleClose}
        title="이메일 인증이 필요합니다"
        description="이 기능을 사용하려면 이메일 인증이 필요합니다."
        maxWidth="sm"
      >
        <div className="space-y-6">
          {/* 아이콘 */}
          <div className="flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <Mail className="h-8 w-8 text-primary" />
            </div>
          </div>

          {/* 상태별 메시지 */}
          {sendStatus === 'idle' && (
            <div className="text-center">
              <p className="text-muted-foreground">
                {email ? (
                  <>
                    <span className="font-medium text-foreground">{email}</span>으로
                    <br />
                    인증 메일을 보내드립니다.
                  </>
                ) : (
                  '가입 시 사용한 이메일로 인증 메일을 보내드립니다.'
                )}
              </p>
            </div>
          )}

          {sendStatus === 'sending' && (
            <div className="flex flex-col items-center gap-3 text-center">
              <RefreshCw className="h-6 w-6 animate-spin text-primary" />
              <p className="text-muted-foreground">이메일을 보내는 중...</p>
            </div>
          )}

          {sendStatus === 'sent' && (
            <div className="rounded-lg bg-green-500/10 p-4 text-center">
              <CheckCircle className="mx-auto mb-2 h-6 w-6 text-green-500" />
              <p className="font-medium text-green-500">인증 메일이 발송되었습니다!</p>
              <p className="mt-1 text-sm text-muted-foreground">
                메일함을 확인하고 인증 링크를 클릭해주세요.
                <br />
                스팸함도 확인해보세요.
              </p>
            </div>
          )}

          {sendStatus === 'error' && (
            <div className="rounded-lg bg-destructive/10 p-4 text-center">
              <AlertCircle className="mx-auto mb-2 h-6 w-6 text-destructive" />
              <p className="font-medium text-destructive">이메일 발송에 실패했습니다</p>
              <p className="mt-1 text-sm text-muted-foreground">
                잠시 후 다시 시도해주세요.
              </p>
            </div>
          )}

          {/* 버튼 */}
          <div className="flex flex-col gap-3">
            {sendStatus === 'idle' && (
              <button
                onClick={handleSendEmail}
                className="w-full rounded-lg bg-primary py-3 font-medium text-primary-foreground hover:bg-primary/90"
              >
                인증 메일 보내기
              </button>
            )}

            {sendStatus === 'sent' && (
              <>
                <button
                  onClick={handleCheckVerification}
                  className="w-full rounded-lg bg-primary py-3 font-medium text-primary-foreground hover:bg-primary/90"
                >
                  인증 완료 확인
                </button>
                <button
                  onClick={() => setSendStatus('idle')}
                  className="w-full rounded-lg border border-border py-3 font-medium text-foreground hover:bg-muted"
                >
                  다시 보내기
                </button>
              </>
            )}

            {sendStatus === 'error' && (
              <button
                onClick={handleSendEmail}
                className="w-full rounded-lg bg-primary py-3 font-medium text-primary-foreground hover:bg-primary/90"
              >
                다시 시도
              </button>
            )}

            <button
              onClick={handleClose}
              className="w-full rounded-lg border border-border py-3 font-medium text-foreground hover:bg-muted"
            >
              나중에 하기
            </button>
          </div>
        </div>
      </Dialog>
    </EmailVerificationContext.Provider>
  );
}

/**
 * 이메일 인증 훅
 *
 * EmailVerificationProvider 내부에서 사용해야 합니다.
 */
export function useEmailVerification() {
  const context = useContext(EmailVerificationContext);
  if (!context) {
    throw new Error('useEmailVerification must be used within EmailVerificationProvider');
  }
  return context;
}
