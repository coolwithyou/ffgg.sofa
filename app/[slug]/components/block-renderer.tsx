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
// Phase 2 블록
import { ImageBlock } from './image-block';
import { ImageCarouselBlock } from './image-carousel-block';
import { VideoBlock } from './video-block';
import { FaqAccordionBlock } from './faq-accordion-block';
import { ContactFormBlock } from './contact-form-block';
import { MapBlock } from './map-block';
// Phase 3 블록 (SOFA 차별화)
import { AiChatPreviewBlock } from './ai-chat-preview-block';
import { KnowledgeBaseLinkBlock } from './knowledge-base-link-block';
import { FaqQuickActionsBlock } from './faq-quick-actions-block';
import { ConversationStarterBlock } from './conversation-starter-block';
import { OperatingHoursBlock } from './operating-hours-block';
import {
  BlockType,
  type Block,
  type HeaderBlock as HeaderBlockType,
  type LinkBlock as LinkBlockType,
  type TextBlock as TextBlockType,
  type DividerBlock as DividerBlockType,
  type SocialIconsBlock as SocialIconsBlockType,
  // Phase 2 블록 타입
  type ImageBlock as ImageBlockType,
  type ImageCarouselBlock as ImageCarouselBlockType,
  type VideoBlock as VideoBlockType,
  type FaqAccordionBlock as FaqAccordionBlockType,
  type ContactFormBlock as ContactFormBlockType,
  type MapBlock as MapBlockType,
  // Phase 3 블록 타입 (SOFA 차별화)
  type AiChatPreviewBlock as AiChatPreviewBlockType,
  type KnowledgeBaseLinkBlock as KnowledgeBaseLinkBlockType,
  type FaqQuickActionsBlock as FaqQuickActionsBlockType,
  type ConversationStarterBlock as ConversationStarterBlockType,
  type OperatingHoursBlock as OperatingHoursBlockType,
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
    case BlockType.HEADER: {
      const headerBlock = block as HeaderBlockType;
      // 블록 config 사용, title 없으면 chatbotName 폴백
      const headerConfig = {
        ...headerBlock.config,
        title: headerBlock.config.title || chatbotName,
      };
      return <HeaderBlock config={headerConfig} theme={theme} />;
    }

    case BlockType.CHATBOT: {
      const chatbotBlock = block as import('@/lib/public-page/block-types').ChatbotBlock;
      return (
        <ChatbotBlock
          chatbotId={chatbotId}
          tenantId={tenantId}
          welcomeMessage={welcomeMessage}
          placeholder={chatbotBlock.config.inputPlaceholder || placeholder}
          primaryColor={theme.primaryColor}
          textColor={theme.textColor}
          minHeight={chatbotBlock.config.minHeight || chatbot.minHeight}
          maxHeight={chatbotBlock.config.maxHeight || chatbot.maxHeight}
          isEditing={isEditing}
          // 컨테이너 스타일
          borderColor={chatbotBlock.config.borderColor}
          backgroundColor={chatbotBlock.config.backgroundColor}
          // 입력 필드 스타일
          inputBackgroundColor={chatbotBlock.config.inputBackgroundColor}
          inputTextColor={chatbotBlock.config.inputTextColor}
          // 버튼 스타일
          buttonBackgroundColor={chatbotBlock.config.buttonBackgroundColor}
          buttonTextColor={chatbotBlock.config.buttonTextColor}
          // 사용자 메시지 스타일
          userMessageBackgroundColor={chatbotBlock.config.userMessageBackgroundColor}
          userMessageTextColor={chatbotBlock.config.userMessageTextColor}
          // AI 응답 스타일
          assistantMessageBackgroundColor={chatbotBlock.config.assistantMessageBackgroundColor}
          assistantMessageTextColor={chatbotBlock.config.assistantMessageTextColor}
        />
      );
    }

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

    // Phase 2 블록
    case BlockType.IMAGE: {
      const imageBlock = block as ImageBlockType;
      return (
        <ImageBlock
          src={imageBlock.config.src}
          alt={imageBlock.config.alt}
          caption={imageBlock.config.caption}
          aspectRatio={imageBlock.config.aspectRatio}
          linkUrl={imageBlock.config.linkUrl}
        />
      );
    }

    case BlockType.IMAGE_CAROUSEL: {
      const carouselBlock = block as ImageCarouselBlockType;
      return (
        <ImageCarouselBlock
          images={carouselBlock.config.images}
          autoPlay={carouselBlock.config.autoPlay}
          interval={carouselBlock.config.interval}
          showDots={carouselBlock.config.showDots}
          showArrows={carouselBlock.config.showArrows}
        />
      );
    }

    case BlockType.VIDEO: {
      const videoBlock = block as VideoBlockType;
      return (
        <VideoBlock
          provider={videoBlock.config.provider}
          videoId={videoBlock.config.videoId}
          autoPlay={videoBlock.config.autoPlay}
          showControls={videoBlock.config.showControls}
        />
      );
    }

    case BlockType.FAQ_ACCORDION: {
      const faqBlock = block as FaqAccordionBlockType;
      return (
        <FaqAccordionBlock
          items={faqBlock.config.items}
          allowMultiple={faqBlock.config.allowMultiple}
          defaultOpen={faqBlock.config.defaultOpen}
        />
      );
    }

    case BlockType.CONTACT_FORM: {
      const formBlock = block as ContactFormBlockType;
      return (
        <ContactFormBlock
          fields={formBlock.config.fields}
          submitText={formBlock.config.submitText}
          successMessage={formBlock.config.successMessage}
        />
      );
    }

    case BlockType.MAP: {
      const mapBlock = block as MapBlockType;
      return (
        <MapBlock
          provider={mapBlock.config.provider}
          address={mapBlock.config.address}
          lat={mapBlock.config.lat}
          lng={mapBlock.config.lng}
          zoom={mapBlock.config.zoom}
          displayType={mapBlock.config.displayType}
          height={mapBlock.config.height}
          placeName={mapBlock.config.placeName}
        />
      );
    }

    // Phase 3 블록 (SOFA 차별화)
    case BlockType.AI_CHAT_PREVIEW: {
      const aiChatBlock = block as AiChatPreviewBlockType;
      return (
        <AiChatPreviewBlock
          conversations={aiChatBlock.config.conversations}
          showTypingAnimation={aiChatBlock.config.showTypingAnimation}
        />
      );
    }

    case BlockType.KNOWLEDGE_BASE_LINK: {
      const kbLinkBlock = block as KnowledgeBaseLinkBlockType;
      return (
        <KnowledgeBaseLinkBlock
          documentId={kbLinkBlock.config.documentId}
          title={kbLinkBlock.config.title}
          showPreview={kbLinkBlock.config.showPreview}
        />
      );
    }

    case BlockType.FAQ_QUICK_ACTIONS: {
      const faqQuickBlock = block as FaqQuickActionsBlockType;
      return (
        <FaqQuickActionsBlock
          questions={faqQuickBlock.config.questions}
          layout={faqQuickBlock.config.layout}
        />
      );
    }

    case BlockType.CONVERSATION_STARTER: {
      const starterBlock = block as ConversationStarterBlockType;
      return (
        <ConversationStarterBlock
          prompts={starterBlock.config.prompts}
          randomize={starterBlock.config.randomize}
          style={starterBlock.config.style}
        />
      );
    }

    case BlockType.OPERATING_HOURS: {
      const hoursBlock = block as OperatingHoursBlockType;
      return (
        <OperatingHoursBlock
          schedule={hoursBlock.config.schedule}
          timezone={hoursBlock.config.timezone}
          showCurrentStatus={hoursBlock.config.showCurrentStatus}
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
