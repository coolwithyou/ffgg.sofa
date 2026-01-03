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
  // Phase 1 블록
  LINK: 'link',
  TEXT: 'text',
  DIVIDER: 'divider',
  SOCIAL_ICONS: 'social_icons',
  // Phase 2 블록
  IMAGE: 'image',
  IMAGE_CAROUSEL: 'image_carousel',
  VIDEO: 'video',
  FAQ_ACCORDION: 'faq_accordion',
  CONTACT_FORM: 'contact_form',
  MAP: 'map',
  // Phase 3 블록 (SOFA 차별화)
  AI_CHAT_PREVIEW: 'ai_chat_preview',
  KNOWLEDGE_BASE_LINK: 'knowledge_base_link',
  FAQ_QUICK_ACTIONS: 'faq_quick_actions',
  CONVERSATION_STARTER: 'conversation_starter',
  OPERATING_HOURS: 'operating_hours',
} as const;

export type BlockTypeValue = (typeof BlockType)[keyof typeof BlockType];

/**
 * 블록 카테고리
 */
export const BlockCategory = {
  ESSENTIAL: 'essential',
  CONTENT: 'content',
  MEDIA: 'media',
  INTERACTIVE: 'interactive',
  SOFA: 'sofa', // Phase 3: SOFA 차별화 블록
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

// ============================================
// Phase 1 블록 타입 정의
// ============================================

/**
 * 링크 블록 스타일
 */
export type LinkBlockStyle = 'default' | 'featured' | 'outline';

/**
 * 링크 블록
 * - 외부/내부 링크 버튼
 * - 썸네일, 제목, 설명 지원
 */
export interface LinkBlock extends BaseBlock {
  type: typeof BlockType.LINK;
  config: {
    /** 링크 URL */
    url: string;
    /** 링크 제목 */
    title: string;
    /** 링크 설명 (선택) */
    description?: string;
    /** 썸네일 이미지 URL (선택) */
    thumbnail?: string;
    /** 버튼 스타일 */
    style: LinkBlockStyle;
    /** 새 탭에서 열기 */
    openInNewTab: boolean;
  };
}

/**
 * 텍스트 블록 정렬
 */
export type TextBlockAlign = 'left' | 'center' | 'right';

/**
 * 텍스트 블록 크기
 */
export type TextBlockSize = 'sm' | 'md' | 'lg';

/**
 * 텍스트 블록
 * - 마크다운 지원 텍스트
 * - 정렬 및 크기 조절 가능
 */
export interface TextBlock extends BaseBlock {
  type: typeof BlockType.TEXT;
  config: {
    /** 텍스트 내용 */
    content: string;
    /** 텍스트 정렬 */
    align: TextBlockAlign;
    /** 텍스트 크기 */
    size: TextBlockSize;
  };
}

/**
 * 디바이더 블록 스타일
 */
export type DividerBlockStyle = 'line' | 'dashed' | 'dotted' | 'space';

/**
 * 디바이더 블록 간격
 */
export type DividerBlockSpacing = 'sm' | 'md' | 'lg';

/**
 * 디바이더 블록
 * - 콘텐츠 구분선
 * - 다양한 스타일과 간격 지원
 */
export interface DividerBlock extends BaseBlock {
  type: typeof BlockType.DIVIDER;
  config: {
    /** 구분선 스타일 */
    style: DividerBlockStyle;
    /** 상하 간격 */
    spacing: DividerBlockSpacing;
  };
}

/**
 * 소셜 아이콘 종류
 */
export type SocialIconType =
  | 'instagram'
  | 'twitter'
  | 'facebook'
  | 'youtube'
  | 'tiktok'
  | 'linkedin'
  | 'github'
  | 'website';

/**
 * 소셜 아이콘 아이템
 */
export interface SocialIconItem {
  /** 아이콘 종류 */
  type: SocialIconType;
  /** 링크 URL */
  url: string;
}

/**
 * 소셜 아이콘 블록 크기
 */
export type SocialIconsBlockSize = 'sm' | 'md' | 'lg';

/**
 * 소셜 아이콘 블록 스타일
 */
export type SocialIconsBlockStyle = 'default' | 'filled' | 'outline';

/**
 * 소셜 아이콘 블록
 * - 여러 소셜 미디어 링크를 아이콘으로 표시
 */
export interface SocialIconsBlock extends BaseBlock {
  type: typeof BlockType.SOCIAL_ICONS;
  config: {
    /** 소셜 아이콘 목록 */
    icons: SocialIconItem[];
    /** 아이콘 크기 */
    size: SocialIconsBlockSize;
    /** 아이콘 스타일 */
    style: SocialIconsBlockStyle;
  };
}

// ============================================
// Phase 2 블록 타입 정의
// ============================================

/**
 * 이미지 블록 비율
 */
export type ImageBlockAspectRatio = '1:1' | '4:3' | '16:9' | 'auto';

/**
 * 이미지 블록
 * - 이미지 표시
 * - 비율 선택 및 링크 연결 지원
 */
export interface ImageBlock extends BaseBlock {
  type: typeof BlockType.IMAGE;
  config: {
    /** 이미지 URL */
    src: string;
    /** 대체 텍스트 */
    alt: string;
    /** 캡션 (선택) */
    caption?: string;
    /** 가로세로 비율 */
    aspectRatio: ImageBlockAspectRatio;
    /** 클릭 시 이동 URL (선택) */
    linkUrl?: string;
  };
}

/**
 * 캐러셀 이미지 아이템
 */
export interface CarouselImageItem {
  /** 이미지 URL */
  src: string;
  /** 대체 텍스트 */
  alt: string;
  /** 클릭 시 이동 URL (선택) */
  linkUrl?: string;
}

/**
 * 이미지 캐러셀 블록
 * - 여러 이미지를 슬라이드로 표시
 * - 자동 재생 및 네비게이션 지원
 */
export interface ImageCarouselBlock extends BaseBlock {
  type: typeof BlockType.IMAGE_CAROUSEL;
  config: {
    /** 이미지 목록 */
    images: CarouselImageItem[];
    /** 자동 재생 여부 */
    autoPlay: boolean;
    /** 자동 재생 간격 (ms) */
    interval: number;
    /** 도트 네비게이션 표시 */
    showDots: boolean;
    /** 화살표 네비게이션 표시 */
    showArrows: boolean;
  };
}

/**
 * 비디오 제공자
 */
export type VideoProvider = 'youtube' | 'vimeo';

/**
 * 비디오 블록
 * - YouTube, Vimeo 임베드 지원
 */
export interface VideoBlock extends BaseBlock {
  type: typeof BlockType.VIDEO;
  config: {
    /** 비디오 제공자 */
    provider: VideoProvider;
    /** 비디오 ID */
    videoId: string;
    /** 자동 재생 여부 */
    autoPlay: boolean;
    /** 컨트롤 표시 여부 */
    showControls: boolean;
  };
}

/**
 * FAQ 아이템
 */
export interface FaqItem {
  /** 질문 */
  question: string;
  /** 답변 */
  answer: string;
}

/**
 * FAQ 아코디언 블록
 * - 접기/펼치기 가능한 FAQ 목록
 */
export interface FaqAccordionBlock extends BaseBlock {
  type: typeof BlockType.FAQ_ACCORDION;
  config: {
    /** FAQ 항목 목록 */
    items: FaqItem[];
    /** 여러 항목 동시 열기 허용 */
    allowMultiple: boolean;
    /** 기본 열림 항목 인덱스 (선택) */
    defaultOpen?: number;
  };
}

/**
 * 폼 필드 타입
 */
export type ContactFormFieldType = 'text' | 'email' | 'textarea';

/**
 * 폼 필드
 */
export interface ContactFormField {
  /** 필드 타입 */
  type: ContactFormFieldType;
  /** 라벨 */
  label: string;
  /** 필수 여부 */
  required: boolean;
  /** 플레이스홀더 (선택) */
  placeholder?: string;
}

/**
 * 연락처 폼 블록
 * - 커스텀 폼 필드
 * - 폼 제출 처리
 */
export interface ContactFormBlock extends BaseBlock {
  type: typeof BlockType.CONTACT_FORM;
  config: {
    /** 폼 필드 목록 */
    fields: ContactFormField[];
    /** 제출 버튼 텍스트 */
    submitText: string;
    /** 성공 메시지 */
    successMessage: string;
  };
}

/**
 * 지도 제공자
 */
export type MapProvider = 'google' | 'kakao' | 'naver';

/**
 * 지도 블록
 * - Google/Kakao/Naver 지도 임베드
 */
export interface MapBlock extends BaseBlock {
  type: typeof BlockType.MAP;
  config: {
    /** 지도 제공자 */
    provider: MapProvider;
    /** 주소 */
    address: string;
    /** 위도 (선택) */
    lat?: number;
    /** 경도 (선택) */
    lng?: number;
    /** 줌 레벨 */
    zoom: number;
  };
}

// ============================================
// Phase 3 블록 타입 정의 (SOFA 차별화)
// ============================================

/**
 * AI 채팅 미리보기 메시지 역할
 */
export type AiChatRole = 'user' | 'assistant';

/**
 * AI 채팅 미리보기 메시지
 */
export interface AiChatMessage {
  /** 메시지 역할 */
  role: AiChatRole;
  /** 메시지 내용 */
  content: string;
}

/**
 * AI 채팅 미리보기 블록
 * - 챗봇 대화 예시를 미리보기로 표시
 * - 타이핑 애니메이션 효과
 * - 클릭 시 실제 챗봇으로 전환
 */
export interface AiChatPreviewBlock extends BaseBlock {
  type: typeof BlockType.AI_CHAT_PREVIEW;
  config: {
    /** 대화 예시 */
    conversations: AiChatMessage[];
    /** 타이핑 애니메이션 표시 여부 */
    showTypingAnimation: boolean;
  };
}

/**
 * 지식 베이스 링크 블록
 * - 지식 베이스 문서와 연결
 * - 문서 미리보기 표시 옵션
 */
export interface KnowledgeBaseLinkBlock extends BaseBlock {
  type: typeof BlockType.KNOWLEDGE_BASE_LINK;
  config: {
    /** 연결할 문서 ID */
    documentId: string;
    /** 표시 제목 (미지정 시 문서 제목 사용) */
    title?: string;
    /** 미리보기 표시 여부 */
    showPreview: boolean;
  };
}

/**
 * FAQ 빠른 액션 레이아웃
 */
export type FaqQuickActionsLayout = 'buttons' | 'chips' | 'list';

/**
 * FAQ 빠른 액션 질문 아이템
 */
export interface FaqQuickActionItem {
  /** 질문 텍스트 */
  text: string;
}

/**
 * FAQ 빠른 액션 블록
 * - 자주 묻는 질문 버튼
 * - 클릭 시 챗봇에 질문 자동 입력
 */
export interface FaqQuickActionsBlock extends BaseBlock {
  type: typeof BlockType.FAQ_QUICK_ACTIONS;
  config: {
    /** 질문 목록 */
    questions: FaqQuickActionItem[];
    /** 레이아웃 */
    layout: FaqQuickActionsLayout;
  };
}

/**
 * 대화 시작 프롬프트 스타일
 */
export type ConversationStarterStyle = 'card' | 'bubble' | 'minimal';

/**
 * 대화 시작 프롬프트 블록
 * - 대화 시작 프롬프트 제안
 * - 랜덤 표시 옵션
 */
export interface ConversationStarterBlock extends BaseBlock {
  type: typeof BlockType.CONVERSATION_STARTER;
  config: {
    /** 프롬프트 목록 */
    prompts: string[];
    /** 랜덤 표시 여부 */
    randomize: boolean;
    /** 스타일 */
    style: ConversationStarterStyle;
  };
}

/**
 * 요일 타입
 */
export type DayOfWeek = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

/**
 * 운영 시간 스케줄 항목
 */
export interface OperatingHoursScheduleItem {
  /** 요일 */
  day: DayOfWeek;
  /** 오픈 시간 (HH:mm) */
  open: string;
  /** 마감 시간 (HH:mm) */
  close: string;
  /** 휴무 여부 */
  closed: boolean;
}

/**
 * 운영 시간 블록
 * - 요일별 운영 시간 표시
 * - 현재 상태 자동 표시 (운영 중/종료)
 */
export interface OperatingHoursBlock extends BaseBlock {
  type: typeof BlockType.OPERATING_HOURS;
  config: {
    /** 스케줄 목록 */
    schedule: OperatingHoursScheduleItem[];
    /** 타임존 */
    timezone: string;
    /** 현재 상태 표시 여부 */
    showCurrentStatus: boolean;
  };
}

/**
 * 블록 유니온 타입
 */
export type Block =
  | HeaderBlock
  | ChatbotBlock
  | PlaceholderBlock
  | LinkBlock
  | TextBlock
  | DividerBlock
  | SocialIconsBlock
  // Phase 2 블록
  | ImageBlock
  | ImageCarouselBlock
  | VideoBlock
  | FaqAccordionBlock
  | ContactFormBlock
  | MapBlock
  // Phase 3 블록 (SOFA 차별화)
  | AiChatPreviewBlock
  | KnowledgeBaseLinkBlock
  | FaqQuickActionsBlock
  | ConversationStarterBlock
  | OperatingHoursBlock;

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
  // Phase 1 블록 메타데이터
  [BlockType.LINK]: {
    type: BlockType.LINK,
    name: '링크',
    description: '외부 링크 버튼을 추가합니다',
    category: BlockCategory.CONTENT,
    icon: 'Link',
    maxInstances: 0, // 무제한
  },
  [BlockType.TEXT]: {
    type: BlockType.TEXT,
    name: '텍스트',
    description: '텍스트 콘텐츠를 추가합니다',
    category: BlockCategory.CONTENT,
    icon: 'Type',
    maxInstances: 0, // 무제한
  },
  [BlockType.DIVIDER]: {
    type: BlockType.DIVIDER,
    name: '구분선',
    description: '콘텐츠를 구분하는 선을 추가합니다',
    category: BlockCategory.CONTENT,
    icon: 'Minus',
    maxInstances: 0, // 무제한
  },
  [BlockType.SOCIAL_ICONS]: {
    type: BlockType.SOCIAL_ICONS,
    name: '소셜 아이콘',
    description: 'SNS 링크 아이콘을 추가합니다',
    category: BlockCategory.CONTENT,
    icon: 'Share2',
    maxInstances: 1, // 페이지당 1개
  },
  // Phase 2 블록 메타데이터
  [BlockType.IMAGE]: {
    type: BlockType.IMAGE,
    name: '이미지',
    description: '이미지를 추가합니다',
    category: BlockCategory.MEDIA,
    icon: 'Image',
    maxInstances: 0, // 무제한
  },
  [BlockType.IMAGE_CAROUSEL]: {
    type: BlockType.IMAGE_CAROUSEL,
    name: '이미지 캐러셀',
    description: '여러 이미지를 슬라이드로 표시합니다',
    category: BlockCategory.MEDIA,
    icon: 'Images',
    maxInstances: 0, // 무제한
  },
  [BlockType.VIDEO]: {
    type: BlockType.VIDEO,
    name: '비디오',
    description: 'YouTube, Vimeo 영상을 임베드합니다',
    category: BlockCategory.MEDIA,
    icon: 'Video',
    maxInstances: 0, // 무제한
  },
  [BlockType.FAQ_ACCORDION]: {
    type: BlockType.FAQ_ACCORDION,
    name: 'FAQ 아코디언',
    description: '자주 묻는 질문을 접기/펼치기로 표시합니다',
    category: BlockCategory.INTERACTIVE,
    icon: 'HelpCircle',
    maxInstances: 0, // 무제한
  },
  [BlockType.CONTACT_FORM]: {
    type: BlockType.CONTACT_FORM,
    name: '연락처 폼',
    description: '문의 폼을 추가합니다',
    category: BlockCategory.INTERACTIVE,
    icon: 'Mail',
    maxInstances: 1, // 페이지당 1개
  },
  [BlockType.MAP]: {
    type: BlockType.MAP,
    name: '지도',
    description: '지도를 임베드합니다',
    category: BlockCategory.MEDIA,
    icon: 'MapPin',
    maxInstances: 1, // 페이지당 1개
  },
  // Phase 3 블록 메타데이터 (SOFA 차별화)
  [BlockType.AI_CHAT_PREVIEW]: {
    type: BlockType.AI_CHAT_PREVIEW,
    name: 'AI 채팅 미리보기',
    description: '챗봇 대화 예시를 미리보기로 표시합니다',
    category: BlockCategory.SOFA,
    icon: 'MessageCircle',
    maxInstances: 1, // 페이지당 1개
  },
  [BlockType.KNOWLEDGE_BASE_LINK]: {
    type: BlockType.KNOWLEDGE_BASE_LINK,
    name: '지식 베이스 링크',
    description: '지식 베이스 문서와 연결합니다',
    category: BlockCategory.SOFA,
    icon: 'FileText',
    maxInstances: 0, // 무제한
  },
  [BlockType.FAQ_QUICK_ACTIONS]: {
    type: BlockType.FAQ_QUICK_ACTIONS,
    name: 'FAQ 빠른 액션',
    description: '자주 묻는 질문을 버튼으로 표시합니다',
    category: BlockCategory.SOFA,
    icon: 'Zap',
    maxInstances: 1, // 페이지당 1개
  },
  [BlockType.CONVERSATION_STARTER]: {
    type: BlockType.CONVERSATION_STARTER,
    name: '대화 시작 프롬프트',
    description: '대화 시작 프롬프트를 제안합니다',
    category: BlockCategory.SOFA,
    icon: 'Sparkles',
    maxInstances: 1, // 페이지당 1개
  },
  [BlockType.OPERATING_HOURS]: {
    type: BlockType.OPERATING_HOURS,
    name: '운영 시간',
    description: '요일별 운영 시간을 표시합니다',
    category: BlockCategory.SOFA,
    icon: 'Clock',
    maxInstances: 1, // 페이지당 1개
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

// ============================================
// Phase 1 블록 팩토리 함수
// ============================================

/**
 * 링크 블록 생성
 */
export function createLinkBlock(id: string, order: number): LinkBlock {
  return {
    id,
    type: BlockType.LINK,
    order,
    visible: true,
    config: {
      url: '',
      title: '새 링크',
      description: '',
      thumbnail: '',
      style: 'default',
      openInNewTab: true,
    },
  };
}

/**
 * 텍스트 블록 생성
 */
export function createTextBlock(id: string, order: number): TextBlock {
  return {
    id,
    type: BlockType.TEXT,
    order,
    visible: true,
    config: {
      content: '텍스트를 입력하세요',
      align: 'center',
      size: 'md',
    },
  };
}

/**
 * 디바이더 블록 생성
 */
export function createDividerBlock(id: string, order: number): DividerBlock {
  return {
    id,
    type: BlockType.DIVIDER,
    order,
    visible: true,
    config: {
      style: 'line',
      spacing: 'md',
    },
  };
}

/**
 * 소셜 아이콘 블록 생성
 */
export function createSocialIconsBlock(
  id: string,
  order: number
): SocialIconsBlock {
  return {
    id,
    type: BlockType.SOCIAL_ICONS,
    order,
    visible: true,
    config: {
      icons: [],
      size: 'md',
      style: 'default',
    },
  };
}

// ============================================
// Phase 2 블록 팩토리 함수
// ============================================

/**
 * 이미지 블록 생성
 */
export function createImageBlock(id: string, order: number): ImageBlock {
  return {
    id,
    type: BlockType.IMAGE,
    order,
    visible: true,
    config: {
      src: '',
      alt: '',
      caption: '',
      aspectRatio: 'auto',
      linkUrl: '',
    },
  };
}

/**
 * 이미지 캐러셀 블록 생성
 */
export function createImageCarouselBlock(
  id: string,
  order: number
): ImageCarouselBlock {
  return {
    id,
    type: BlockType.IMAGE_CAROUSEL,
    order,
    visible: true,
    config: {
      images: [],
      autoPlay: false,
      interval: 3000,
      showDots: true,
      showArrows: true,
    },
  };
}

/**
 * 비디오 블록 생성
 */
export function createVideoBlock(id: string, order: number): VideoBlock {
  return {
    id,
    type: BlockType.VIDEO,
    order,
    visible: true,
    config: {
      provider: 'youtube',
      videoId: '',
      autoPlay: false,
      showControls: true,
    },
  };
}

/**
 * FAQ 아코디언 블록 생성
 */
export function createFaqAccordionBlock(
  id: string,
  order: number
): FaqAccordionBlock {
  return {
    id,
    type: BlockType.FAQ_ACCORDION,
    order,
    visible: true,
    config: {
      items: [
        { question: '질문을 입력하세요', answer: '답변을 입력하세요' },
      ],
      allowMultiple: false,
      defaultOpen: 0,
    },
  };
}

/**
 * 연락처 폼 블록 생성
 */
export function createContactFormBlock(
  id: string,
  order: number
): ContactFormBlock {
  return {
    id,
    type: BlockType.CONTACT_FORM,
    order,
    visible: true,
    config: {
      fields: [
        { type: 'text', label: '이름', required: true, placeholder: '이름을 입력하세요' },
        { type: 'email', label: '이메일', required: true, placeholder: '이메일을 입력하세요' },
        { type: 'textarea', label: '메시지', required: true, placeholder: '메시지를 입력하세요' },
      ],
      submitText: '보내기',
      successMessage: '메시지가 전송되었습니다.',
    },
  };
}

/**
 * 지도 블록 생성
 */
export function createMapBlock(id: string, order: number): MapBlock {
  return {
    id,
    type: BlockType.MAP,
    order,
    visible: true,
    config: {
      provider: 'kakao',
      address: '',
      lat: undefined,
      lng: undefined,
      zoom: 15,
    },
  };
}

// ============================================
// Phase 3 블록 팩토리 함수 (SOFA 차별화)
// ============================================

/**
 * AI 채팅 미리보기 블록 생성
 */
export function createAiChatPreviewBlock(
  id: string,
  order: number
): AiChatPreviewBlock {
  return {
    id,
    type: BlockType.AI_CHAT_PREVIEW,
    order,
    visible: true,
    config: {
      conversations: [
        { role: 'user', content: '안녕하세요, 궁금한 점이 있어요' },
        { role: 'assistant', content: '안녕하세요! 무엇을 도와드릴까요?' },
      ],
      showTypingAnimation: true,
    },
  };
}

/**
 * 지식 베이스 링크 블록 생성
 */
export function createKnowledgeBaseLinkBlock(
  id: string,
  order: number
): KnowledgeBaseLinkBlock {
  return {
    id,
    type: BlockType.KNOWLEDGE_BASE_LINK,
    order,
    visible: true,
    config: {
      documentId: '',
      title: '',
      showPreview: true,
    },
  };
}

/**
 * FAQ 빠른 액션 블록 생성
 */
export function createFaqQuickActionsBlock(
  id: string,
  order: number
): FaqQuickActionsBlock {
  return {
    id,
    type: BlockType.FAQ_QUICK_ACTIONS,
    order,
    visible: true,
    config: {
      questions: [
        { text: '자주 묻는 질문 1' },
        { text: '자주 묻는 질문 2' },
        { text: '자주 묻는 질문 3' },
      ],
      layout: 'buttons',
    },
  };
}

/**
 * 대화 시작 프롬프트 블록 생성
 */
export function createConversationStarterBlock(
  id: string,
  order: number
): ConversationStarterBlock {
  return {
    id,
    type: BlockType.CONVERSATION_STARTER,
    order,
    visible: true,
    config: {
      prompts: [
        '서비스 이용 방법이 궁금해요',
        '가격 정보를 알려주세요',
        '문의 사항이 있어요',
      ],
      randomize: false,
      style: 'card',
    },
  };
}

/**
 * 운영 시간 블록 생성
 */
export function createOperatingHoursBlock(
  id: string,
  order: number
): OperatingHoursBlock {
  return {
    id,
    type: BlockType.OPERATING_HOURS,
    order,
    visible: true,
    config: {
      schedule: [
        { day: 'mon', open: '09:00', close: '18:00', closed: false },
        { day: 'tue', open: '09:00', close: '18:00', closed: false },
        { day: 'wed', open: '09:00', close: '18:00', closed: false },
        { day: 'thu', open: '09:00', close: '18:00', closed: false },
        { day: 'fri', open: '09:00', close: '18:00', closed: false },
        { day: 'sat', open: '10:00', close: '14:00', closed: false },
        { day: 'sun', open: '00:00', close: '00:00', closed: true },
      ],
      timezone: 'Asia/Seoul',
      showCurrentStatus: true,
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
  [BlockType.LINK]: createLinkBlock,
  [BlockType.TEXT]: createTextBlock,
  [BlockType.DIVIDER]: createDividerBlock,
  [BlockType.SOCIAL_ICONS]: createSocialIconsBlock,
  // Phase 2 블록
  [BlockType.IMAGE]: createImageBlock,
  [BlockType.IMAGE_CAROUSEL]: createImageCarouselBlock,
  [BlockType.VIDEO]: createVideoBlock,
  [BlockType.FAQ_ACCORDION]: createFaqAccordionBlock,
  [BlockType.CONTACT_FORM]: createContactFormBlock,
  [BlockType.MAP]: createMapBlock,
  // Phase 3 블록 (SOFA 차별화)
  [BlockType.AI_CHAT_PREVIEW]: createAiChatPreviewBlock,
  [BlockType.KNOWLEDGE_BASE_LINK]: createKnowledgeBaseLinkBlock,
  [BlockType.FAQ_QUICK_ACTIONS]: createFaqQuickActionsBlock,
  [BlockType.CONVERSATION_STARTER]: createConversationStarterBlock,
  [BlockType.OPERATING_HOURS]: createOperatingHoursBlock,
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
 * - order 값을 0부터 연속된 값으로 재할당
 * - 배열의 현재 순서를 유지하고 order 값만 업데이트
 *
 * 주의: 이 함수는 배열을 정렬하지 않습니다.
 * 드래그앤드롭, 삭제 등의 작업 후 배열 순서가 이미 올바르게
 * 설정된 상태에서 호출되어야 합니다.
 */
export function normalizeBlockOrder(blocks: Block[]): Block[] {
  return blocks.map((block, index) => ({
    ...block,
    order: index,
  }));
}
