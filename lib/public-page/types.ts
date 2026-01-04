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
 * 배경 타입
 */
export type BackgroundType = 'solid' | 'image' | 'gradient';

/**
 * 그라데이션 방향 프리셋
 */
export type GradientDirection =
  | 'to-b'   // 상→하
  | 'to-t'   // 하→상
  | 'to-r'   // 좌→우
  | 'to-l'   // 우→좌
  | 'to-br'  // 좌상→우하
  | 'to-bl'  // 우상→좌하
  | 'to-tr'  // 좌하→우상
  | 'to-tl'; // 우하→좌상

/**
 * 테마 설정
 */
export interface ThemeConfig {
  // === 배경 설정 ===
  /** 배경 타입: 단색, 이미지, 그라데이션 */
  backgroundType: BackgroundType;
  /** 외부 배경색 (hex) - 단색 배경 또는 이미지 폴백 */
  backgroundColor: string;

  // === 배경 이미지 (image 타입) ===
  /** 배경 이미지 URL */
  backgroundImage?: string;
  /** 배경 이미지 크기 */
  backgroundSize?: 'cover' | 'contain' | 'auto';
  /** 배경 이미지 반복 */
  backgroundRepeat?: 'no-repeat' | 'repeat' | 'repeat-x' | 'repeat-y';
  /** 배경 이미지 위치 */
  backgroundPosition?: string;

  // === 그라데이션 (gradient 타입) ===
  /** 그라데이션 시작 색상 */
  gradientFrom?: string;
  /** 그라데이션 끝 색상 */
  gradientTo?: string;
  /** 그라데이션 방향 프리셋 */
  gradientDirection?: GradientDirection;
  /** 사용자 정의 각도 (0-360°, direction보다 우선) */
  gradientAngle?: number;

  // === 기본 색상 ===
  /** 주요 강조색 (hex) */
  primaryColor: string;
  /** 텍스트색 (hex) */
  textColor: string;
  /** 폰트 패밀리 (선택) */
  fontFamily?: string;

  // === 카드 스타일 ===
  /** 카드/콘텐츠 영역 배경색 (hex) */
  cardBackgroundColor?: string;
  /** 카드 그림자 강도 (0-100, 0은 없음) */
  cardShadow?: number;
  /** 카드 상하 마진 (px) */
  cardMarginY?: number;
  /** 카드 좌우 패딩 (px) */
  cardPaddingX?: number;
  /** 카드 모서리 둥글기 (px) */
  cardBorderRadius?: number;
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
    // 배경 설정
    backgroundType: 'solid',
    backgroundColor: '#f9fafb',
    // 배경 이미지 기본값
    backgroundSize: 'cover',
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'center',
    // 그라데이션 기본값
    gradientFrom: '#667eea',
    gradientTo: '#764ba2',
    gradientDirection: 'to-br',
    // 기본 색상
    primaryColor: '#3B82F6',
    textColor: '#1f2937',
    // 카드 스타일
    cardBackgroundColor: '#ffffff',
    cardShadow: 20,
    cardMarginY: 32,
    cardPaddingX: 16,
    cardBorderRadius: 16,
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
 * 기존 데이터에서 배경 타입 추론 (하위 호환성)
 */
function inferBackgroundType(theme: Record<string, unknown>): BackgroundType {
  // 명시적으로 설정된 경우 그대로 사용
  if (theme.backgroundType) {
    return theme.backgroundType as BackgroundType;
  }
  // backgroundImage가 있으면 image 타입으로 추론
  if (theme.backgroundImage) {
    return 'image';
  }
  // gradientFrom과 gradientTo가 모두 있으면 gradient 타입으로 추론
  if (theme.gradientFrom && theme.gradientTo) {
    return 'gradient';
  }
  // 기본값: 단색
  return 'solid';
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
  const themeObj = (obj.theme as Record<string, unknown>) ?? {};

  return {
    header: {
      ...DEFAULT_PUBLIC_PAGE_CONFIG.header,
      ...(obj.header as Partial<HeaderConfig>),
    },
    theme: {
      ...DEFAULT_PUBLIC_PAGE_CONFIG.theme,
      ...themeObj,
      // 하위 호환성: backgroundType이 없는 기존 데이터 처리
      backgroundType: inferBackgroundType(themeObj),
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
