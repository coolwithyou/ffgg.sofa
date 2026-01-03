'use client';

/**
 * Console 알림 설정 페이지
 * shadcn/ui Switch, Card, Badge 컴포넌트 적용
 */

import { useState, useEffect } from 'react';
import { Shield, BarChart3, Megaphone, Bell } from 'lucide-react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface NotificationSettings {
  security: boolean;
  usage: boolean;
  marketing: boolean;
}

interface NotificationOption {
  key: keyof NotificationSettings;
  title: string;
  description: string;
  icon: typeof Shield;
  recommended: boolean;
}

const NOTIFICATION_OPTIONS: NotificationOption[] = [
  {
    key: 'security',
    title: '보안 알림',
    description: '새 기기 로그인, 비밀번호 변경, 2FA 설정 변경 시 알림을 받습니다.',
    icon: Shield,
    recommended: true,
  },
  {
    key: 'usage',
    title: '사용량 알림',
    description: '사용량 한도 80% 도달, 한도 초과 시 알림을 받습니다.',
    icon: BarChart3,
    recommended: true,
  },
  {
    key: 'marketing',
    title: '마케팅 알림',
    description: '새로운 기능, 프로모션, 이벤트 소식을 받습니다.',
    icon: Megaphone,
    recommended: false,
  },
];

export default function NotificationsPage() {
  const [settings, setSettings] = useState<NotificationSettings>({
    security: true,
    usage: true,
    marketing: false,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const [pendingChanges, setPendingChanges] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const res = await fetch('/api/user/notification-settings');
      if (!res.ok) {
        throw new Error('설정을 불러올 수 없습니다.');
      }

      const data = await res.json();
      setSettings(data.settings);
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggle = async (key: keyof NotificationSettings) => {
    const newValue = !settings[key];
    const newSettings = { ...settings, [key]: newValue };

    // 낙관적 업데이트
    setSettings(newSettings);
    setPendingChanges((prev) => new Set(prev).add(key));
    setSaveStatus(null);

    try {
      const res = await fetch('/api/user/notification-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: { [key]: newValue } }),
      });

      if (!res.ok) {
        // 실패 시 롤백
        setSettings(settings);
        throw new Error('설정 저장에 실패했습니다.');
      }

      setSaveStatus({ type: 'success', text: '설정이 저장되었습니다.' });
      setTimeout(() => setSaveStatus(null), 2000);
    } catch (err) {
      setSaveStatus({
        type: 'error',
        text: err instanceof Error ? err.message : '오류가 발생했습니다.',
      });
    } finally {
      setPendingChanges((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* 헤더 카드 */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-muted-foreground" />
            <CardTitle>알림 설정</CardTitle>
          </div>
          <CardDescription>
            이메일로 받을 알림 유형을 선택하세요. 보안 알림은 계정 보호를 위해
            활성화하는 것을 권장합니다.
          </CardDescription>
        </CardHeader>
      </Card>

      {/* 저장 상태 메시지 */}
      {saveStatus && (
        <Alert variant={saveStatus.type === 'success' ? 'default' : 'destructive'}>
          <AlertDescription
            className={saveStatus.type === 'success' ? 'text-green-500' : ''}
          >
            {saveStatus.text}
          </AlertDescription>
        </Alert>
      )}

      {/* 알림 설정 카드 */}
      <Card>
        <CardContent className="divide-y divide-border p-0">
          {NOTIFICATION_OPTIONS.map((option) => {
            const Icon = option.icon;
            const isPending = pendingChanges.has(option.key);

            return (
              <div
                key={option.key}
                className="flex items-center justify-between p-4"
              >
                <div className="flex items-start gap-4">
                  {/* 아이콘 */}
                  <div className="mt-0.5 text-muted-foreground">
                    <Icon className="h-5 w-5" />
                  </div>

                  {/* 텍스트 */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground">
                        {option.title}
                      </span>
                      {option.recommended && (
                        <Badge variant="default" className="text-xs">
                          권장
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {option.description}
                    </p>
                  </div>
                </div>

                {/* Switch */}
                <Switch
                  checked={settings[option.key]}
                  onCheckedChange={() => handleToggle(option.key)}
                  disabled={isPending}
                  aria-label={option.title}
                />
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* 추가 안내 */}
      <p className="text-center text-sm text-muted-foreground">
        알림 설정은 즉시 적용됩니다. 필수 알림(비밀번호 재설정 등)은 항상 발송됩니다.
      </p>
    </div>
  );
}
