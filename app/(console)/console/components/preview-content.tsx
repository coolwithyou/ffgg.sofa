'use client';

import { useCurrentChatbot, usePageConfig } from '../hooks/use-console-state';
import { PublicPageView } from '@/app/[slug]/public-page-view';

/**
 * 프리뷰 콘텐츠
 *
 * 기존 PublicPageView를 Context의 상태와 연결하여
 * 실시간 변경사항이 반영되도록 합니다.
 */
export function PreviewContent() {
  const { currentChatbot } = useCurrentChatbot();
  const { pageConfig } = usePageConfig();

  if (!currentChatbot) {
    return (
      <div className="flex h-full items-center justify-center bg-muted">
        <p className="text-sm text-muted-foreground">챗봇을 선택해주세요</p>
      </div>
    );
  }

  // PublicPageView에 필요한 props 구성
  // config는 Context의 실시간 상태를 사용
  return (
    <PublicPageView
      chatbotId={currentChatbot.id}
      chatbotName={currentChatbot.name}
      tenantId={currentChatbot.tenantId}
      config={pageConfig}
      widgetConfig={null} // 위젯 설정은 별도 관리
    />
  );
}
