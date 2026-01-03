'use client';

/**
 * TOTP 2FA 설정 컴포넌트
 * QR 코드 스캔, 코드 검증, 백업 코드 제공
 * shadcn/ui Card, Input, Button, Alert 컴포넌트 적용
 */

import { useState } from 'react';
import Image from 'next/image';
import { Shield, ShieldCheck, Loader2, Download } from 'lucide-react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';

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
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-muted-foreground" />
            <CardTitle>2단계 인증 (2FA)</CardTitle>
          </div>
          <CardDescription>
            TOTP 앱을 사용한 2단계 인증이 활성화되어 있습니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg bg-green-500/10 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-500/20">
                <ShieldCheck className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="font-medium text-green-500">2단계 인증 활성화됨</p>
                <p className="text-sm text-muted-foreground">계정이 추가로 보호되고 있습니다</p>
              </div>
            </div>
            <Button
              variant="outline"
              onClick={() => setStep('disable')}
              className="border-destructive text-destructive hover:bg-destructive/10"
            >
              비활성화
            </Button>
          </div>

          {step === 'disable' && (
            <Alert variant="destructive">
              <AlertDescription className="space-y-3">
                <p>2FA를 비활성화하려면 비밀번호를 입력하세요.</p>
                {error && <p className="font-medium">{error}</p>}
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="비밀번호"
                />
                <div className="flex gap-2">
                  <Button
                    variant="destructive"
                    onClick={disableTotp}
                    disabled={isLoading || !password}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        처리 중...
                      </>
                    ) : (
                      '비활성화'
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setStep('idle');
                      setPassword('');
                      setError(null);
                    }}
                  >
                    취소
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    );
  }

  // 비활성화된 상태 (설정 시작 전)
  if (step === 'idle') {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-muted-foreground" />
            <CardTitle>2단계 인증 (2FA)</CardTitle>
          </div>
          <CardDescription>
            TOTP 앱(Google Authenticator 등)을 사용하여 계정 보안을 강화하세요.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="flex items-center justify-between rounded-lg bg-muted/50 p-4">
            <div>
              <p className="font-medium text-foreground">2단계 인증</p>
              <p className="text-sm text-muted-foreground">비활성화됨</p>
            </div>
            <Button onClick={startSetup} disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  로딩 중...
                </>
              ) : (
                '설정하기'
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // QR 코드 표시 단계
  if (step === 'setup' && setupData) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-muted-foreground" />
            <CardTitle>2단계 인증 설정</CardTitle>
          </div>
          <CardDescription>
            인증 앱으로 아래 QR 코드를 스캔하세요.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col items-center">
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
            <Button
              variant="outline"
              onClick={() => {
                setStep('idle');
                setSetupData(null);
              }}
            >
              취소
            </Button>
            <Button onClick={() => setStep('verify')}>
              다음
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // 코드 검증 단계
  if (step === 'verify' && setupData) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-muted-foreground" />
            <CardTitle>인증 코드 확인</CardTitle>
          </div>
          <CardDescription>
            앱에 표시된 6자리 코드를 입력하세요.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Input
            type="text"
            value={verifyCode}
            onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="000000"
            maxLength={6}
            className="text-center text-2xl font-mono tracking-widest"
          />

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setStep('setup');
                setVerifyCode('');
                setError(null);
              }}
            >
              이전
            </Button>
            <Button
              onClick={verifyAndEnable}
              disabled={isLoading || verifyCode.length !== 6}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  확인 중...
                </>
              ) : (
                '활성화'
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // 백업 코드 표시 단계
  if (step === 'backup' && setupData) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-green-500" />
            <CardTitle>백업 코드 저장</CardTitle>
          </div>
          <CardDescription>
            인증 앱을 사용할 수 없을 때 이 코드로 로그인할 수 있습니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert variant="destructive">
            <AlertDescription>
              각 코드는 한 번만 사용할 수 있으며, 안전한 곳에 보관하세요.
            </AlertDescription>
          </Alert>

          <div className="grid grid-cols-2 gap-2 rounded-lg bg-muted p-4">
            {setupData.backupCodes.map((code, i) => (
              <code key={i} className="rounded bg-background px-2 py-1 text-center text-sm">
                {code}
              </code>
            ))}
          </div>

          <div className="flex justify-between">
            <Button variant="outline" onClick={downloadBackupCodes}>
              <Download className="mr-2 h-4 w-4" />
              다운로드
            </Button>
            <Button onClick={finishSetup}>
              완료
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return null;
}
