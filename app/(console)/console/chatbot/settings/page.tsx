'use client';

import { useState } from 'react';
import { useCurrentChatbot, useTenantSettings } from '../../hooks/use-console-state';
import { NoChatbotState } from '../../components/no-chatbot-state';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Bot, Globe, Trash2, FlaskConical, Lock, Crown } from 'lucide-react';

/**
 * Settings - 일반 설정 페이지
 *
 * 챗봇의 기본 설정을 관리하는 페이지
 */
export default function SettingsPage() {
  const { currentChatbot } = useCurrentChatbot();
  const {
    tier,
    isAdvancedModeEnabled,
    canEnableAdvancedMode,
    setAdvancedMode,
    isTenantLoading,
  } = useTenantSettings();

  const [isUpdatingAdvancedMode, setIsUpdatingAdvancedMode] = useState(false);

  const handleAdvancedModeToggle = async (enabled: boolean) => {
    setIsUpdatingAdvancedMode(true);
    try {
      await setAdvancedMode(enabled);
    } catch (error) {
      console.error('Failed to update advanced mode:', error);
    } finally {
      setIsUpdatingAdvancedMode(false);
    }
  };

  const isPremium = canEnableAdvancedMode();
  const advancedModeActive = isAdvancedModeEnabled();

  if (!currentChatbot) {
    return <NoChatbotState />;
  }

  return (
    <div className="p-6">
      {/* 페이지 헤더 */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          일반 설정
        </h1>
        <p className="mt-1 text-muted-foreground">
          챗봇의 기본 정보와 설정을 관리합니다
        </p>
      </div>

      <div className="space-y-6">
        {/* 기본 정보 카드 */}
        <Card size="md">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-muted-foreground" />
              <CardTitle>기본 정보</CardTitle>
            </div>
            <CardDescription>
              챗봇의 이름과 설명을 설정합니다
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">
                챗봇 이름
              </label>
              <input
                type="text"
                defaultValue={currentChatbot?.name ?? ''}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">
                설명
              </label>
              <textarea
                rows={3}
                placeholder="챗봇에 대한 간단한 설명을 입력하세요"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </CardContent>
        </Card>

        {/* 공개 설정 카드 */}
        <Card size="md">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Globe className="h-5 w-5 text-muted-foreground" />
              <CardTitle>공개 설정</CardTitle>
            </div>
            <CardDescription>
              챗봇 페이지의 공개 여부를 설정합니다
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-foreground">공개 페이지</p>
                <p className="text-sm text-muted-foreground">
                  누구나 접속할 수 있는 공개 페이지를 활성화합니다
                </p>
              </div>
              <Button variant="outline" size="sm">
                {currentChatbot?.publicPageEnabled ? '비활성화' : '활성화'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* 고급 데이터 관리 카드 */}
        <Card size="md">
          <CardHeader>
            <div className="flex items-center gap-2">
              <FlaskConical className="h-5 w-5 text-muted-foreground" />
              <CardTitle>고급 데이터 관리</CardTitle>
              {isPremium && (
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                  Premium
                </span>
              )}
            </div>
            <CardDescription>
              여러 데이터셋을 사용하고 청크를 세밀하게 관리합니다
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isPremium ? (
              // Premium 사용자: 토글 활성화 가능
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground">고급 모드 활성화</p>
                  <p className="text-sm text-muted-foreground">
                    데이터셋 메뉴가 표시되고 다중 데이터셋 관리가 가능합니다
                  </p>
                </div>
                <Switch
                  checked={advancedModeActive}
                  onCheckedChange={handleAdvancedModeToggle}
                  disabled={isUpdatingAdvancedMode || isTenantLoading}
                />
              </div>
            ) : (
              // 일반 사용자: 업그레이드 안내
              <div className="rounded-lg border border-border bg-muted/50 p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <Crown className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-foreground">
                      Premium 전용 기능입니다
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      고급 데이터 관리 기능을 사용하려면 Premium 플랜으로
                      업그레이드하세요. 현재 플랜:{' '}
                      <span className="font-medium capitalize">{tier}</span>
                    </p>
                    <Button variant="outline" size="sm" className="mt-3">
                      <Lock className="mr-2 h-4 w-4" />
                      업그레이드 알아보기
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 위험 영역 카드 */}
        <Card size="md" variant="ghost" className="border-destructive/30">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-destructive" />
              <CardTitle className="text-destructive">위험 영역</CardTitle>
            </div>
            <CardDescription>
              이 작업은 되돌릴 수 없습니다
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-foreground">챗봇 삭제</p>
                <p className="text-sm text-muted-foreground">
                  모든 데이터와 설정이 영구적으로 삭제됩니다
                </p>
              </div>
              <Button variant="destructive" size="sm">
                삭제
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
