'use client';

/**
 * Settings - 연동 설정 페이지
 *
 * 카카오 오픈빌더, 위젯 임베드 등 외부 연동을 관리하는 페이지
 * 각 연동 설정은 전용 API를 통해 저장됨
 */

import { useState, useEffect, useCallback } from 'react';
import { useCurrentChatbot } from '../../hooks/use-console-state';
import { Loader2 } from 'lucide-react';
import { KakaoSettingsCard, type KakaoData } from './components/kakao-settings-card';
import { WidgetSettingsCard, type WidgetData } from './components/widget-settings-card';

export default function IntegrationsSettingsPage() {
  const { currentChatbot } = useCurrentChatbot();
  const [isLoading, setIsLoading] = useState(true);

  // 카카오 데이터
  const [kakaoData, setKakaoData] = useState<KakaoData | null>(null);

  // 위젯 데이터
  const [widgetData, setWidgetData] = useState<WidgetData | null>(null);

  // 데이터 로드 함수
  const fetchData = useCallback(async () => {
    if (!currentChatbot?.id) return;

    setIsLoading(true);
    try {
      // 카카오와 위젯 데이터를 병렬로 조회
      const [kakaoResponse, widgetResponse] = await Promise.all([
        fetch(`/api/chatbots/${currentChatbot.id}/kakao`),
        fetch(`/api/chatbots/${currentChatbot.id}/widget`),
      ]);

      // 카카오 데이터 처리
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

      // 위젯 데이터 처리
      if (widgetResponse.ok) {
        const widgetJson = await widgetResponse.json();
        setWidgetData({
          enabled: widgetJson.widget.enabled ?? false,
          apiKey: widgetJson.widget.apiKey ?? null,
          config: widgetJson.widget.config ?? {},
          embedCode: widgetJson.widget.embedCode ?? null,
          hasDatasets: widgetJson.widget.hasDatasets ?? false,
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
          외부 서비스와의 연동을 설정합니다
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

        {/* 위젯 임베드 카드 */}
        {currentChatbot?.id && widgetData && (
          <WidgetSettingsCard
            chatbotId={currentChatbot.id}
            initialData={widgetData}
            onSaveSuccess={fetchData}
          />
        )}
      </div>
    </div>
  );
}
