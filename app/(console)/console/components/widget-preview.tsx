'use client';

import { useState } from 'react';
import { MessageCircle, HelpCircle, Headphones, X, Send } from 'lucide-react';
import { useWidgetConfig, useCurrentChatbot } from '../hooks/use-console-state';
import type { WidgetConfig } from '@/lib/widget/types';

/**
 * 위젯 프리뷰 컴포넌트
 *
 * 심플 목업 사이트 배경 위에 채팅 위젯을 렌더링
 * - 채팅창 기본 열린 상태
 * - 위치 설정에 따른 배치
 * - 테마 실시간 반영
 */
export function WidgetPreview() {
  const { widgetConfig } = useWidgetConfig();
  const { currentChatbot } = useCurrentChatbot();
  const [isOpen, setIsOpen] = useState(true);

  const toggleChat = () => setIsOpen((prev) => !prev);

  return (
    <div className="flex flex-1 items-center justify-center bg-muted/30 p-8">
      {/* 심플 목업 사이트 컨테이너 */}
      <div className="relative h-[600px] w-full max-w-[800px] overflow-hidden rounded-lg border border-border bg-card shadow-lg">
        {/* 목업 사이트 헤더 */}
        <MockSiteHeader />

        {/* 목업 사이트 콘텐츠 */}
        <MockSiteContent />

        {/* 위젯 오버레이 */}
        <WidgetOverlay
          config={widgetConfig}
          isOpen={isOpen}
          onToggle={toggleChat}
          chatbotName={currentChatbot?.name ?? '챗봇'}
        />
      </div>
    </div>
  );
}

/**
 * 목업 사이트 헤더
 */
function MockSiteHeader() {
  return (
    <div className="flex h-12 items-center justify-between border-b border-border bg-muted/50 px-4">
      <div className="flex items-center gap-3">
        <div className="h-6 w-6 rounded bg-muted" />
        <div className="h-3 w-20 rounded bg-muted" />
      </div>
      <div className="flex items-center gap-4">
        <div className="h-3 w-12 rounded bg-muted" />
        <div className="h-3 w-12 rounded bg-muted" />
        <div className="h-3 w-12 rounded bg-muted" />
      </div>
    </div>
  );
}

/**
 * 목업 사이트 콘텐츠
 */
function MockSiteContent() {
  return (
    <div className="flex h-[calc(100%-48px)] flex-col gap-6 p-6">
      {/* Hero 섹션 */}
      <div className="flex flex-col gap-3">
        <div className="h-6 w-3/4 rounded bg-muted" />
        <div className="h-4 w-1/2 rounded bg-muted/70" />
      </div>

      {/* 컨텐츠 블록들 */}
      <div className="grid grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="flex flex-col gap-2 rounded-lg border border-border bg-muted/30 p-4"
          >
            <div className="h-20 rounded bg-muted" />
            <div className="h-3 w-3/4 rounded bg-muted/70" />
            <div className="h-3 w-1/2 rounded bg-muted/50" />
          </div>
        ))}
      </div>

      {/* 추가 텍스트 블록 */}
      <div className="flex flex-col gap-2">
        <div className="h-3 w-full rounded bg-muted/50" />
        <div className="h-3 w-5/6 rounded bg-muted/50" />
        <div className="h-3 w-4/6 rounded bg-muted/50" />
      </div>
    </div>
  );
}

/**
 * 위젯 오버레이
 */
interface WidgetOverlayProps {
  config: WidgetConfig;
  isOpen: boolean;
  onToggle: () => void;
  chatbotName: string;
}

