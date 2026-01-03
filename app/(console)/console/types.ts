import type { PublicPageConfig } from '@/lib/public-page/types';
import type { WidgetConfig } from '@/lib/widget/types';
import type { Tier } from '@/lib/tier/constants';
import type { TenantSettings } from '@/lib/tier/types';

// 챗봇 기본 정보 (목록용)
export interface ConsoleChatbot {
  id: string;
  name: string;
  slug: string | null;
  publicPageEnabled: boolean;
  publicPageConfig: PublicPageConfig;
  tenantId: string;
  // 위젯 관련 필드
  widgetEnabled: boolean;
  widgetApiKey: string | null;
  widgetConfig: WidgetConfig;
}

// 편집 모드
export type ConsoleMode = 'page' | 'widget';

// 저장 상태
export type SaveStatus = 'saved' | 'saving' | 'error' | 'unsaved';

// Context 상태 타입
export interface ConsoleState {
  // 모드
  mode: ConsoleMode;

  // 테넌트 설정 (티어 + 고급 모드)
  tier: Tier;
  tenantSettings: TenantSettings;
  isTenantLoading: boolean;

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

  // Page 저장 상태
  saveStatus: SaveStatus;

  // Widget 설정 (현재 선택된 챗봇의)
  widgetConfig: WidgetConfig;

  // Widget 원본 설정 (변경사항 비교용)
  originalWidgetConfig: WidgetConfig | null;

  // Widget 저장 상태 (분리 관리)
  widgetSaveStatus: SaveStatus;

  // 블록 에디터 상태
  selectedBlockId: string | null;
}

// Context 액션 타입
export interface ConsoleActions {
  setMode: (mode: ConsoleMode) => void;
  selectChatbot: (index: number) => void;
  selectChatbotById: (id: string) => void;
  navigateChatbot: (direction: 'prev' | 'next') => void;
  // 테넌트 설정 액션
  isAdvancedModeEnabled: () => boolean;
  canEnableAdvancedMode: () => boolean;
  setAdvancedMode: (enabled: boolean) => Promise<void>;
  // Page 설정 액션
  updatePageConfig: (partial: Partial<PublicPageConfig>) => void;
  updateHeaderConfig: (partial: Partial<PublicPageConfig['header']>) => void;
  updateThemeConfig: (partial: Partial<PublicPageConfig['theme']>) => void;
  updateSeoConfig: (partial: Partial<PublicPageConfig['seo']>) => void;
  updateChatbotConfig: (partial: Partial<PublicPageConfig['chatbot']>) => void;
  setSaveStatus: (status: SaveStatus) => void;
  setOriginalPageConfig: (config: PublicPageConfig) => void;
  // Widget 설정 액션
  updateWidgetConfig: (partial: Partial<WidgetConfig>) => void;
  updateWidgetTheme: (partial: Partial<WidgetConfig['theme']>) => void;
  setWidgetSaveStatus: (status: SaveStatus) => void;
  setOriginalWidgetConfig: (config: WidgetConfig) => void;
  // 블록 에디터 액션
  selectBlock: (id: string | null) => void;
  // 공통 액션
  reloadChatbots: () => Promise<void>;
}

// Context 전체 타입
export interface ConsoleContextValue extends ConsoleState, ConsoleActions {}
