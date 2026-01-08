/**
 * 블록 Zod 스키마
 *
 * API 요청 검증 및 런타임 타입 체크를 위한 스키마입니다.
 * discriminatedUnion을 사용하여 type 필드 기준으로 검증합니다.
 */

import { z } from 'zod';
import { BlockType } from './block-types';

/**
 * 블록 타입 열거형 스키마
 */
export const blockTypeSchema = z.enum([
  BlockType.HEADER,
  BlockType.CHATBOT,
  BlockType.PLACEHOLDER,
  // Phase 1 블록
  BlockType.LINK,
  BlockType.TEXT,
  BlockType.DIVIDER,
  BlockType.SOCIAL_ICONS,
  // Phase 2 블록
  BlockType.IMAGE,
  BlockType.IMAGE_CAROUSEL,
  BlockType.VIDEO,
  BlockType.FAQ_ACCORDION,
  BlockType.CONTACT_FORM,
  BlockType.MAP,
  // Phase 3 블록 (SOFA 차별화)
  BlockType.AI_CHAT_PREVIEW,
  BlockType.KNOWLEDGE_BASE_LINK,
  BlockType.FAQ_QUICK_ACTIONS,
  BlockType.CONVERSATION_STARTER,
  BlockType.OPERATING_HOURS,
]);

/**
 * 기본 블록 필드 스키마
 */
const baseBlockFields = {
  id: z.string().min(1),
  order: z.number().int().min(0),
  visible: z.boolean(),
};

/**
 * 헤더 템플릿 타입 스키마
 */
export const headerTemplateSchema = z.enum([
  'profile',
  'floating-glass',
  'minimal-sticky',
  'pill-nav',
]);

/**
 * 프로필 테마 타입 스키마
 */
export const profileThemeSchema = z.enum(['classic', 'solid-color', 'hero-image']);

/**
 * 네비게이션 링크 스키마
 */
export const navLinkSchema = z.object({
  label: z.string(),
  href: z.string(),
});

/**
 * CTA 버튼 스키마
 */
export const ctaButtonSchema = z.object({
  label: z.string(),
  href: z.string(),
  variant: z.enum(['primary', 'secondary', 'ghost']).optional(),
});

/**
 * 헤더 블록 스키마
 */
export const headerBlockSchema = z.object({
  ...baseBlockFields,
  type: z.literal(BlockType.HEADER),
  config: z.object({
    title: z.string(),
    description: z.string(),
    logoUrl: z.string().optional(),
    showBrandName: z.boolean(),
    // 템플릿 및 테마 설정
    template: headerTemplateSchema.optional(),
    profileTheme: profileThemeSchema.optional(),
    // 프로필 배경 설정
    headerBackgroundColor: z.string().optional(),
    heroImageUrl: z.string().optional(),
    heroOverlayOpacity: z.number().min(0).max(100).optional(),
    heroMinHeight: z.string().optional(),
    // 네비게이션 설정 (웹사이트 스타일 템플릿용)
    navLinks: z.array(navLinkSchema).optional(),
    ctaButton: ctaButtonSchema.optional(),
  }),
});

/**
 * 챗봇 블록 스키마
 */
export const chatbotBlockSchema = z.object({
  ...baseBlockFields,
  type: z.literal(BlockType.CHATBOT),
  config: z.object({
    // 크기 설정
    minHeight: z.number().int().min(100).max(1000),
    maxHeight: z.number().int().min(100).max(1500),

    // 컨테이너 스타일 (미설정 시 테마 사용)
    borderColor: z.string().optional(),
    backgroundColor: z.string().optional(),

    // 입력 필드 스타일
    inputBackgroundColor: z.string().optional(),
    inputTextColor: z.string().optional(),
    inputPlaceholder: z.string().optional(),

    // 전송 버튼 스타일
    buttonBackgroundColor: z.string().optional(),
    buttonTextColor: z.string().optional(),

    // 사용자 메시지 버블
    userMessageBackgroundColor: z.string().optional(),
    userMessageTextColor: z.string().optional(),

    // AI 응답 버블
    assistantMessageBackgroundColor: z.string().optional(),
    assistantMessageTextColor: z.string().optional(),
  }),
});

/**
 * 플레이스홀더 블록 스키마
 */
export const placeholderBlockSchema = z.object({
  ...baseBlockFields,
  type: z.literal(BlockType.PLACEHOLDER),
  config: z.object({
    label: z.string(),
  }),
});

