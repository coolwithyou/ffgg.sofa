/**
 * 헤더 템플릿 타입 정의
 *
 * 공개 페이지 헤더의 다양한 디자인 템플릿을 정의합니다.
 * 각 템플릿은 고유한 스타일과 레이아웃을 제공합니다.
 */

/**
 * 헤더 템플릿 타입
 */
export const HeaderTemplate = {
  /** 기존 프로필 스타일 (로고 + 제목 + 설명) */
  PROFILE: 'profile',
  /** 글래스모피즘 플로팅 헤더 */
  FLOATING_GLASS: 'floating-glass',
  /** 미니멀 스티키 헤더 */
  MINIMAL_STICKY: 'minimal-sticky',
  /** 필 네비게이션 헤더 */
  PILL_NAV: 'pill-nav',
} as const;

export type HeaderTemplateType =
  (typeof HeaderTemplate)[keyof typeof HeaderTemplate];

/**
 * 네비게이션 링크
 */
export interface NavLink {
  /** 링크 라벨 */
  label: string;
  /** 링크 URL (내부 앵커 또는 외부 URL) */
  href: string;
}

/**
 * CTA 버튼 설정
 */
export interface CtaButton {
  /** 버튼 라벨 */
  label: string;
  /** 버튼 링크 */
  href: string;
  /** 버튼 스타일 변형 */
  variant?: 'primary' | 'secondary' | 'ghost';
}

/**
 * 템플릿 메타데이터 (UI 표시용)
 */
export interface HeaderTemplateMeta {
  /** 템플릿 이름 */
  name: string;
  /** 템플릿 설명 */
  description: string;
  /** 미리보기 이미지 (선택) */
  thumbnail?: string;
  /** 주요 특징 */
  features: string[];
  /** 추천 용도 */
  recommended: string[];
}

/**
 * 각 헤더 템플릿의 메타데이터
 */
export const HEADER_TEMPLATE_META: Record<HeaderTemplateType, HeaderTemplateMeta> = {
  [HeaderTemplate.PROFILE]: {
    name: '프로필',
    description: '링크트리 스타일의 프로필 헤더',
    features: ['원형 로고', '중앙 정렬', '프로필 설명'],
    recommended: ['개인 브랜딩', '링크 모음 페이지', '심플한 소개'],
  },
  [HeaderTemplate.FLOATING_GLASS]: {
    name: '플로팅 글래스',
    description: '글래스모피즘 효과의 모던한 헤더',
    features: ['반투명 배경', '블러 효과', '네비게이션 지원'],
    recommended: ['모던 브랜드', '프리미엄 느낌', '다크 테마'],
  },
  [HeaderTemplate.MINIMAL_STICKY]: {
    name: '미니멀',
    description: '깔끔하고 단순한 미니멀 헤더',
    features: ['깔끔한 디자인', '하단 테두리', 'CTA 버튼'],
    recommended: ['비즈니스', '포트폴리오', '서비스 소개'],
  },
  [HeaderTemplate.PILL_NAV]: {
    name: '필 네비게이션',
    description: '둥근 pill 스타일의 네비게이션 헤더',
    features: ['둥근 컨테이너', '필 버튼 네비', '호버 효과'],
    recommended: ['트렌디한 브랜드', 'SaaS 랜딩', '앱 소개'],
  },
};

/**
 * 기본 네비게이션 링크 (빈 배열)
 */
export const DEFAULT_NAV_LINKS: NavLink[] = [];

/**
 * 헤더 템플릿 목록 (UI 표시용)
 */
export const HEADER_TEMPLATE_LIST = Object.entries(HEADER_TEMPLATE_META).map(
  ([key, meta]) => ({
    value: key as HeaderTemplateType,
    ...meta,
  })
);

// ============================================
// Phase 2: 프로필 헤더 테마 시스템
// ============================================

/**
 * 프로필 헤더 테마 타입
 *
 * 프로필 스타일(template: 'profile') 헤더의 비주얼 디자인 변형입니다.
 * Linktree 스타일의 프로필 페이지에서 사용됩니다.
 */
export const ProfileTheme = {
  /** 기본 클래식 스타일 */
  CLASSIC: 'classic',
  /** 단색 배경 + 원형 프로필 */
  SOLID_COLOR: 'solid-color',
  /** 풀스크린 배경 이미지 + 오버레이 */
  HERO_IMAGE: 'hero-image',
} as const;

export type ProfileThemeType = (typeof ProfileTheme)[keyof typeof ProfileTheme];

/**
 * 프로필 테마 메타데이터 (UI 표시용)
 */
export interface ProfileThemeMeta {
  /** 테마 이름 */
  name: string;
  /** 테마 설명 */
  description: string;
  /** 주요 특징 */
  features: string[];
}

/**
 * 각 프로필 테마의 메타데이터
 */
export const PROFILE_THEME_META: Record<ProfileThemeType, ProfileThemeMeta> = {
  [ProfileTheme.CLASSIC]: {
    name: '클래식',
    description: '기본 프로필 스타일',
    features: ['원형 로고', '중앙 정렬', '심플한 배경'],
  },
  [ProfileTheme.SOLID_COLOR]: {
    name: '솔리드 컬러',
    description: '단색 배경에 원형 프로필',
    features: ['커스텀 배경색', '원형 로고', '강렬한 인상'],
  },
  [ProfileTheme.HERO_IMAGE]: {
    name: '히어로 이미지',
    description: '풀스크린 배경 이미지 + 오버레이',
    features: ['배경 이미지', '반투명 오버레이', '임팩트 있는 비주얼'],
  },
};

/**
 * 프로필 테마 목록 (UI 표시용)
 */
export const PROFILE_THEME_LIST = Object.entries(PROFILE_THEME_META).map(
  ([key, meta]) => ({
    value: key as ProfileThemeType,
    ...meta,
  })
);
