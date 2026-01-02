'use client';

import { useState, useEffect } from 'react';
import { useCurrentChatbot } from '../../hooks/use-console-state';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  MessageCircle,
  Code,
  Copy,
  Check,
  ExternalLink,
  Loader2,
} from 'lucide-react';

interface KakaoConfig {
  fallbackMessage?: string;
  quickReplies?: string[];
}

interface ChatbotData {
  kakaoEnabled: boolean;
  kakaoBotId: string | null;
  kakaoConfig: KakaoConfig;
  widgetEnabled: boolean;
  widgetApiKey: string | null;
}

/**
 * Settings - 연동 설정 페이지
 *
 * 카카오 오픈빌더, 위젯 임베드 등 외부 연동을 관리하는 페이지
 */
export default function IntegrationsSettingsPage() {
  const { currentChatbot } = useCurrentChatbot();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // 카카오 설정 상태
  const [kakaoEnabled, setKakaoEnabled] = useState(false);
  const [kakaoBotId, setKakaoBotId] = useState('');
  const [kakaoConfig, setKakaoConfig] = useState<KakaoConfig>({
    fallbackMessage:
      '죄송합니다. 요청을 처리할 수 없습니다. 잠시 후 다시 시도해 주세요.',
    quickReplies: [],
  });

  // 위젯 설정 상태
  const [widgetEnabled, setWidgetEnabled] = useState(false);
  const [widgetApiKey, setWidgetApiKey] = useState<string | null>(null);

  // 챗봇 데이터 로드
  useEffect(() => {
    if (!currentChatbot?.id) return;

    const fetchChatbot = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`/api/chatbots/${currentChatbot.id}`);
        if (!response.ok) throw new Error('챗봇 데이터를 불러올 수 없습니다');

        const data: ChatbotData = await response.json();

        setKakaoEnabled(data.kakaoEnabled ?? false);
        setKakaoBotId(data.kakaoBotId ?? '');
        setKakaoConfig(
          data.kakaoConfig ?? {
            fallbackMessage:
              '죄송합니다. 요청을 처리할 수 없습니다. 잠시 후 다시 시도해 주세요.',
            quickReplies: [],
          }
        );
        setWidgetEnabled(data.widgetEnabled ?? false);
        setWidgetApiKey(data.widgetApiKey);
      } catch (error) {
        console.error('챗봇 데이터 로드 오류:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchChatbot();
  }, [currentChatbot?.id]);

  const handleSave = async () => {
    if (!currentChatbot?.id) return;
    setIsSaving(true);

    try {
      const response = await fetch(`/api/chatbots/${currentChatbot.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kakaoEnabled,
          kakaoBotId: kakaoBotId || null,
          kakaoConfig,
          widgetEnabled,
        }),
      });

      if (!response.ok) {
        throw new Error('설정 저장에 실패했습니다');
      }
    } catch (error) {
      console.error('설정 저장 오류:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCopy = async (text: string, field: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  // 위젯 임베드 코드 생성
  const widgetEmbedCode = currentChatbot?.id
    ? `<script src="${process.env.NEXT_PUBLIC_APP_URL || 'https://sofa.ai'}/widget.js" data-chatbot-id="${currentChatbot.id}"></script>`
    : '';

  // 스킬 서버 URL
  const skillServerUrl = currentChatbot?.id
    ? `${process.env.NEXT_PUBLIC_APP_URL || 'https://sofa.ai'}/api/kakao/${currentChatbot.id}/skill`
    : '';

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* 페이지 헤더 */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          연동 설정
        </h1>
        <p className="mt-1 text-muted-foreground">
          외부 서비스와의 연동을 설정합니다
        </p>
      </div>

      <div className="space-y-6">
        {/* 카카오 오픈빌더 카드 */}
        <Card size="md">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageCircle className="h-5 w-5 text-muted-foreground" />
                <CardTitle>카카오 오픈빌더</CardTitle>
              </div>
              <Button
                variant={kakaoEnabled ? 'default' : 'outline'}
                size="sm"
                onClick={() => setKakaoEnabled(!kakaoEnabled)}
              >
                {kakaoEnabled ? '활성화됨' : '비활성화됨'}
              </Button>
            </div>
            <CardDescription>
              카카오톡 채널과 연동하여 카카오톡에서 챗봇을 사용할 수 있습니다
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Bot ID */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">
                Bot ID
              </label>
              <input
                type="text"
                value={kakaoBotId}
                onChange={(e) => setKakaoBotId(e.target.value)}
                placeholder="카카오 오픈빌더에서 발급받은 Bot ID"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
                disabled={!kakaoEnabled}
              />
            </div>

            {/* 스킬 서버 URL */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">
                스킬 서버 URL
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={skillServerUrl}
                  readOnly
                  className="flex-1 rounded-lg border border-border bg-muted px-3 py-2 text-sm text-muted-foreground"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleCopy(skillServerUrl, 'skillUrl')}
                  disabled={!currentChatbot?.id}
                >
                  {copiedField === 'skillUrl' ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                이 URL을 카카오 오픈빌더 스킬 설정에 등록하세요
              </p>
            </div>

            {/* 폴백 메시지 */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">
                폴백 메시지
              </label>
              <textarea
                rows={2}
                value={kakaoConfig.fallbackMessage ?? ''}
                onChange={(e) =>
                  setKakaoConfig((prev) => ({
                    ...prev,
                    fallbackMessage: e.target.value,
                  }))
                }
                placeholder="응답을 생성할 수 없을 때 표시할 메시지"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
                disabled={!kakaoEnabled}
              />
            </div>

            {/* 카카오 오픈빌더 가이드 링크 */}
            <a
              href="https://i.kakao.com/openbuilder"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
            >
              카카오 오픈빌더 바로가기
              <ExternalLink className="h-3 w-3" />
            </a>
          </CardContent>
        </Card>

        {/* 위젯 임베드 카드 */}
        <Card size="md">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Code className="h-5 w-5 text-muted-foreground" />
                <CardTitle>위젯 임베드</CardTitle>
              </div>
              <Button
                variant={widgetEnabled ? 'default' : 'outline'}
                size="sm"
                onClick={() => setWidgetEnabled(!widgetEnabled)}
              >
                {widgetEnabled ? '활성화됨' : '비활성화됨'}
              </Button>
            </div>
            <CardDescription>
              웹사이트에 챗봇 위젯을 삽입하여 방문자와 대화할 수 있습니다
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* 임베드 코드 */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">
                임베드 코드
              </label>
              <div className="relative">
                <pre className="overflow-x-auto rounded-lg border border-border bg-muted p-3 text-sm">
                  <code className="text-muted-foreground">{widgetEmbedCode}</code>
                </pre>
                <Button
                  variant="outline"
                  size="sm"
                  className="absolute right-2 top-2"
                  onClick={() => handleCopy(widgetEmbedCode, 'embedCode')}
                  disabled={!currentChatbot?.id || !widgetEnabled}
                >
                  {copiedField === 'embedCode' ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                이 코드를 웹사이트의 {'<body>'} 태그 끝에 추가하세요
              </p>
            </div>

            {/* API 키 */}
            {widgetApiKey && (
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">
                  API 키
                </label>
                <div className="flex gap-2">
                  <input
                    type="password"
                    value={widgetApiKey}
                    readOnly
                    className="flex-1 rounded-lg border border-border bg-muted px-3 py-2 font-mono text-sm text-muted-foreground"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleCopy(widgetApiKey, 'apiKey')}
                  >
                    {copiedField === 'apiKey' ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  API 직접 호출 시 사용하는 인증 키입니다
                </p>
              </div>
            )}

            {/* 위젯 커스터마이징 링크 */}
            <p className="text-sm text-muted-foreground">
              위젯의 디자인을 변경하려면{' '}
              <a
                href="/console/appearance/widget"
                className="text-primary hover:underline"
              >
                디자인 → 위젯
              </a>{' '}
              메뉴에서 설정하세요.
            </p>
          </CardContent>
        </Card>

        {/* 저장 버튼 */}
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            설정 저장
          </Button>
        </div>
      </div>
    </div>
  );
}
