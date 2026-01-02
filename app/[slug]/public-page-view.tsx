'use client';

/**
 * 공개 페이지 클라이언트 뷰
 *
 * Linktree 스타일 독립 페이지 레이아웃
 * - 헤더 블록: 타이틀, 설명, 로고
 * - 챗봇 블록: 채팅 인터페이스
 */

import type { PublicPageConfig } from '@/lib/public-page/types';
import { HeaderBlock } from './components/header-block';
import { ChatbotBlock } from './components/chatbot-block';

interface PublicPageViewProps {
  chatbotId: string;
  chatbotName: string;
  tenantId: string;
  config: PublicPageConfig;
  widgetConfig?: Record<string, unknown> | null;
}

export function PublicPageView({
  chatbotId,
  chatbotName,
  tenantId,
  config,
  widgetConfig,
}: PublicPageViewProps) {
  const { header, theme, chatbot } = config;

  // 테마 CSS 변수 설정
  const themeStyles = {
    '--pp-bg-color': theme.backgroundColor,
    '--pp-primary-color': theme.primaryColor,
    '--pp-text-color': theme.textColor,
    '--pp-font-family': theme.fontFamily || 'system-ui, -apple-system, sans-serif',
  } as React.CSSProperties;

  // 헤더 타이틀 (설정값 없으면 챗봇 이름 사용)
  const headerTitle = header.title || chatbotName;

  // 위젯 설정에서 웰컴 메시지와 플레이스홀더 추출
  const welcomeMessage =
    (widgetConfig?.welcomeMessage as string) ||
    `안녕하세요! ${headerTitle}입니다. 무엇을 도와드릴까요?`;
  const placeholder =
    (widgetConfig?.placeholder as string) || '메시지를 입력하세요...';

  return (
    <main
      className="min-h-screen"
      style={{
        ...themeStyles,
        backgroundColor: 'var(--pp-bg-color)',
        color: 'var(--pp-text-color)',
        fontFamily: 'var(--pp-font-family)',
      }}
    >
      <div className="mx-auto max-w-2xl px-4 py-8">
        {/* 헤더 블록 */}
        <HeaderBlock
          title={headerTitle}
          description={header.description}
          logoUrl={header.logoUrl}
          showBrandName={header.showBrandName}
          primaryColor={theme.primaryColor}
        />

        {/* 챗봇 블록 */}
        <ChatbotBlock
          chatbotId={chatbotId}
          tenantId={tenantId}
          welcomeMessage={welcomeMessage}
          placeholder={placeholder}
          primaryColor={theme.primaryColor}
          textColor={theme.textColor}
          minHeight={chatbot.minHeight}
          maxHeight={chatbot.maxHeight}
        />

        {/* 푸터 (브랜드 표시) */}
        {header.showBrandName && (
          <footer className="pt-8 text-center">
            <p className="text-sm opacity-50">Powered by SOFA</p>
          </footer>
        )}
      </div>
    </main>
  );
}