// ============================================
// Phase 1 블록 스키마
// ============================================

/**
 * 링크 블록 스타일 스키마
 */
export const linkBlockStyleSchema = z.enum(['default', 'featured', 'outline']);

/**
 * 링크 블록 스키마
 */
export const linkBlockSchema = z.object({
  ...baseBlockFields,
  type: z.literal(BlockType.LINK),
  config: z.object({
    url: z.string(),
    title: z.string(),
    description: z.string().optional(),
    thumbnail: z.string().optional(),
    style: linkBlockStyleSchema,
    openInNewTab: z.boolean(),
  }),
});

/**
 * 텍스트 블록 정렬 스키마
 */
export const textBlockAlignSchema = z.enum(['left', 'center', 'right']);

/**
 * 텍스트 블록 크기 스키마
 */
export const textBlockSizeSchema = z.enum(['sm', 'md', 'lg']);

/**
 * 텍스트 블록 스키마
 */
export const textBlockSchema = z.object({
  ...baseBlockFields,
  type: z.literal(BlockType.TEXT),
  config: z.object({
    content: z.string(),
    align: textBlockAlignSchema,
    size: textBlockSizeSchema,
  }),
});

/**
 * 디바이더 블록 스타일 스키마
 */
export const dividerBlockStyleSchema = z.enum(['line', 'dashed', 'dotted', 'space']);

/**
 * 디바이더 블록 간격 스키마
 */
export const dividerBlockSpacingSchema = z.enum(['sm', 'md', 'lg']);

/**
 * 디바이더 블록 스키마
 */
export const dividerBlockSchema = z.object({
  ...baseBlockFields,
  type: z.literal(BlockType.DIVIDER),
  config: z.object({
    style: dividerBlockStyleSchema,
    spacing: dividerBlockSpacingSchema,
  }),
});

/**
 * 소셜 아이콘 타입 스키마
 */
export const socialIconTypeSchema = z.enum([
  'instagram',
  'twitter',
  'facebook',
  'youtube',
  'tiktok',
  'linkedin',
  'github',
  'website',
]);

/**
 * 소셜 아이콘 아이템 스키마
 */
export const socialIconItemSchema = z.object({
  type: socialIconTypeSchema,
  url: z.string(),
});

/**
 * 소셜 아이콘 블록 크기 스키마
 */
export const socialIconsBlockSizeSchema = z.enum(['sm', 'md', 'lg']);

/**
 * 소셜 아이콘 블록 스타일 스키마
 */
export const socialIconsBlockStyleSchema = z.enum(['default', 'filled', 'outline']);

/**
 * 소셜 아이콘 블록 스키마
 */
export const socialIconsBlockSchema = z.object({
  ...baseBlockFields,
  type: z.literal(BlockType.SOCIAL_ICONS),
  config: z.object({
    icons: z.array(socialIconItemSchema),
    size: socialIconsBlockSizeSchema,
    style: socialIconsBlockStyleSchema,
  }),
});

// ============================================
// Phase 2 블록 스키마
// ============================================

/**
 * 이미지 블록 비율 스키마
 */
export const imageBlockAspectRatioSchema = z.enum(['1:1', '4:3', '16:9', 'auto']);

/**
 * 이미지 블록 스키마
 */
export const imageBlockSchema = z.object({
  ...baseBlockFields,
  type: z.literal(BlockType.IMAGE),
  config: z.object({
    src: z.string(),
    alt: z.string(),
    caption: z.string().optional(),
    aspectRatio: imageBlockAspectRatioSchema,
    linkUrl: z.string().optional(),
  }),
});

/**
 * 캐러셀 이미지 아이템 스키마
 */
export const carouselImageItemSchema = z.object({
  src: z.string(),
  alt: z.string(),
  linkUrl: z.string().optional(),
});

/**
 * 이미지 캐러셀 블록 스키마
 */
export const imageCarouselBlockSchema = z.object({
  ...baseBlockFields,
  type: z.literal(BlockType.IMAGE_CAROUSEL),
  config: z.object({
    images: z.array(carouselImageItemSchema),
    autoPlay: z.boolean(),
    interval: z.number().int().min(1000).max(10000),
    showDots: z.boolean(),
    showArrows: z.boolean(),
  }),
});

/**
 * 비디오 제공자 스키마
 */
export const videoProviderSchema = z.enum(['youtube', 'vimeo']);

/**
 * 비디오 블록 스키마
 */
