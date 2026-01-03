'use client';

/**
 * 카카오 오픈빌더 연동 설정 카드
 *
 * Console 연동 페이지에서 카카오톡 채널 연동을 관리하는 컴포넌트
 */

import { useState, useTransition } from 'react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import {
  MessageCircle,
  Copy,
  Check,
  ExternalLink,
  Loader2,
} from 'lucide-react';

export interface KakaoConfig {
  maxResponseLength?: number;
  welcomeMessage?: string;
  fallbackMessage?: string;
}

export interface KakaoData {
  enabled: boolean;
  botId: string | null;
  config: KakaoConfig;
  skillUrl: string;
  hasDatasets: boolean;
}

interface KakaoSettingsCardProps {
  chatbotId: string;
  initialData: KakaoData;
  onSaveSuccess?: () => void;
}

export function KakaoSettingsCard({
  chatbotId,
  initialData,
  onSaveSuccess,
}: KakaoSettingsCardProps) {
  // 상태 관리
  const [enabled, setEnabled] = useState(initialData.enabled);
  const [botId, setBotId] = useState(initialData.botId || '');
  const [maxResponseLength, setMaxResponseLength] = useState(
    initialData.config.maxResponseLength || 300
  );
  const [welcomeMessage, setWelcomeMessage] = useState(
    initialData.config.welcomeMessage || ''
  );
  const [fallbackMessage, setFallbackMessage] = useState(
    initialData.config.fallbackMessage ||
      '죄송합니다. 요청을 처리할 수 없습니다. 잠시 후 다시 시도해 주세요.'
  );
  const [skillUrl] = useState(initialData.skillUrl);
  const [hasDatasets] = useState(initialData.hasDatasets);

  const [isPending, startTransition] = useTransition();
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // 활성화/비활성화 토글
  const handleToggle = (newEnabled: boolean) => {
    // 활성화 시 검증
    if (newEnabled) {
      if (!botId.trim()) {
        toast.error('카카오 봇 ID를 먼저 입력해주세요');
        return;
      }
      if (!hasDatasets) {
        toast.error('카카오를 연동하려면 먼저 데이터셋을 연결해주세요');
        return;
      }
    }

    startTransition(async () => {
      try {
        const response = await fetch(`/api/chatbots/${chatbotId}/kakao`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            enabled: newEnabled,
            botId: botId.trim() || undefined,
          }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || '상태 변경에 실패했습니다');
        }

        setEnabled(newEnabled);
        toast.success(
          newEnabled ? '카카오 연동이 활성화되었습니다' : '카카오 연동이 비활성화되었습니다'
        );
        onSaveSuccess?.();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : '오류가 발생했습니다');
      }
    });
  };

  // 설정 저장
  const handleSave = () => {
    startTransition(async () => {
      try {
        const response = await fetch(`/api/chatbots/${chatbotId}/kakao`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            botId: botId.trim() || undefined,
            maxResponseLength,
            welcomeMessage: welcomeMessage.trim() || undefined,
            fallbackMessage: fallbackMessage.trim() || undefined,
          }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || '저장에 실패했습니다');
        }

        toast.success('카카오 설정이 저장되었습니다');
        onSaveSuccess?.();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : '오류가 발생했습니다');
      }
    });
  };

  // 복사 기능
  const handleCopy = async (text: string, field: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedField(field);
    toast.success('클립보드에 복사되었습니다');
    setTimeout(() => setCopiedField(null), 2000);
  };

  return (
    <Card size="md">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-muted-foreground" />
            <CardTitle>카카오 오픈빌더</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {enabled ? '활성화' : '비활성화'}
            </span>
            <Switch
              checked={enabled}
              onCheckedChange={handleToggle}
              disabled={isPending}
            />
          </div>
        </div>
        <CardDescription>
          카카오톡 채널과 연동하여 카카오톡에서 챗봇을 사용할 수 있습니다
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* Bot ID */}
        <div className="space-y-2">
          <Label htmlFor="kakao-bot-id">Bot ID</Label>
          <input
            id="kakao-bot-id"
            type="text"
            value={botId}
            onChange={(e) => setBotId(e.target.value)}
            placeholder="카카오 오픈빌더에서 발급받은 Bot ID"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <p className="text-xs text-muted-foreground">
            카카오 오픈빌더 &gt; 설정 &gt; 일반에서 확인할 수 있습니다
          </p>
        </div>

        {/* 스킬 서버 URL */}
        <div className="space-y-2">
          <Label>스킬 서버 URL</Label>
          <div className="flex gap-2">
            <input
              type="text"
              value={skillUrl}
              readOnly
              className="flex-1 rounded-lg border border-border bg-muted px-3 py-2 text-sm text-muted-foreground"
            />
            <Button
              variant="outline"
              size="icon"
              onClick={() => handleCopy(skillUrl, 'skillUrl')}
            >
              {copiedField === 'skillUrl' ? (
                <Check className="h-4 w-4" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            이 URL을 카카오 오픈빌더 스킬 설정에 등록하세요
          </p>
        </div>

        {/* 최대 응답 길이 */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>최대 응답 길이</Label>
            <span className="text-sm font-medium text-foreground">
              {maxResponseLength}자
            </span>
          </div>
          <Slider
            value={[maxResponseLength]}
            onValueChange={(value) => setMaxResponseLength(value[0])}
            min={100}
            max={1000}
            step={50}
            className="w-full"
          />
          <p className="text-xs text-muted-foreground">
            카카오톡 메시지 길이 제한을 고려하여 100~1000자 사이로 설정하세요
          </p>
        </div>

        {/* 환영 메시지 */}
        <div className="space-y-2">
          <Label htmlFor="kakao-welcome">환영 메시지</Label>
          <textarea
            id="kakao-welcome"
            rows={2}
            value={welcomeMessage}
            onChange={(e) => setWelcomeMessage(e.target.value)}
            placeholder="안녕하세요! 무엇을 도와드릴까요?"
            maxLength={200}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary resize-none"
          />
          <p className="text-xs text-muted-foreground">
            사용자가 처음 대화를 시작할 때 보여줄 메시지 (최대 200자)
          </p>
        </div>

        {/* 폴백 메시지 */}
        <div className="space-y-2">
          <Label htmlFor="kakao-fallback">폴백 메시지</Label>
          <textarea
            id="kakao-fallback"
            rows={2}
            value={fallbackMessage}
            onChange={(e) => setFallbackMessage(e.target.value)}
            placeholder="죄송합니다. 요청을 처리할 수 없습니다."
            maxLength={500}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary resize-none"
          />
          <p className="text-xs text-muted-foreground">
            응답을 생성할 수 없을 때 표시할 메시지 (최대 500자)
          </p>
        </div>

        {/* 카카오 오픈빌더 링크 */}
        <a
          href="https://i.kakao.com/openbuilder"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
        >
          카카오 오픈빌더 바로가기
          <ExternalLink className="h-3 w-3" />
        </a>

        {/* 저장 버튼 */}
        <div className="flex justify-end pt-2">
          <Button onClick={handleSave} disabled={isPending}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            설정 저장
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
