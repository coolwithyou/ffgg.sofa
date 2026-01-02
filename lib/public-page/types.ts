/**
 * 공개 페이지 설정 타입 정의
 *
 * 공개 페이지는 Linktree 스타일의 독립 페이지로,
 * 각 챗봇별로 고유한 슬러그 URL을 통해 접근할 수 있습니다.
 */

import type { Block } from './block-types';

/**
 * 공개 페이지 전체 설정
 */
export interface PublicPageConfig {
  header: HeaderConfig;
  theme: ThemeConfig;
  seo: SEOConfig;
  chatbot: ChatbotBlockConfig;
  /** 블록 배열 (Link in Bio 스타일 에디터용) */
  blocks?: Block[];
}

/**
 * 챗봇 블록 설정
 */
export interface ChatbotBlockConfig {
  /** 최소 높이 (px) - 기본 400 */
  minHeight: number;
  /** 최대 높이 (px) - 기본 600 */
  maxHeight: number;
}

/**
 * 헤더 블록 설정
 */
export interface HeaderConfig {
  /** 표시될 제목 */
  title: string;
  /** 부제목/설명 */
  description: string;
  /** 로고 이미지 URL */
  logoUrl?: string;
  /** 브랜드명 표시 여부 */
  showBrandName: boolean;
}

/**
 * 테마 설정
 */
export interface ThemeConfig {
  /** 배경색 (hex) */
  backgroundColor: string;
  /** 주요 강조색 (hex) */
  primaryColor: string;
  /** 텍스트색 (hex) */
  textColor: string;
  /** 폰트 패밀리 (선택) */
  fontFamily?: string;
}

/**
 * SEO 메타 설정
 */
export interface SEOConfig {
  /** 페이지 타이틀 (브라우저 탭) */
  title: string;
  /** 메타 설명 */
  description?: string;
  /** Open Graph 이미지 URL */
  ogImage?: string;
}

/**
 * 기본 공개 페이지 설정
 */
export const DEFAULT_PUBLIC_PAGE_CONFIG: PublicPageConfig = {
  header: {
    title: '',
    description: '',
    logoUrl: '',
    showBrandName: true,
  },
  theme: {
    backgroundColor: '#ffffff',
    primaryColor: '#3B82F6',
    textColor: '#1f2937',
  },
  seo: {
    title: '',
    description: '',
    ogImage: '',
  },
  chatbot: {
    minHeight: 400,
    maxHeight: 600,
  },
  blocks: [],
};

/**
 * PublicPageConfig를 JSON 객체로 변환 (DB 저장용)
 */
export function toPublicPageConfigJson(
  config: Partial<PublicPageConfig>
): Record<string, unknown> {
  return {
    header: {
      ...DEFAULT_PUBLIC_PAGE_CONFIG.header,
      ...config.header,
    },
    theme: {
      ...DEFAULT_PUBLIC_PAGE_CONFIG.theme,
      ...config.theme,
    },
    seo: {
      ...DEFAULT_PUBLIC_PAGE_CONFIG.seo,
      ...config.seo,
    },
    chatbot: {
      ...DEFAULT_PUBLIC_PAGE_CONFIG.chatbot,
      ...config.chatbot,
    },
    blocks: config.blocks ?? DEFAULT_PUBLIC_PAGE_CONFIG.blocks,
  };
}

/**
 * JSON 객체를 PublicPageConfig로 파싱 (DB 조회 후 사용)
 */
export function parsePublicPageConfig(
  json: unknown
): PublicPageConfig {
  if (!json || typeof json !== 'object') {
    return DEFAULT_PUBLIC_PAGE_CONFIG;
  }

  const obj = json as Record<string, unknown>;

  return {
    header: {
      ...DEFAULT_PUBLIC_PAGE_CONFIG.header,
      ...(obj.header as Partial<HeaderConfig>),
    },
    theme: {
      ...DEFAULT_PUBLIC_PAGE_CONFIG.theme,
      ...(obj.theme as Partial<ThemeConfig>),
    },
    seo: {
      ...DEFAULT_PUBLIC_PAGE_CONFIG.seo,
      ...(obj.seo as Partial<SEOConfig>),
    },
    chatbot: {
      ...DEFAULT_PUBLIC_PAGE_CONFIG.chatbot,
      ...(obj.chatbot as Partial<ChatbotBlockConfig>),
    },
    blocks: Array.isArray(obj.blocks) ? (obj.blocks as Block[]) : [],
  };
}