export const videoBlockSchema = z.object({
  ...baseBlockFields,
  type: z.literal(BlockType.VIDEO),
  config: z.object({
    provider: videoProviderSchema,
    videoId: z.string(),
    autoPlay: z.boolean(),
    showControls: z.boolean(),
  }),
});

/**
 * FAQ 아이템 스키마
 */
export const faqItemSchema = z.object({
  question: z.string(),
  answer: z.string(),
});

/**
 * FAQ 아코디언 블록 스키마
 */
export const faqAccordionBlockSchema = z.object({
  ...baseBlockFields,
  type: z.literal(BlockType.FAQ_ACCORDION),
  config: z.object({
    items: z.array(faqItemSchema),
    allowMultiple: z.boolean(),
    defaultOpen: z.number().int().optional(),
  }),
});

/**
 * 폼 필드 타입 스키마
 */
export const contactFormFieldTypeSchema = z.enum(['text', 'email', 'textarea']);

/**
 * 폼 필드 스키마
 */
export const contactFormFieldSchema = z.object({
  type: contactFormFieldTypeSchema,
  label: z.string(),
  required: z.boolean(),
  placeholder: z.string().optional(),
});

/**
 * 연락처 폼 블록 스키마
 */
export const contactFormBlockSchema = z.object({
  ...baseBlockFields,
  type: z.literal(BlockType.CONTACT_FORM),
  config: z.object({
    fields: z.array(contactFormFieldSchema),
    submitText: z.string(),
    successMessage: z.string(),
  }),
});

/**
 * 지도 제공자 스키마
 */
export const mapProviderSchema = z.enum(['google', 'kakao', 'naver']);

/**
 * 지도 블록 스키마
 */
export const mapBlockSchema = z.object({
  ...baseBlockFields,
  type: z.literal(BlockType.MAP),
  config: z.object({
    provider: mapProviderSchema,
    address: z.string(),
    lat: z.number().optional(),
    lng: z.number().optional(),
    zoom: z.number().int().min(1).max(21),
  }),
});

// ============================================
// Phase 3 블록 스키마 (SOFA 차별화)
// ============================================

/**
 * AI 채팅 역할 스키마
 */
export const aiChatRoleSchema = z.enum(['user', 'assistant']);

/**
 * AI 채팅 메시지 스키마
 */
export const aiChatMessageSchema = z.object({
  role: aiChatRoleSchema,
  content: z.string(),
});

/**
 * AI 채팅 미리보기 블록 스키마
 */
export const aiChatPreviewBlockSchema = z.object({
  ...baseBlockFields,
  type: z.literal(BlockType.AI_CHAT_PREVIEW),
  config: z.object({
    conversations: z.array(aiChatMessageSchema),
    showTypingAnimation: z.boolean(),
  }),
});

/**
 * 지식 베이스 링크 블록 스키마
 */
export const knowledgeBaseLinkBlockSchema = z.object({
  ...baseBlockFields,
  type: z.literal(BlockType.KNOWLEDGE_BASE_LINK),
  config: z.object({
    documentId: z.string(),
    title: z.string().optional(),
    showPreview: z.boolean(),
  }),
});

/**
 * FAQ 빠른 액션 레이아웃 스키마
 */
export const faqQuickActionsLayoutSchema = z.enum(['buttons', 'chips', 'list']);

/**
 * FAQ 빠른 액션 아이템 스키마
 */
export const faqQuickActionItemSchema = z.object({
  text: z.string(),
});

/**
 * FAQ 빠른 액션 블록 스키마
 */
export const faqQuickActionsBlockSchema = z.object({
  ...baseBlockFields,
  type: z.literal(BlockType.FAQ_QUICK_ACTIONS),
  config: z.object({
    questions: z.array(faqQuickActionItemSchema),
    layout: faqQuickActionsLayoutSchema,
  }),
});

/**
 * 대화 시작 프롬프트 스타일 스키마
 */
export const conversationStarterStyleSchema = z.enum(['card', 'bubble', 'minimal']);

/**
 * 대화 시작 프롬프트 블록 스키마
 */
export const conversationStarterBlockSchema = z.object({
  ...baseBlockFields,
  type: z.literal(BlockType.CONVERSATION_STARTER),
  config: z.object({
    prompts: z.array(z.string()),
    randomize: z.boolean(),
    style: conversationStarterStyleSchema,
  }),
});

/**
 * 요일 스키마
 */
