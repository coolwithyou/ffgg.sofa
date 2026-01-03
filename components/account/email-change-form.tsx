'use client';

/**
 * 이메일 변경 폼 컴포넌트
 * 새 이메일로 인증 메일 발송 요청
 * shadcn/ui Input, Button, Label, Alert 컴포넌트 적용
 */

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface EmailChangeFormProps {
  currentEmail: string;
  onSuccess?: () => void;
}

export default function EmailChangeForm({
  currentEmail,
  onSuccess,
}: EmailChangeFormProps) {
  const [newEmail, setNewEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (!newEmail.trim() || !password) {
      setMessage({ type: 'error', text: '모든 필드를 입력해주세요.' });
      return;
    }

    // 이메일 형식 검증
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail)) {
      setMessage({ type: 'error', text: '유효한 이메일 주소를 입력해주세요.' });
      return;
    }

    // 동일한 이메일인지 확인
    if (newEmail.toLowerCase() === currentEmail.toLowerCase()) {
      setMessage({ type: 'error', text: '현재 이메일과 동일합니다.' });
      return;
    }

    try {
      setIsLoading(true);

      const res = await fetch('/api/user/change-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newEmail, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || '이메일 변경 요청에 실패했습니다.');
      }

      setMessage({
        type: 'success',
        text: data.message || '인증 이메일이 발송되었습니다.',
      });
      setNewEmail('');
      setPassword('');
      setIsExpanded(false);
      onSuccess?.();
    } catch (err) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : '오류가 발생했습니다.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    setNewEmail('');
    setPassword('');
    setMessage(null);
    setIsExpanded(false);
  };

  return (
    <div className="space-y-4">
      {/* 현재 이메일 표시 */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <Label className="text-muted-foreground">이메일</Label>
          <p className="text-foreground">{currentEmail}</p>
        </div>
        {!isExpanded && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(true)}
          >
            변경
          </Button>
        )}
      </div>

      {/* 알림 메시지 */}
      {message && (
        <Alert variant={message.type === 'success' ? 'default' : 'destructive'}>
          <AlertDescription
            className={message.type === 'success' ? 'text-green-500' : ''}
          >
            {message.text}
          </AlertDescription>
        </Alert>
      )}

      {/* 이메일 변경 폼 */}
      {isExpanded && (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="rounded-lg border border-border bg-muted/30 p-4">
            <p className="mb-4 text-sm text-muted-foreground">
              새 이메일 주소로 인증 링크가 발송됩니다. 24시간 내에 인증을
              완료해주세요.
            </p>

            <div className="space-y-3">
              {/* 새 이메일 */}
              <div className="space-y-2">
                <Label htmlFor="newEmail">새 이메일 주소</Label>
                <Input
                  type="email"
                  id="newEmail"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="new@example.com"
                  autoComplete="email"
                  disabled={isLoading}
                />
              </div>

              {/* 현재 비밀번호 */}
              <div className="space-y-2">
                <Label htmlFor="emailChangePassword">현재 비밀번호</Label>
                <Input
                  type="password"
                  id="emailChangePassword"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="비밀번호 확인"
                  autoComplete="current-password"
                  disabled={isLoading}
                />
              </div>
            </div>

            {/* 버튼 */}
            <div className="mt-4 flex gap-2">
              <Button type="submit" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    처리 중...
                  </>
                ) : (
                  '인증 메일 발송'
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleCancel}
                disabled={isLoading}
              >
                취소
              </Button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
