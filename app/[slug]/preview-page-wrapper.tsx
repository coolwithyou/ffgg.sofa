'use client';

/**
 * 미리보기 페이지 래퍼
 *
 * preview=true 파라미터가 있을 때:
 * - localStorage에서 편집 중인 설정을 조회
 * - 있으면 해당 설정으로 PublicPageView 렌더링 + 상단 배너
 * - 없거나 만료되었으면 발행된 버전으로 폴백
 */

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import type { PublicPageConfig } from '@/lib/public-page/types';
import { getPreviewData } from '@/lib/public-page/preview-storage';
import { getBackgroundStyles } from '@/lib/public-page/background-utils';
import { PublicPageView } from './public-page-view';
import { PreviewBanner } from './components/preview-banner';

interface PreviewPageWrapperProps {
  chatbotId: string;
  chatbotName: string;
  tenantId: string;
  /** 발행된 설정 (폴백용) */
  publishedConfig: PublicPageConfig;
  widgetConfig: Record<string, unknown> | null;
}

export function PreviewPageWrapper({
  chatbotId,
  chatbotName,
  tenantId,
  publishedConfig,
  widgetConfig,
}: PreviewPageWrapperProps) {
  const searchParams = useSearchParams();
  const isPreviewMode = searchParams.get('preview') === 'true';

  const [previewConfig, setPreviewConfig] = useState<PublicPageConfig | null>(
    null
  );
  const [previewChatbotName, setPreviewChatbotName] = useState<string | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(isPreviewMode);

  useEffect(() => {
    if (!isPreviewMode) {
      setIsLoading(false);
      return;
    }

    // localStorage에서 미리보기 데이터 조회
    const data = getPreviewData(chatbotId);
    if (data) {
      setPreviewConfig(data.config);
      setPreviewChatbotName(data.chatbotName);
    }
    setIsLoading(false);
  }, [chatbotId, isPreviewMode]);

  // 로딩 중
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  // 미리보기 모드 + 데이터 있음
  const isActivePreview = isPreviewMode && previewConfig;
  const config = isActivePreview ? previewConfig : publishedConfig;
  const displayName = isActivePreview
    ? previewChatbotName || chatbotName
    : chatbotName;

  // 미리보기 모드가 아니면 PublicPageView만 렌더링
  if (!isActivePreview) {
    return (
      <PublicPageView
        chatbotId={chatbotId}
        chatbotName={displayName}
        tenantId={tenantId}
        config={config}
        widgetConfig={widgetConfig}
      />
    );
  }

  // 미리보기 모드: 배너 + 콘텐츠를 배경이 적용된 컨테이너로 감싸기
  const { theme } = config;

  // 배경 스타일 (backgroundType에 따라 단색/이미지/그라데이션)
  const backgroundStyles = getBackgroundStyles(theme);

  return (
    <div
      className="flex min-h-screen flex-col"
      style={backgroundStyles}
    >
      {/* 미리보기 배너 */}
      <PreviewBanner />

      {/* 페이지 콘텐츠 - flex-1로 나머지 공간 채우기 */}
      <div className="flex-1">
        <PublicPageView
          chatbotId={chatbotId}
          chatbotName={displayName}
          tenantId={tenantId}
          config={config}
          widgetConfig={widgetConfig}
          /** 미리보기 래퍼가 min-h-screen을 처리하므로 내부에서는 불필요 */
          disableMinHeight
        />
      </div>
    </div>
  );
}
