/**
 * 위젯 배포 설정 컴포넌트
 */

'use client';

import { useState, useEffect } from 'react';
import {
  Globe,
  Copy,
  Check,
  AlertCircle,
  Code,
  Palette,
  MessageSquare,
} from 'lucide-react';
import { toast } from 'sonner';

interface WidgetData {
  enabled: boolean;
  apiKey: string | null;
  config: {
    primaryColor?: string;
    position?: 'bottom-right' | 'bottom-left';
    welcomeMessage?: string;
    inputPlaceholder?: string;
    showBranding?: boolean;
  };
  hasDatasets: boolean;
  embedCode: string | null;
}

interface WidgetSettingsProps {
  chatbotId: string;
  hasDatasets: boolean;
  onUpdate: () => void;
}

export function WidgetSettings({
  chatbotId,
  hasDatasets,
  onUpdate,
}: WidgetSettingsProps) {
  const [widget, setWidget] = useState<WidgetData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isToggling, setIsToggling] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  // 설정 폼 상태
  const [primaryColor, setPrimaryColor] = useState('#3B82F6');
  const [position, setPosition] = useState<'bottom-right' | 'bottom-left'>(
    'bottom-right'
  );
  const [welcomeMessage, setWelcomeMessage] = useState('');
  const [inputPlaceholder, setInputPlaceholder] = useState('');

  useEffect(() => {
    fetchWidget();
  }, [chatbotId]);

  const fetchWidget = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/chatbots/${chatbotId}/widget`);
      if (response.ok) {
        const data = await response.json();
        setWidget(data.widget);
        // 설정 값 초기화
        if (data.widget.config) {
          setPrimaryColor(data.widget.config.primaryColor || '#3B82F6');
          setPosition(data.widget.config.position || 'bottom-right');
          setWelcomeMessage(data.widget.config.welcomeMessage || '');
          setInputPlaceholder(data.widget.config.inputPlaceholder || '');
        }
      }
    } catch (err) {
      console.error('Failed to fetch widget:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggle = async () => {
    if (!widget) return;

    setIsToggling(true);
    try {
      const response = await fetch(`/api/chatbots/${chatbotId}/widget`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !widget.enabled }),
      });

      if (response.ok) {
        await fetchWidget();
        onUpdate();
      } else {
        const data = await response.json();
        showError('위젯 설정 오류', data.error || '오류가 발생했습니다.');
      }
    } catch (err) {
      console.error('Toggle error:', err);
    } finally {
      setIsToggling(false);
    }
  };

  const handleSaveConfig = async () => {
    setIsSaving(true);
    try {
      const response = await fetch(`/api/chatbots/${chatbotId}/widget`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          primaryColor,
          position,
          welcomeMessage: welcomeMessage || undefined,
          inputPlaceholder: inputPlaceholder || undefined,
        }),
      });

      if (response.ok) {
        await fetchWidget();
        success('저장 완료', '위젯 설정이 저장되었습니다.');
      }
    } catch (err) {
      console.error('Save error:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCopyCode = async () => {
    if (!widget?.embedCode) return;

    try {
      await navigator.clipboard.writeText(widget.embedCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Copy error:', err);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!widget) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center">
        <AlertCircle className="mx-auto h-12 w-12 text-muted-foreground" />
        <p className="mt-4 text-muted-foreground">
          위젯 정보를 불러올 수 없습니다.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 활성화 상태 */}
      <div className="flex items-center justify-between rounded-lg border border-border bg-card p-4">
        <div className="flex items-center gap-4">
          <div
            className={`flex h-12 w-12 items-center justify-center rounded-lg ${
              widget.enabled ? 'bg-green-500/10' : 'bg-muted'
            }`}
          >
            <Globe
              className={`h-6 w-6 ${
                widget.enabled ? 'text-green-500' : 'text-muted-foreground'
              }`}
            />
          </div>
          <div>
            <h3 className="font-medium text-foreground">웹 위젯</h3>
            <p className="text-sm text-muted-foreground">
              {widget.enabled
                ? '위젯이 활성화되어 있습니다'
                : '위젯이 비활성화되어 있습니다'}
            </p>
          </div>
        </div>
        <button
          onClick={handleToggle}
          disabled={isToggling || (!widget.enabled && !hasDatasets)}
          className={`rounded-md px-4 py-2 text-sm font-medium ${
            widget.enabled
              ? 'border border-border text-foreground hover:bg-muted'
              : 'bg-primary text-primary-foreground hover:bg-primary/90'
          } disabled:cursor-not-allowed disabled:opacity-50`}
        >
          {isToggling ? (
            <span className="flex items-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              처리 중...
            </span>
          ) : widget.enabled ? (
            '비활성화'
          ) : (
            '활성화'
          )}
        </button>
      </div>

      {/* 데이터셋 없음 경고 */}
      {!hasDatasets && (
        <div className="flex items-start gap-3 rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-4">
          <AlertCircle className="mt-0.5 h-5 w-5 text-yellow-500" />
          <div>
            <h4 className="font-medium text-yellow-500">데이터셋 필요</h4>
            <p className="mt-1 text-sm text-yellow-500/80">
              위젯을 활성화하려면 먼저 데이터셋을 연결해주세요.
            </p>
          </div>
        </div>
      )}

      {/* 임베드 코드 */}
      {widget.enabled && widget.embedCode && (
        <div className="rounded-lg border border-border bg-card p-4">
          <h3 className="mb-3 flex items-center gap-2 font-medium text-foreground">
            <Code className="h-5 w-5" />
            임베드 코드
          </h3>
          <p className="mb-3 text-sm text-muted-foreground">
            아래 코드를 웹사이트의 &lt;body&gt; 태그 내에 추가하세요.
          </p>
          <div className="relative">
            <pre className="overflow-x-auto rounded-md bg-muted p-4 text-sm text-foreground">
              <code>{widget.embedCode}</code>
            </pre>
            <button
              onClick={handleCopyCode}
              className="absolute right-2 top-2 rounded-md bg-background p-2 text-muted-foreground hover:text-foreground"
            >
              {copied ? (
                <Check className="h-4 w-4 text-green-500" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </button>
          </div>
          {widget.apiKey && (
            <p className="mt-3 text-xs text-muted-foreground">
              API 키: <code className="rounded bg-muted px-1">{widget.apiKey}</code>
            </p>
          )}
        </div>
      )}

      {/* 위젯 설정 */}
      <div className="rounded-lg border border-border bg-card p-4">
        <h3 className="mb-4 flex items-center gap-2 font-medium text-foreground">
          <Palette className="h-5 w-5" />
          위젯 설정
        </h3>
        <div className="space-y-4">
          {/* 프라이머리 컬러 */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">
              프라이머리 컬러
            </label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                className="h-10 w-20 cursor-pointer rounded border border-border"
              />
              <input
                type="text"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                className="w-28 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
                placeholder="#3B82F6"
              />
            </div>
          </div>

          {/* 위치 */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">
              위젯 위치
            </label>
            <select
              value={position}
              onChange={(e) =>
                setPosition(e.target.value as 'bottom-right' | 'bottom-left')
              }
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="bottom-right">우측 하단</option>
              <option value="bottom-left">좌측 하단</option>
            </select>
          </div>

          {/* 환영 메시지 */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">
              환영 메시지
            </label>
            <input
              type="text"
              value={welcomeMessage}
              onChange={(e) => setWelcomeMessage(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="안녕하세요! 무엇을 도와드릴까요?"
              maxLength={500}
            />
          </div>

          {/* 입력 플레이스홀더 */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">
              입력창 플레이스홀더
            </label>
            <input
              type="text"
              value={inputPlaceholder}
              onChange={(e) => setInputPlaceholder(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="메시지를 입력하세요..."
              maxLength={100}
            />
          </div>

          <button
            onClick={handleSaveConfig}
            disabled={isSaving}
            className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {isSaving ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                저장 중...
              </>
            ) : (
              <>
                <Check className="h-4 w-4" />
                설정 저장
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
