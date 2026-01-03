'use client';

/**
 * Console 보안 설정 페이지
 * 비밀번호 변경, 2FA 설정, 로그인 기록, 세션 관리
 * shadcn/ui Card, Button, Input, Alert 컴포넌트 적용
 */

import { useState, useEffect } from 'react';
import { Lock, Loader2 } from 'lucide-react';
import {
  TotpSetup,
  LoginHistory,
  ActiveSessions,
} from '@/components/account';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function SecurityPage() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const [totpEnabled, setTotpEnabled] = useState(false);
  const [totpLoading, setTotpLoading] = useState(true);

  useEffect(() => {
    fetchTotpStatus();
  }, []);

  const fetchTotpStatus = async () => {
    try {
      setTotpLoading(true);
      const res = await fetch('/api/user/totp/status');
      const data = await res.json();
      if (res.ok) {
        setTotpEnabled(data.enabled);
      }
    } catch {
      // 에러 무시 - 기본값 false 유지
    } finally {
      setTotpLoading(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentPassword || !newPassword || !confirmPassword) {
      setMessage({ type: 'error', text: '모든 필드를 입력해주세요' });
      return;
    }

    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: '새 비밀번호가 일치하지 않습니다' });
      return;
    }

    if (newPassword.length < 8) {
      setMessage({ type: 'error', text: '비밀번호는 8자 이상이어야 합니다' });
      return;
    }

    try {
      setIsSubmitting(true);
      setMessage(null);

      const res = await fetch('/api/user/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword,
          newPassword,
          confirmPassword,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || '비밀번호 변경에 실패했습니다');
      }

      setMessage({ type: 'success', text: data.message });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : '오류가 발생했습니다',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* 비밀번호 변경 카드 */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-muted-foreground" />
            <CardTitle>비밀번호 변경</CardTitle>
          </div>
          <CardDescription>
            정기적으로 비밀번호를 변경하면 계정 보안을 강화할 수 있습니다
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* 결과 메시지 */}
          {message && (
            <Alert
              variant={message.type === 'success' ? 'default' : 'destructive'}
              className="mb-4"
            >
              <AlertDescription
                className={message.type === 'success' ? 'text-green-500' : ''}
              >
                {message.text}
              </AlertDescription>
            </Alert>
          )}

          <form onSubmit={handlePasswordChange} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="currentPassword">현재 비밀번호</Label>
              <Input
                id="currentPassword"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="현재 비밀번호"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="newPassword">새 비밀번호</Label>
              <Input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="새 비밀번호 (8자 이상)"
              />
              <p className="text-xs text-muted-foreground">
                대문자, 소문자, 숫자, 특수문자를 포함하면 더 안전합니다
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">새 비밀번호 확인</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="새 비밀번호 확인"
              />
            </div>

            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  변경 중...
                </>
              ) : (
                '비밀번호 변경'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* 2단계 인증 (2FA) */}
      {totpLoading ? (
        <Card>
          <CardContent className="flex items-center justify-center py-8">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </CardContent>
        </Card>
      ) : (
        <TotpSetup isEnabled={totpEnabled} onStatusChange={fetchTotpStatus} />
      )}

      {/* 활성 세션 */}
      <ActiveSessions />

      {/* 로그인 기록 */}
      <LoginHistory />
    </div>
  );
}
