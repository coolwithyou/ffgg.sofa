/**
 * 블록 설정 컴포넌트 레지스트리
 *
 * 블록 타입별 설정 컴포넌트를 매핑합니다.
 * 동적 import로 코드 스플리팅을 지원합니다.
 *
 * @example
 * ```tsx
 * import { BLOCK_SETTINGS_COMPONENTS } from './settings';
 *
 * const SettingsComponent = BLOCK_SETTINGS_COMPONENTS[block.type];
 * if (SettingsComponent) {
 *   return <SettingsComponent block={block} onUpdate={onUpdate} />;
 * }
 * ```
 */

import type { ComponentType } from 'react';
import { BlockType, type Block, type BlockTypeValue } from '@/lib/public-page/block-types';

/**
 * 블록 설정 컴포넌트 Props 인터페이스
 *
 * 모든 블록 설정 컴포넌트는 이 인터페이스를 구현해야 합니다.
 */
export interface BlockSettingsProps<T extends Block = Block> {
  /** 설정할 블록 */
  block: T;
  /** 블록 업데이트 콜백 */
  onUpdate: (updates: Partial<T>) => void;
}

/**
 * 블록 설정 컴포넌트 타입
 *
 * 참고: 레지스트리에서는 유연한 타입(any)을 사용하지만,
 * 각 설정 컴포넌트는 구체적인 블록 타입으로 정의됩니다.
 */
export type BlockSettingsComponent<T extends Block = Block> = ComponentType<
  BlockSettingsProps<T>
>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyBlockSettingsComponent = ComponentType<BlockSettingsProps<any>>;

// 블록 설정 컴포넌트 동적 import
import { HeaderBlockSettings } from './header-settings';
import { ChatbotBlockSettings } from './chatbot-settings';
import { PlaceholderBlockSettings } from './placeholder-settings';
// Phase 1 블록 설정
import { LinkBlockSettings } from './link-settings';
import { TextBlockSettings } from './text-settings';
import { DividerBlockSettings } from './divider-settings';
import { SocialIconsBlockSettings } from './social-icons-settings';
// Phase 2 블록 설정
import { ImageBlockSettings } from './image-settings';
import { ImageCarouselBlockSettings } from './image-carousel-settings';
import { VideoBlockSettings } from './video-settings';
import { FaqAccordionBlockSettings } from './faq-accordion-settings';
import { ContactFormBlockSettings } from './contact-form-settings';
import { MapBlockSettings } from './map-settings';

/**
 * 블록 타입별 설정 컴포넌트 레지스트리
 *
 * 새로운 블록을 추가할 때:
 * 1. `settings/[block-type]-settings.tsx` 파일 생성
 * 2. BlockSettingsProps를 구현하는 컴포넌트 작성
 * 3. 이 레지스트리에 등록
 *
 * 타입 안전성 참고:
 * - 레지스트리 자체는 런타임에서 블록 타입에 맞는 컴포넌트를 동적으로 선택
 * - 각 설정 컴포넌트 내부에서는 구체적인 블록 타입이 적용됨
 */
export const BLOCK_SETTINGS_COMPONENTS: Partial<
  Record<BlockTypeValue, AnyBlockSettingsComponent>
> = {
  [BlockType.HEADER]: HeaderBlockSettings,
  [BlockType.CHATBOT]: ChatbotBlockSettings,
  [BlockType.PLACEHOLDER]: PlaceholderBlockSettings,
  // Phase 1 블록
  [BlockType.LINK]: LinkBlockSettings,
  [BlockType.TEXT]: TextBlockSettings,
  [BlockType.DIVIDER]: DividerBlockSettings,
  [BlockType.SOCIAL_ICONS]: SocialIconsBlockSettings,
  // Phase 2 블록
  [BlockType.IMAGE]: ImageBlockSettings,
  [BlockType.IMAGE_CAROUSEL]: ImageCarouselBlockSettings,
  [BlockType.VIDEO]: VideoBlockSettings,
  [BlockType.FAQ_ACCORDION]: FaqAccordionBlockSettings,
  [BlockType.CONTACT_FORM]: ContactFormBlockSettings,
  [BlockType.MAP]: MapBlockSettings,
};

// 개별 설정 컴포넌트 re-export
export { HeaderBlockSettings } from './header-settings';
export { ChatbotBlockSettings } from './chatbot-settings';
export { PlaceholderBlockSettings } from './placeholder-settings';
// Phase 1 블록
export { LinkBlockSettings } from './link-settings';
export { TextBlockSettings } from './text-settings';
export { DividerBlockSettings } from './divider-settings';
export { SocialIconsBlockSettings } from './social-icons-settings';
// Phase 2 블록
export { ImageBlockSettings } from './image-settings';
export { ImageCarouselBlockSettings } from './image-carousel-settings';
export { VideoBlockSettings } from './video-settings';
export { FaqAccordionBlockSettings } from './faq-accordion-settings';
export { ContactFormBlockSettings } from './contact-form-settings';
export { MapBlockSettings } from './map-settings';
