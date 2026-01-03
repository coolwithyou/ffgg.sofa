'use client';

/**
 * 위젯 임베드 연동 설정 카드
 *
 * Console 연동 페이지에서 웹 위젯 설정을 관리하는 컴포넌트
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
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import {
  Code,
  Copy,
  Check,
  Loader2,
  ArrowUp,
} from 'lucide-react';

// 프리셋 색상 (포털과 동일)
const PRESET_COLORS = [
  '#3B82F6', // Blue
  '#10B981', // Green
  '#8B5CF6', // Purple
  '#F59E0B', // Amber
  '#EF4444', // Red
  '#06B6D4', // Cyan
  '#EC4899', // Pink
  '#6366F1', // Indigo
];

export interface WidgetConfig {
  primaryColor?: string;
  title?: string;
  subtitle?: string;
  inputPlaceholder?: string;
  position?: 'bottom-right' | 'bottom-left';
  showBranding?: boolean;
}

export interface WidgetData {
  enabled: boolean;
  apiKey: string | null;
  config: WidgetConfig;
  embedCode: string | null;
  hasDatasets: boolean;
}

interface WidgetSettingsCardProps {
  chatbotId: string;
  initialData: WidgetData;
  onSaveSuccess?: () => void;
}

export function WidgetSettingsCard({
  chatbotId,
  initialData,
  onSaveSuccess,
}: WidgetSettingsCardProps) {
  // 상태 관리
  const [enabled, setEnabled] = useState(initialData.enabled);
  const [apiKey, setApiKey] = useState(initialData.apiKey);
  const [embedCode, setEmbedCode] = useState(initialData.embedCode);
  const [hasDatasets] = useState(initialData.hasDatasets);

  // 설정 상태
  const [primaryColor, setPrimaryColor] = useState(
    initialData.config.primaryColor || '#3B82F6'
  );
  const [title, setTitle] = useState(
    initialData.config.title || '무엇을 도와드릴까요?'
  );
  const [subtitle, setSubtitle] = useState(
    initialData.config.subtitle || '질문을 입력해주세요'
  );
  const [inputPlaceholder, setInputPlaceholder] = useState(
    initialData.config.inputPlaceholder || '메시지를 입력하세요...'
  );

  const [isPending, startTransition] = useTransition();
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // 활성화/비활성화 토글
  const handleToggle = (newEnabled: boolean) => {
    // 활성화 시 검증
    if (newEnabled && !hasDatasets) {
      toast.error('위젯을 활성화하려면 먼저 데이터셋을 연결해주세요');
      return;
    }

    startTransition(async () => {
      try {
        const response = await fetch(`/api/chatbots/${chatbotId}/widget`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ enabled: newEnabled }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || '상태 변경에 실패했습니다');
        }

        const data = await response.json();
        setEnabled(newEnabled);
        setApiKey(data.widget.apiKey);
        setEmbedCode(data.widget.embedCode);
        toast.success(
          newEnabled ? '위젯이 활성화되었습니다' : '위젯이 비활성화되었습니다'
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
        const response = await fetch(`/api/chatbots/${chatbotId}/widget`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            primaryColor,
            title: title.trim() || undefined,
            subtitle: subtitle.trim() || undefined,
            inputPlaceholder: inputPlaceholder.trim() || undefined,
          }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || '저장에 실패했습니다');
        }

        toast.success('위젯 설정이 저장되었습니다');
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
            <Code className="h-5 w-5 text-muted-foreground" />
            <CardTitle>위젯 임베드</CardTitle>
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
          웹사이트에 챗봇 위젯을 삽입하여 방문자와 대화할 수 있습니다
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* 기본 색상 */}
        <div className="space-y-2">
          <Label>기본 색상</Label>
          <div className="flex items-center gap-2">
            {PRESET_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => setPrimaryColor(color)}
                className={`h-8 w-8 rounded-full border-2 transition-transform ${
                  primaryColor === color
                    ? 'scale-110 border-foreground'
                    : 'border-transparent hover:scale-105'
                }`}
                style={{ backgroundColor: color }}
                aria-label={`색상 ${color}`}
              />
            ))}
            <input
              type="color"
              value={primaryColor}
              onChange={(e) => setPrimaryColor(e.target.value)}
              className="h-8 w-8 cursor-pointer rounded-lg border border-border bg-background"
              title="커스텀 색상 선택"
            />
          </div>
        </div>

        {/* 제목 */}
        <div className="space-y-2">
          <Label htmlFor="widget-title">제목</Label>
          <input
            id="widget-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="무엇을 도와드릴까요?"
            maxLength={50}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        {/* 부제목 */}
        <div className="space-y-2">
          <Label htmlFor="widget-subtitle">부제목</Label>
          <input
            id="widget-subtitle"
            type="text"
            value={subtitle}
            onChange={(e) => setSubtitle(e.target.value)}
            placeholder="질문을 입력해주세요"
            maxLength={100}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        {/* 입력 안내 텍스트 */}
        <div className="space-y-2">
          <Label htmlFor="widget-placeholder">입력 안내 텍스트</Label>
          <input
            id="widget-placeholder"
            type="text"
            value={inputPlaceholder}
            onChange={(e) => setInputPlaceholder(e.target.value)}
            placeholder="메시지를 입력하세요..."
            maxLength={100}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        {/* 미리보기 */}
        <div className="space-y-2">
          <Label>미리보기</Label>
          <div className="overflow-hidden rounded-xl border border-border shadow-lg">
            {/* 헤더 */}
            <div
              className="px-4 py-3 text-white"
              style={{ backgroundColor: primaryColor }}
            >
              <h3 className="font-semibold">{title || '제목'}</h3>
              <p className="text-sm opacity-90">{subtitle || '부제목'}</p>
            </div>
            {/* 메시지 영역 */}
            <div className="h-24 bg-muted p-3">
              <div className="inline-block rounded-lg bg-card px-3 py-2 text-sm text-foreground border border-border">
                안녕하세요! 무엇을 도와드릴까요?
              </div>
            </div>
            {/* 입력 영역 */}
            <div className="border-t border-border bg-card p-3">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder={inputPlaceholder || '메시지 입력...'}
                  disabled
                  className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground"
                />
                <div
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-white"
                  style={{ backgroundColor: primaryColor }}
                >
                  <ArrowUp className="h-4 w-4" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 임베드 코드 */}
        {enabled && embedCode && (
          <div className="space-y-2">
            <Label>임베드 코드</Label>
            <div className="relative">
              <pre className="overflow-x-auto rounded-lg border border-border bg-muted p-3 text-sm">
                <code className="text-muted-foreground">{embedCode}</code>
              </pre>
              <Button
                variant="outline"
                size="icon"
                className="absolute right-2 top-2"
                onClick={() => handleCopy(embedCode, 'embedCode')}
              >
                {copiedField === 'embedCode' ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              이 코드를 웹사이트의 {'<body>'} 태그 끝에 추가하세요
            </p>
          </div>
        )}

        {/* API 키 */}
        {apiKey && (
          <div className="space-y-2">
            <Label>API 키</Label>
            <div className="flex gap-2">
              <input
                type="password"
                value={apiKey}
                readOnly
                className="flex-1 rounded-lg border border-border bg-muted px-3 py-2 font-mono text-sm text-muted-foreground"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => handleCopy(apiKey, 'apiKey')}
              >
                {copiedField === 'apiKey' ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              API 직접 호출 시 사용하는 인증 키입니다
            </p>
          </div>
        )}

        {/* 설치 가이드 */}
        {enabled && (
          <div className="rounded-lg border border-border bg-muted/50 p-4 space-y-2">
            <h4 className="font-medium text-foreground text-sm">설치 가이드</h4>
            <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
              <li>위의 임베드 코드를 복사하세요</li>
              <li>웹사이트의 {'<body>'} 태그 끝에 붙여넣으세요</li>
              <li>저장 후 페이지를 새로고침하면 위젯이 표시됩니다</li>
            </ol>
            <p className="text-xs text-muted-foreground mt-2">
              * HTTPS 환경에서만 정상 작동합니다
            </p>
          </div>
        )}

        {/* 위젯 디자인 커스터마이징 안내 */}
        <p className="text-sm text-muted-foreground">
          더 자세한 위젯 디자인 설정은{' '}
          <a
            href="/console/appearance/widget"
            className="text-primary hover:underline"
          >
            디자인 → 위젯
          </a>{' '}
          메뉴에서 변경할 수 있습니다.
        </p>

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