export const dayOfWeekSchema = z.enum(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']);

/**
 * 운영 시간 스케줄 아이템 스키마
 */
export const operatingHoursScheduleItemSchema = z.object({
  day: dayOfWeekSchema,
  open: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
  close: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
  closed: z.boolean(),
});

/**
 * 운영 시간 블록 스키마
 */
export const operatingHoursBlockSchema = z.object({
  ...baseBlockFields,
  type: z.literal(BlockType.OPERATING_HOURS),
  config: z.object({
    schedule: z.array(operatingHoursScheduleItemSchema),
    timezone: z.string(),
    showCurrentStatus: z.boolean(),
  }),
});

/**
 * 블록 유니온 스키마 (discriminatedUnion)
 *
 * type 필드를 기준으로 자동으로 올바른 스키마를 선택합니다.
 */
export const blockSchema = z.discriminatedUnion('type', [
  headerBlockSchema,
  chatbotBlockSchema,
  placeholderBlockSchema,
  // Phase 1 블록
  linkBlockSchema,
  textBlockSchema,
  dividerBlockSchema,
  socialIconsBlockSchema,
  // Phase 2 블록
  imageBlockSchema,
  imageCarouselBlockSchema,
  videoBlockSchema,
  faqAccordionBlockSchema,
  contactFormBlockSchema,
  mapBlockSchema,
  // Phase 3 블록 (SOFA 차별화)
  aiChatPreviewBlockSchema,
  knowledgeBaseLinkBlockSchema,
  faqQuickActionsBlockSchema,
  conversationStarterBlockSchema,
  operatingHoursBlockSchema,
]);

/**
 * 블록 배열 스키마
 */
export const blocksArraySchema = z.array(blockSchema);

/**
 * 블록 배열 검증 (런타임)
 */
export function validateBlocks(data: unknown): z.infer<typeof blocksArraySchema> {
  return blocksArraySchema.parse(data);
}

/**
 * 블록 배열 안전 검증 (에러 시 undefined 반환)
 */
export function safeValidateBlocks(
  data: unknown
): z.infer<typeof blocksArraySchema> | undefined {
  const result = blocksArraySchema.safeParse(data);
  return result.success ? result.data : undefined;
}

/**
 * 단일 블록 검증
 */
export function validateBlock(data: unknown): z.infer<typeof blockSchema> {
  return blockSchema.parse(data);
}

/**
 * 타입 추론을 위한 헬퍼 타입
 */
export type BlockSchemaType = z.infer<typeof blockSchema>;
export type BlocksArraySchemaType = z.infer<typeof blocksArraySchema>;
export type HeaderBlockSchemaType = z.infer<typeof headerBlockSchema>;
export type ChatbotBlockSchemaType = z.infer<typeof chatbotBlockSchema>;
export type PlaceholderBlockSchemaType = z.infer<typeof placeholderBlockSchema>;
// Phase 1 블록 타입
export type LinkBlockSchemaType = z.infer<typeof linkBlockSchema>;
export type TextBlockSchemaType = z.infer<typeof textBlockSchema>;
export type DividerBlockSchemaType = z.infer<typeof dividerBlockSchema>;
export type SocialIconsBlockSchemaType = z.infer<typeof socialIconsBlockSchema>;
// Phase 2 블록 타입
export type ImageBlockSchemaType = z.infer<typeof imageBlockSchema>;
export type ImageCarouselBlockSchemaType = z.infer<typeof imageCarouselBlockSchema>;
export type VideoBlockSchemaType = z.infer<typeof videoBlockSchema>;
export type FaqAccordionBlockSchemaType = z.infer<typeof faqAccordionBlockSchema>;
export type ContactFormBlockSchemaType = z.infer<typeof contactFormBlockSchema>;
export type MapBlockSchemaType = z.infer<typeof mapBlockSchema>;
// Phase 3 블록 타입 (SOFA 차별화)
export type AiChatPreviewBlockSchemaType = z.infer<typeof aiChatPreviewBlockSchema>;
export type KnowledgeBaseLinkBlockSchemaType = z.infer<typeof knowledgeBaseLinkBlockSchema>;
export type FaqQuickActionsBlockSchemaType = z.infer<typeof faqQuickActionsBlockSchema>;
export type ConversationStarterBlockSchemaType = z.infer<typeof conversationStarterBlockSchema>;
export type OperatingHoursBlockSchemaType = z.infer<typeof operatingHoursBlockSchema>;