function WidgetOverlay({
  config,
  isOpen,
  onToggle,
  chatbotName,
}: WidgetOverlayProps) {
  const { theme, position, title, subtitle, welcomeMessage, placeholder, buttonIcon } =
    config;

  // 위치 스타일
  const positionStyles: Record<typeof position, string> = {
    'bottom-right': 'bottom-4 right-4',
    'bottom-left': 'bottom-4 left-4',
    'top-right': 'top-16 right-4',
    'top-left': 'top-16 left-4',
  };

  // 채팅창 방향 (버튼 기준)
  const chatDirection: Record<typeof position, string> = {
    'bottom-right': 'bottom-full right-0 mb-3',
    'bottom-left': 'bottom-full left-0 mb-3',
    'top-right': 'top-full right-0 mt-3',
    'top-left': 'top-full left-0 mt-3',
  };

  // 버튼 아이콘
  const IconComponent = {
    chat: MessageCircle,
    question: HelpCircle,
    support: Headphones,
  }[buttonIcon ?? 'chat'];

  return (
    <div className={`absolute ${positionStyles[position]} z-10`}>
      {/* 채팅창 */}
      {isOpen && (
        <div
          className={`absolute ${chatDirection[position]} w-[360px] overflow-hidden shadow-xl`}
          style={{
            borderRadius: `${theme.borderRadius ?? 16}px`,
            backgroundColor: theme.backgroundColor,
          }}
        >
          {/* 헤더 */}
          <div
            className="flex items-center justify-between px-4 py-3"
            style={{ backgroundColor: theme.primaryColor }}
          >
            <div>
              <h3
                className="font-semibold"
                style={{ color: '#ffffff' }}
              >
                {title || chatbotName}
              </h3>
              {subtitle && (
                <p
                  className="text-sm opacity-80"
                  style={{ color: '#ffffff' }}
                >
                  {subtitle}
                </p>
              )}
            </div>
            <button
              onClick={onToggle}
              className="rounded-full p-1 transition-colors hover:bg-white/20"
            >
              <X className="h-5 w-5" style={{ color: '#ffffff' }} />
            </button>
          </div>

          {/* 메시지 영역 */}
          <div
            className="flex flex-col gap-3 p-4"
            style={{
              backgroundColor: theme.backgroundColor,
              minHeight: 280,
              fontFamily: theme.fontFamily,
            }}
          >
            {/* 환영 메시지 */}
            {welcomeMessage && (
              <div
                className="max-w-[85%] self-start rounded-lg px-3 py-2 text-sm"
                style={{
                  backgroundColor: `${theme.primaryColor}15`,
                  color: theme.textColor,
                }}
              >
                {welcomeMessage}
              </div>
            )}

            {/* 샘플 대화 */}
            <div
              className="max-w-[85%] self-end rounded-lg px-3 py-2 text-sm"
              style={{
                backgroundColor: theme.primaryColor,
                color: '#ffffff',
              }}
            >
              안녕하세요!
            </div>
            <div
              className="max-w-[85%] self-start rounded-lg px-3 py-2 text-sm"
              style={{
                backgroundColor: `${theme.primaryColor}15`,
                color: theme.textColor,
              }}
            >
              네, 무엇을 도와드릴까요?
            </div>
          </div>

          {/* 입력창 */}
          <div
            className="flex items-center gap-2 border-t px-4 py-3"
            style={{
              backgroundColor: theme.backgroundColor,
              borderColor: `${theme.textColor}20`,
            }}
          >
            <input
              type="text"
              placeholder={placeholder || '메시지를 입력하세요...'}
              className="flex-1 bg-transparent text-sm outline-none"
              style={{
                color: theme.textColor,
                fontFamily: theme.fontFamily,
              }}
              readOnly
            />
            <button
              className="rounded-full p-2 transition-colors"
              style={{ backgroundColor: theme.primaryColor }}
            >
              <Send className="h-4 w-4" style={{ color: '#ffffff' }} />
            </button>
          </div>
        </div>
      )}

      {/* 플로팅 버튼 */}
      <button
        onClick={onToggle}
        className="flex items-center justify-center shadow-lg transition-transform hover:scale-105"
        style={{
          width: `${theme.buttonSize ?? 56}px`,
          height: `${theme.buttonSize ?? 56}px`,
          borderRadius: '50%',
          backgroundColor: theme.primaryColor,
        }}
      >
        {isOpen ? (
          <X className="h-6 w-6" style={{ color: '#ffffff' }} />
        ) : (
          <IconComponent className="h-6 w-6" style={{ color: '#ffffff' }} />
        )}
      </button>
    </div>
  );
}
