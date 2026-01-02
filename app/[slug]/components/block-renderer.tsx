'use client';

/**
 * 블록 렌더러
 *
 * 블록 타입에 따라 적절한 컴포넌트를 렌더링합니다.
 * - 보기 모드: 실제 UI만 표시
 * - 편집 모드: EditableBlockWrapper로 감싸서 드래그/삭제 지원
 */

import { HeaderBlock } from './header-block';
import { ChatbotBlock } from './chatbot-block';
import { PlaceholderBlock } from './placeholder-block';
import { BlockType, type Block } from '@/lib/public-page/block-types';
import type { PublicPageConfig } from '@/lib/public-page/types';

interface BlockRendererProps {
  block: Block;
  config: PublicPageConfig;
  chatbotId: string;
  tenantId: string;
  chatbotName: string;
  welcomeMessage: string;
  placeholder: string;
  /** 편집 모드 여부 (숨김 블록도 렌더링) */
  isEditing?: boolean;
}

/**
 * 블록 타입별 렌더링
 */
export function BlockRenderer({
  block,
  config,
  chatbotId,
  tenantId,
  chatbotName,
  welcomeMessage,
  placeholder,
  isEditing = false,
}: BlockRendererProps) {
  // 보기 모드에서 숨김 상태인 블록은 렌더링하지 않음
  // 편집 모드에서는 EditableBlockWrapper가 opacity 처리
  if (!block.visible && !isEditing) {
    return null;
  }

  const { header, theme, chatbot } = config;

  switch (block.type) {
    case BlockType.HEADER:
      return (
        <HeaderBlock
          title={header.title || chatbotName}
          description={header.description}
          logoUrl={header.logoUrl}
          showBrandName={header.showBrandName}
          primaryColor={theme.primaryColor}
        />
      );

    case BlockType.CHATBOT:
      return (
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
      );

    case BlockType.PLACEHOLDER:
      return <PlaceholderBlock />;

    default:
      // 알 수 없는 블록 타입
      return (
        <div className="rounded-lg border border-dashed border-amber-500/50 bg-amber-500/10 p-4 text-center text-sm text-amber-600">
          알 수 없는 블록 타입: {(block as Block).type}
        </div>
      );
  }
}
