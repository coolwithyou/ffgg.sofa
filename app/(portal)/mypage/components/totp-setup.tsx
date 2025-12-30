'use client';

/**
 * TOTP 2FA 설정 컴포넌트
 * QR 코드 스캔, 코드 검증, 백업 코드 제공
 */

import { useState } from 'react';
import Image from 'next/image';

interface TotpSetupData {
  qrCodeDataUrl: string;
  secret: string;
  backupCodes: string[];
}

interface TotpSetupProps {
  isEnabled: boolean;
  onStatusChange: () => void;
}

export function TotpSetup({ isEnabled, onStatusChange }: TotpSetupProps) {
  const [step, setStep] = useState<'idle' | 'setup' | 'verify' | 'backup' | 'disable'>('idle');
  const [setupData, setSetupData] = useState<TotpSetupData | null>(null);
  const [verifyCode, setVerifyCode] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 2FA 설정 시작 (QR 코드 요청)
  const startSetup = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const res = await fetch('/api/user/totp/setup', {
        method: 'POST',
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || '2FA 설정을 시작할 수 없습니다');
      }

      setSetupData(data.setup);
      setStep('setup');
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다');
    } finally {
      setIsLoading(false);
    }
  };

  // TOTP 코드 검증 및 활성화
  const verifyAndEnable = async () => {
    if (!setupData || verifyCode.length !== 6) return;

    try {
      setIsLoading(true);
      setError(null);

      const res = await fetch('/api/user/totp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          secret: setupData.secret,
          token: verifyCode,
          backupCodes: setupData.backupCodes,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || '인증 코드가 올바르지 않습니다');
      }

      setStep('backup');
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다');
    } finally {
      setIsLoading(false);
    }
  };

  // 2FA 비활성화
  const disableTotp = async () => {
    if (!password) return;

    try {
      setIsLoading(true);
      setError(null);

      const res = await fetch('/api/user/totp/disable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || '2FA 비활성화에 실패했습니다');
      }

      setStep('idle');
      setPassword('');
      onStatusChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다');
    } finally {
      setIsLoading(false);
    }
  };

  // 백업 코드 다운로드
  const downloadBackupCodes = () => {
    if (!setupData) return;

    const content = `SOFA 2FA 백업 코드\n생성일: ${new Date().toLocaleString('ko-KR')}\n\n각 코드는 한 번만 사용할 수 있습니다.\n안전한 곳에 보관하세요.\n\n${setupData.backupCodes.join('\n')}`;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sofa-backup-codes.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  // 설정 완료
  const finishSetup = () => {
    setStep('idle');
    setSetupData(null);
    setVerifyCode('');
    onStatusChange();
  };

  // 이미 활성화된 상태 (idle 또는 disable 단계)
  if (isEnabled && (step === 'idle' || step === 'disable')) {
    return (
      <div className="rounded-lg border border-border bg-card p-6">
        <h2 className="mb-2 text-lg font-semibold text-foreground">
          2단계 인증 (2FA)
        </h2>
        <p className="mb-4 text-sm text-muted-foreground">
          TOTP 앱을 사용한 2단계 인증이 활성화되어 있습니다.
        </p>

        <div className="flex items-center justify-between rounded-lg bg-green-500/10 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-500/20">
              <svg className="h-5 w-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <div>
              <p className="font-medium text-green-500">2단계 인증 활성화됨</p>
              <p className="text-sm text-muted-foreground">계정이 추가로 보호되고 있습니다</p>
            </div>
          </div>
          <button
            onClick={() => setStep('disable')}
            className="rounded-md border border-destructive/50 px-4 py-2 text-sm font-medium text-destructive hover:bg-destructive/10"
          >
            비활성화
          </button>
        </div>

        {step === 'disable' && (
          <div className="mt-4 rounded-lg border border-destructive/50 bg-destructive/10 p-4">
            <p className="mb-3 text-sm text-destructive">
              2FA를 비활성화하려면 비밀번호를 입력하세요.
            </p>
            {error && (
              <p className="mb-3 text-sm text-destructive">{error}</p>
            )}
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="비밀번호"
              className="mb-3 w-full rounded-md border border-border bg-background px-3 py-2 text-foreground"
            />
            <div className="flex gap-2">
              <button
                onClick={disableTotp}
                disabled={isLoading || !password}
                className="rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground disabled:opacity-50"
              >
                {isLoading ? '처리 중...' : '비활성화'}
              </button>
              <button
                onClick={() => {
                  setStep('idle');
                  setPassword('');
                  setError(null);
                }}
                className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
              >
                취소
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // 비활성화된 상태 (설정 시작 전)
  if (step === 'idle') {
    return (
      <div className="rounded-lg border border-border bg-card p-6">
        <h2 className="mb-2 text-lg font-semibold text-foreground">
          2단계 인증 (2FA)
        </h2>
        <p className="mb-4 text-sm text-muted-foreground">
          TOTP 앱(Google Authenticator 등)을 사용하여 계정 보안을 강화하세요.
        </p>

        {error && (
          <div className="mb-4 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="flex items-center justify-between rounded-lg bg-muted/50 p-4">
          <div>
            <p className="font-medium text-foreground">2단계 인증</p>
            <p className="text-sm text-muted-foreground">비활성화됨</p>
          </div>
          <button
            onClick={startSetup}
            disabled={isLoading}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {isLoading ? '로딩 중...' : '설정하기'}
          </button>
        </div>
      </div>
    );
  }

  // QR 코드 표시 단계
  if (step === 'setup' && setupData) {
    return (
      <div className="rounded-lg border border-border bg-card p-6">
        <h2 className="mb-2 text-lg font-semibold text-foreground">
          2단계 인증 설정
        </h2>
        <p className="mb-4 text-sm text-muted-foreground">
          인증 앱으로 아래 QR 코드를 스캔하세요.
        </p>

        <div className="mb-6 flex flex-col items-center">
          <div className="rounded-lg bg-white p-4">
            <Image
              src={setupData.qrCodeDataUrl}
              alt="2FA QR Code"
              width={200}
              height={200}
            />
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            수동 입력: <code className="rounded bg-muted px-2 py-1">{setupData.secret}</code>
          </p>
        </div>

        <div className="flex justify-end gap-2">
          <button
            onClick={() => {
              setStep('idle');
              setSetupData(null);
            }}
            className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
          >
            취소
          </button>
          <button
            onClick={() => setStep('verify')}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            다음
          </button>
        </div>
      </div>
    );
  }

  // 코드 검증 단계
  if (step === 'verify' && setupData) {
    return (
      <div className="rounded-lg border border-border bg-card p-6">
        <h2 className="mb-2 text-lg font-semibold text-foreground">
          인증 코드 확인
        </h2>
        <p className="mb-4 text-sm text-muted-foreground">
          앱에 표시된 6자리 코드를 입력하세요.
        </p>

        {error && (
          <div className="mb-4 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <input
          type="text"
          value={verifyCode}
          onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          placeholder="000000"
          maxLength={6}
          className="mb-4 w-full rounded-md border border-border bg-background px-3 py-2 text-center text-2xl font-mono tracking-widest text-foreground"
        />

        <div className="flex justify-end gap-2">
          <button
            onClick={() => {
              setStep('setup');
              setVerifyCode('');
              setError(null);
            }}
            className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
          >
            이전
          </button>
          <button
            onClick={verifyAndEnable}
            disabled={isLoading || verifyCode.length !== 6}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {isLoading ? '확인 중...' : '활성화'}
          </button>
        </div>
      </div>
    );
  }

  // 백업 코드 표시 단계
  if (step === 'backup' && setupData) {
    return (
      <div className="rounded-lg border border-border bg-card p-6">
        <h2 className="mb-2 text-lg font-semibold text-foreground">
          백업 코드 저장
        </h2>
        <p className="mb-4 text-sm text-muted-foreground">
          인증 앱을 사용할 수 없을 때 이 코드로 로그인할 수 있습니다.
          <br />
          <strong className="text-destructive">각 코드는 한 번만 사용할 수 있으며, 안전한 곳에 보관하세요.</strong>
        </p>

        <div className="mb-4 grid grid-cols-2 gap-2 rounded-lg bg-muted p-4">
          {setupData.backupCodes.map((code, i) => (
            <code key={i} className="rounded bg-background px-2 py-1 text-center text-sm">
              {code}
            </code>
          ))}
        </div>

        <div className="flex justify-between">
          <button
            onClick={downloadBackupCodes}
            className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
          >
            다운로드
          </button>
          <button
            onClick={finishSetup}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            완료
          </button>
        </div>
      </div>
    );
  }

  return null;
}
