import type { PublicPageConfig } from '@/lib/public-page/types';

// 챗봇 기본 정보 (목록용)
export interface ConsoleChatbot {
  id: string;
  name: string;
  slug: string | null;
  publicPageEnabled: boolean;
  publicPageConfig: PublicPageConfig;
  tenantId: string;
}

// 편집 모드
export type ConsoleMode = 'page' | 'widget';

// 저장 상태
export type SaveStatus = 'saved' | 'saving' | 'error' | 'unsaved';

// Context 상태 타입
export interface ConsoleState {
  // 모드
  mode: ConsoleMode;

  // 챗봇
  chatbots: ConsoleChatbot[];
  currentChatbotIndex: number;
  isLoading: boolean;

  // 파생 상태 (getter)
  currentChatbot: ConsoleChatbot | null;

  // Page 설정 (현재 선택된 챗봇의)
  pageConfig: PublicPageConfig;

  // 원본 설정 (변경사항 비교용)
  originalPageConfig: PublicPageConfig | null;

  // 저장 상태
  saveStatus: SaveStatus;
}

// Context 액션 타입
export interface ConsoleActions {
  setMode: (mode: ConsoleMode) => void;
  selectChatbot: (index: number) => void;
  navigateChatbot: (direction: 'prev' | 'next') => void;
  updatePageConfig: (partial: Partial<PublicPageConfig>) => void;
  updateHeaderConfig: (partial: Partial<PublicPageConfig['header']>) => void;
  updateThemeConfig: (partial: Partial<PublicPageConfig['theme']>) => void;
  updateSeoConfig: (partial: Partial<PublicPageConfig['seo']>) => void;
  setSaveStatus: (status: SaveStatus) => void;
  setOriginalPageConfig: (config: PublicPageConfig) => void;
  reloadChatbots: () => Promise<void>;
}

// Context 전체 타입
export interface ConsoleContextValue extends ConsoleState, ConsoleActions {}
