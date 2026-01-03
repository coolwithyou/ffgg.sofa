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
  }),
});

/**
 * 챗봇 블록 스키마
 */
export const chatbotBlockSchema = z.object({
  ...baseBlockFields,
  type: z.literal(BlockType.CHATBOT),
  config: z.object({
    minHeight: z.number().int().min(100).max(1000),
    maxHeight: z.number().int().min(100).max(1500),
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
