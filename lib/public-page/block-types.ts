/**
 * 블록 에디터 타입 정의
 *
 * Link in Bio 스타일의 블록 시스템을 위한 타입 정의입니다.
 * MVP에서는 Header, Chatbot, Placeholder 블록만 지원합니다.
 */

import type { LucideIcon } from 'lucide-react';

/**
 * 블록 타입 상수
 */
export const BlockType = {
  HEADER: 'header',
  CHATBOT: 'chatbot',
  PLACEHOLDER: 'placeholder',
} as const;

export type BlockTypeValue = (typeof BlockType)[keyof typeof BlockType];

/**
 * 블록 카테고리
 */
export const BlockCategory = {
  ESSENTIAL: 'essential',
  CONTENT: 'content',
} as const;

export type BlockCategoryValue =
  (typeof BlockCategory)[keyof typeof BlockCategory];

/**
 * 블록 기본 인터페이스
 */
export interface BaseBlock {
  /** 고유 ID (nanoid) */
  id: string;
  /** 블록 타입 */
  type: BlockTypeValue;
  /** 표시 순서 (0부터 시작) */
  order: number;
  /** 표시 여부 */
  visible: boolean;
}

/**
 * 헤더 블록
 * - 로고, 제목, 설명을 표시
 * - 페이지당 1개만 허용
 */
export interface HeaderBlock extends BaseBlock {
  type: typeof BlockType.HEADER;
  config: {
    /** 제목 (기존 header.title과 동기화) */
    title: string;
    /** 설명 */
    description: string;
    /** 로고 URL */
    logoUrl?: string;
    /** 브랜드명 표시 여부 */
    showBrandName: boolean;
  };
}

/**
 * 챗봇 블록
 * - 임베디드 챗봇 위젯
 * - 페이지당 1개만 허용
 */
export interface ChatbotBlock extends BaseBlock {
  type: typeof BlockType.CHATBOT;
  config: {
    /** 최소 높이 (px) */
    minHeight: number;
    /** 최대 높이 (px) */
    maxHeight: number;
  };
}

/**
 * 플레이스홀더 블록 (MVP 테스트용)
 * - 에디터 동작 검증용
 * - 무제한 추가 가능
 */
export interface PlaceholderBlock extends BaseBlock {
  type: typeof BlockType.PLACEHOLDER;
  config: {
    /** 표시할 텍스트 */
    label: string;
  };
}

/**
 * 블록 유니온 타입
 */
export type Block = HeaderBlock | ChatbotBlock | PlaceholderBlock;

/**
 * 블록 메타데이터 (UI 표시용)
 */
export interface BlockMeta {
  /** 타입 */
  type: BlockTypeValue;
  /** 표시 이름 */
  name: string;
  /** 설명 */
  description: string;
  /** 카테고리 */
  category: BlockCategoryValue;
  /** 아이콘 컴포넌트 이름 (lucide-react) */
  icon: string;
  /** 최대 인스턴스 수 (0 = 무제한) */
  maxInstances: number;
}

/**
 * 블록 메타데이터 정의
 */
export const BLOCK_METAS: Record<BlockTypeValue, BlockMeta> = {
  [BlockType.HEADER]: {
    type: BlockType.HEADER,
    name: '헤더',
    description: '로고, 제목, 설명을 표시합니다',
    category: BlockCategory.ESSENTIAL,
    icon: 'LayoutTemplate',
    maxInstances: 1,
  },
  [BlockType.CHATBOT]: {
    type: BlockType.CHATBOT,
    name: '챗봇',
    description: 'AI 챗봇 위젯을 표시합니다',
    category: BlockCategory.ESSENTIAL,
    icon: 'MessageSquare',
    maxInstances: 1,
  },
  [BlockType.PLACEHOLDER]: {
    type: BlockType.PLACEHOLDER,
    name: '플레이스홀더',
    description: '테스트용 빈 블록입니다',
    category: BlockCategory.CONTENT,
    icon: 'Square',
    maxInstances: 0, // 무제한
  },
};

/**
 * 블록 팩토리 함수 타입
 */
export type BlockFactory<T extends Block = Block> = (
  id: string,
  order: number
) => T;

/**
 * 기본 헤더 블록 생성
 */
export function createHeaderBlock(id: string, order: number): HeaderBlock {
  return {
    id,
    type: BlockType.HEADER,
    order,
    visible: true,
    config: {
      title: '',
      description: '',
      logoUrl: '',
      showBrandName: true,
    },
  };
}

/**
 * 기본 챗봇 블록 생성
 */
export function createChatbotBlock(id: string, order: number): ChatbotBlock {
  return {
    id,
    type: BlockType.CHATBOT,
    order,
    visible: true,
    config: {
      minHeight: 400,
      maxHeight: 600,
    },
  };
}

/**
 * 기본 플레이스홀더 블록 생성
 */
export function createPlaceholderBlock(
  id: string,
  order: number,
  label?: string
): PlaceholderBlock {
  return {
    id,
    type: BlockType.PLACEHOLDER,
    order,
    visible: true,
    config: {
      label: label ?? `블록 ${order + 1}`,
    },
  };
}

/**
 * 블록 타입에 따른 팩토리 함수 매핑
 */
export const BLOCK_FACTORIES: Record<BlockTypeValue, BlockFactory> = {
  [BlockType.HEADER]: createHeaderBlock,
  [BlockType.CHATBOT]: createChatbotBlock,
  [BlockType.PLACEHOLDER]: createPlaceholderBlock,
};

/**
 * 블록 생성 유틸리티
 */
export function createBlock(
  type: BlockTypeValue,
  id: string,
  order: number
): Block {
  const factory = BLOCK_FACTORIES[type];
  return factory(id, order);
}

/**
 * 블록 배열에서 특정 타입의 개수 계산
 */
export function countBlocksByType(
  blocks: Block[],
  type: BlockTypeValue
): number {
  return blocks.filter((block) => block.type === type).length;
}

/**
 * 블록 추가 가능 여부 확인
 */
export function canAddBlock(blocks: Block[], type: BlockTypeValue): boolean {
  const meta = BLOCK_METAS[type];
  if (meta.maxInstances === 0) return true; // 무제한
  return countBlocksByType(blocks, type) < meta.maxInstances;
}

/**
 * 블록 순서 정규화
 * - order 값을 0부터 연속된 값으로 재정렬
 */
export function normalizeBlockOrder(blocks: Block[]): Block[] {
  return [...blocks]
    .sort((a, b) => a.order - b.order)
    .map((block, index) => ({
      ...block,
      order: index,
    }));
}
