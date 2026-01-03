'use client';

/**
 * 챗봇 - 연동 설정 페이지
 *
 * 카카오 오픈빌더 등 외부 채널 연동을 관리하는 페이지
 * 챗봇이 응답할 외부 채널을 설정합니다
 */

import { useState, useEffect, useCallback } from 'react';
import { useCurrentChatbot } from '../../hooks/use-console-state';
import { Loader2 } from 'lucide-react';
import { KakaoSettingsCard, type KakaoData } from './components/kakao-settings-card';

export default function ChatbotIntegrationsPage() {
  const { currentChatbot } = useCurrentChatbot();
  const [isLoading, setIsLoading] = useState(true);

  // 카카오 데이터
  const [kakaoData, setKakaoData] = useState<KakaoData | null>(null);

  // 데이터 로드 함수
  const fetchData = useCallback(async () => {
    if (!currentChatbot?.id) return;

    setIsLoading(true);
    try {
      const kakaoResponse = await fetch(`/api/chatbots/${currentChatbot.id}/kakao`);

      if (kakaoResponse.ok) {
        const kakaoJson = await kakaoResponse.json();
        setKakaoData({
          enabled: kakaoJson.kakao.enabled ?? false,
          botId: kakaoJson.kakao.botId ?? null,
          config: kakaoJson.kakao.config ?? {},
          skillUrl: kakaoJson.kakao.skillUrl ?? '',
          hasDatasets: kakaoJson.kakao.hasDatasets ?? false,
        });
      }
    } catch (error) {
      console.error('연동 데이터 로드 오류:', error);
    } finally {
      setIsLoading(false);
    }
  }, [currentChatbot?.id]);

  // 챗봇 변경 시 데이터 로드
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // 로딩 상태
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
          외부 채널에서 챗봇이 응답하도록 연동합니다
        </p>
      </div>

      <div className="space-y-6">
        {/* 카카오 오픈빌더 카드 */}
        {currentChatbot?.id && kakaoData && (
          <KakaoSettingsCard
            chatbotId={currentChatbot.id}
            initialData={kakaoData}
            onSaveSuccess={fetchData}
          />
        )}
      </div>
    </div>
  );
}
