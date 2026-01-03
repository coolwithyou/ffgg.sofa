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
// Phase 1 블록
import { LinkBlock } from './link-block';
import { TextBlock } from './text-block';
import { DividerBlock } from './divider-block';
import { SocialIconsBlock } from './social-icons-block';
import {
  BlockType,
  type Block,
  type LinkBlock as LinkBlockType,
  type TextBlock as TextBlockType,
  type DividerBlock as DividerBlockType,
  type SocialIconsBlock as SocialIconsBlockType,
} from '@/lib/public-page/block-types';
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

    // Phase 1 블록
    case BlockType.LINK: {
      const linkBlock = block as LinkBlockType;
      return (
        <LinkBlock
          url={linkBlock.config.url}
          title={linkBlock.config.title}
          description={linkBlock.config.description}
          thumbnail={linkBlock.config.thumbnail}
          style={linkBlock.config.style}
          openInNewTab={linkBlock.config.openInNewTab}
          primaryColor={theme.primaryColor}
        />
      );
    }

    case BlockType.TEXT: {
      const textBlock = block as TextBlockType;
      return (
        <TextBlock
          content={textBlock.config.content}
          align={textBlock.config.align}
          size={textBlock.config.size}
        />
      );
    }

    case BlockType.DIVIDER: {
      const dividerBlock = block as DividerBlockType;
      return (
        <DividerBlock
          style={dividerBlock.config.style}
          spacing={dividerBlock.config.spacing}
        />
      );
    }

    case BlockType.SOCIAL_ICONS: {
      const socialIconsBlock = block as SocialIconsBlockType;
      return (
        <SocialIconsBlock
          icons={socialIconsBlock.config.icons}
          size={socialIconsBlock.config.size}
          style={socialIconsBlock.config.style}
          primaryColor={theme.primaryColor}
        />
      );
    }

    default:
      // 알 수 없는 블록 타입
      return (
        <div className="rounded-lg border border-dashed border-amber-500/50 bg-amber-500/10 p-4 text-center text-sm text-amber-600">
          알 수 없는 블록 타입: {(block as Block).type}
        </div>
      );
  }
}
