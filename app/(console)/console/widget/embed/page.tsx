'use client';

/**
 * 위젯 - 임베드 설정 페이지
 *
 * 웹사이트에 위젯을 삽입하기 위한 설정을 관리합니다
 * 위젯 활성화, 스타일 설정, 임베드 코드 제공
 */

import { useState, useEffect, useCallback } from 'react';
import { useCurrentChatbot } from '../../hooks/use-console-state';
import { Loader2 } from 'lucide-react';
import { WidgetSettingsCard, type WidgetData } from './components/widget-settings-card';

export default function WidgetEmbedPage() {
  const { currentChatbot } = useCurrentChatbot();
  const [isLoading, setIsLoading] = useState(true);

  // 위젯 데이터
  const [widgetData, setWidgetData] = useState<WidgetData | null>(null);

  // 데이터 로드 함수
  const fetchData = useCallback(async () => {
    if (!currentChatbot?.id) return;

    setIsLoading(true);
    try {
      const widgetResponse = await fetch(`/api/chatbots/${currentChatbot.id}/widget`);

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
      console.error('위젯 데이터 로드 오류:', error);
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
          위젯 임베드
        </h1>
        <p className="mt-1 text-muted-foreground">
          웹사이트에 챗봇 위젯을 삽입하는 설정을 관리합니다
        </p>
      </div>

      <div className="space-y-6">
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
