/**
 * 카카오 연동 설정 컴포넌트
 */

'use client';

import { useState, useEffect } from 'react';
import {
  MessageCircle,
  Copy,
  Check,
  AlertCircle,
  ExternalLink,
  Settings,
} from 'lucide-react';
import { toast } from 'sonner';

interface KakaoData {
  enabled: boolean;
  botId: string | null;
  config: {
    skillUrl?: string;
    skillTimeout?: number;
    useQuickReplies?: boolean;
    maxButtons?: number;
    fallbackMessage?: string;
  };
  hasDatasets: boolean;
  skillUrl: string;
  webhookInfo: {
    url: string;
    method: string;
    headers: Record<string, string>;
  } | null;
}

interface KakaoSettingsProps {
  chatbotId: string;
  hasDatasets: boolean;
  onUpdate: () => void;
}

export function KakaoSettings({
  chatbotId,
  hasDatasets,
  onUpdate,
}: KakaoSettingsProps) {
  const [kakao, setKakao] = useState<KakaoData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isToggling, setIsToggling] = useState(false);
  const [isSavingBotId, setIsSavingBotId] = useState(false);
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [copied, setCopied] = useState(false);

  // 설정 폼 상태
  const [botId, setBotId] = useState('');
  const [fallbackMessage, setFallbackMessage] = useState('');
  const [useQuickReplies, setUseQuickReplies] = useState(true);

  useEffect(() => {
    fetchKakao();
  }, [chatbotId]);

  const fetchKakao = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/chatbots/${chatbotId}/kakao`);
      if (response.ok) {
        const data = await response.json();
        setKakao(data.kakao);
        // 설정 값 초기화
        setBotId(data.kakao.botId || '');
        if (data.kakao.config) {
          setFallbackMessage(data.kakao.config.fallbackMessage || '');
          setUseQuickReplies(data.kakao.config.useQuickReplies ?? true);
        }
      }
    } catch (err) {
      console.error('Failed to fetch kakao:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggle = async () => {
    if (!kakao) return;

    // 활성화 시 봇 ID 필요
    if (!kakao.enabled && !botId) {
      warning('입력 필요', '카카오 봇 ID를 입력해주세요.');
      return;
    }

    setIsToggling(true);
    try {
      const response = await fetch(`/api/chatbots/${chatbotId}/kakao`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled: !kakao.enabled,
          botId: botId || undefined,
        }),
      });

      if (response.ok) {
        await fetchKakao();
        onUpdate();
      } else {
        const data = await response.json();
        showError('카카오 설정 오류', data.error || '오류가 발생했습니다.');
      }
    } catch (err) {
      console.error('Toggle error:', err);
    } finally {
      setIsToggling(false);
    }
  };

  // 봇 ID 저장 (비활성화 상태에서도 가능)
  const handleSaveBotId = async () => {
    if (!botId.trim()) {
      warning('입력 필요', '카카오 봇 ID를 입력해주세요.');
      return;
    }

    setIsSavingBotId(true);
    try {
      const response = await fetch(`/api/chatbots/${chatbotId}/kakao`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ botId }),
      });

      if (response.ok) {
        await fetchKakao();
        success('저장 완료', '카카오 봇 ID가 저장되었습니다.');
      } else {
        const data = await response.json();
        showError('저장 오류', data.error || '오류가 발생했습니다.');
      }
    } catch (err) {
      console.error('Save botId error:', err);
    } finally {
      setIsSavingBotId(false);
    }
  };

  // 고급 설정 저장
  const handleSaveConfig = async () => {
    setIsSavingConfig(true);
    try {
      const response = await fetch(`/api/chatbots/${chatbotId}/kakao`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fallbackMessage: fallbackMessage || undefined,
          useQuickReplies,
        }),
      });

      if (response.ok) {
        await fetchKakao();
        success('저장 완료', '고급 설정이 저장되었습니다.');
      }
    } catch (err) {
      console.error('Save config error:', err);
    } finally {
      setIsSavingConfig(false);
    }
  };

  const handleCopyUrl = async () => {
    if (!kakao?.skillUrl) return;

    try {
      await navigator.clipboard.writeText(kakao.skillUrl);
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

  if (!kakao) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center">
        <AlertCircle className="mx-auto h-12 w-12 text-muted-foreground" />
        <p className="mt-4 text-muted-foreground">
          카카오 정보를 불러올 수 없습니다.
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
              kakao.enabled ? 'bg-yellow-500/10' : 'bg-muted'
            }`}
          >
            <MessageCircle
              className={`h-6 w-6 ${
                kakao.enabled ? 'text-yellow-500' : 'text-muted-foreground'
              }`}
            />
          </div>
          <div>
            <h3 className="font-medium text-foreground">카카오톡 챗봇</h3>
            <p className="text-sm text-muted-foreground">
              {kakao.enabled
                ? '카카오 연동이 활성화되어 있습니다'
                : '카카오 연동이 비활성화되어 있습니다'}
            </p>
          </div>
        </div>
        <button
          onClick={handleToggle}
          disabled={isToggling || (!kakao.enabled && !hasDatasets)}
          className={`rounded-md px-4 py-2 text-sm font-medium ${
            kakao.enabled
              ? 'border border-border text-foreground hover:bg-muted'
              : 'bg-yellow-500 text-white hover:bg-yellow-600'
          } disabled:cursor-not-allowed disabled:opacity-50`}
        >
          {isToggling ? (
            <span className="flex items-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              처리 중...
            </span>
          ) : kakao.enabled ? (
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
              카카오를 연동하려면 먼저 데이터셋을 연결해주세요.
            </p>
          </div>
        </div>
      )}

      {/* 봇 ID 입력 */}
      <div className="rounded-lg border border-border bg-card p-4">
        <h3 className="mb-3 font-medium text-foreground">카카오 봇 설정</h3>
        <div className="space-y-3">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">
              카카오 봇 ID <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              value={botId}
              onChange={(e) => setBotId(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="카카오 i 오픈빌더에서 발급받은 봇 ID"
              disabled={kakao.enabled}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              카카오 i 오픈빌더 &gt; 설정 &gt; 기본 정보에서 확인할 수 있습니다.
            </p>
          </div>
          {/* 비활성화 상태에서만 봇 ID 저장 버튼 표시 */}
          {!kakao.enabled && (
            <button
              onClick={handleSaveBotId}
              disabled={isSavingBotId || !botId.trim() || botId === kakao.botId}
              className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSavingBotId ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                  저장 중...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  봇 ID 저장
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* 스킬 서버 URL */}
      {kakao.enabled && kakao.skillUrl && (
        <div className="rounded-lg border border-border bg-card p-4">
          <h3 className="mb-3 font-medium text-foreground">스킬 서버 설정</h3>
          <p className="mb-3 text-sm text-muted-foreground">
            아래 URL을 카카오 i 오픈빌더의 스킬 서버 URL로 등록하세요.
          </p>
          <div className="relative">
            <div className="flex items-center gap-2 rounded-md bg-muted p-3">
              <code className="flex-1 text-sm text-foreground">
                {kakao.skillUrl}
              </code>
              <button
                onClick={handleCopyUrl}
                className="rounded-md p-2 text-muted-foreground hover:text-foreground"
              >
                {copied ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>
          <a
            href="https://i.kakao.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex items-center gap-1 text-sm text-primary hover:underline"
          >
            카카오 i 오픈빌더 바로가기
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      )}

      {/* 고급 설정 */}
      <div className="rounded-lg border border-border bg-card p-4">
        <h3 className="mb-4 flex items-center gap-2 font-medium text-foreground">
          <Settings className="h-5 w-5" />
          고급 설정
        </h3>
        <div className="space-y-4">
          {/* 빠른 응답 사용 */}
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium text-foreground">
                빠른 응답 버튼 사용
              </label>
              <p className="text-xs text-muted-foreground">
                자주 묻는 질문을 빠른 응답 버튼으로 표시합니다.
              </p>
            </div>
            <button
              onClick={() => setUseQuickReplies(!useQuickReplies)}
              className={`relative h-6 w-11 rounded-full transition-colors ${
                useQuickReplies ? 'bg-primary' : 'bg-muted'
              }`}
            >
              <span
                className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                  useQuickReplies ? 'translate-x-5' : ''
                }`}
              />
            </button>
          </div>

          {/* 폴백 메시지 */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">
              폴백 메시지
            </label>
            <textarea
              value={fallbackMessage}
              onChange={(e) => setFallbackMessage(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="답변을 찾지 못했을 때 표시할 메시지"
              rows={2}
              maxLength={500}
            />
          </div>

          <button
            onClick={handleSaveConfig}
            disabled={isSavingConfig}
            className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {isSavingConfig ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                저장 중...
              </>
            ) : (
              <>
                <Check className="h-4 w-4" />
                고급 설정 저장
              </>
            )}
          </button>
        </div>
      </div>

      {/* 연동 가이드 */}
      <div className="rounded-lg bg-muted/50 p-4">
        <h4 className="text-sm font-medium text-foreground">카카오 연동 가이드</h4>
        <ol className="mt-2 list-inside list-decimal space-y-1 text-sm text-muted-foreground">
          <li>카카오 i 오픈빌더에서 봇을 생성합니다.</li>
          <li>봇 ID를 복사하여 위에 입력합니다.</li>
          <li>카카오 연동을 활성화합니다.</li>
          <li>스킬 서버 URL을 오픈빌더에 등록합니다.</li>
          <li>시나리오에서 스킬을 연결합니다.</li>
        </ol>
      </div>
    </div>
  );
}
