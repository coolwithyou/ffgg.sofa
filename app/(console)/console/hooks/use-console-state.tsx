'use client';

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useMemo,
  type ReactNode,
} from 'react';
import {
  type ConsoleContextValue,
  type ConsoleChatbot,
  type ConsoleMode,
  type SaveStatus,
} from '../types';
import {
  DEFAULT_PUBLIC_PAGE_CONFIG,
  parsePublicPageConfig,
  type PublicPageConfig,
} from '@/lib/public-page/types';
import {
  DEFAULT_CONFIG as DEFAULT_WIDGET_CONFIG,
  parseWidgetConfig,
  type WidgetConfig,
} from '@/lib/widget/types';
import { type Tier } from '@/lib/tier/constants';
import {
  type TenantSettings,
  DEFAULT_TENANT_SETTINGS,
  canEnableAdvancedMode as checkCanEnableAdvancedMode,
} from '@/lib/tier/types';

// Context 생성
const ConsoleContext = createContext<ConsoleContextValue | null>(null);

// Provider Props
interface ConsoleProviderProps {
  children: ReactNode;
  initialChatbots?: ConsoleChatbot[];
}

// Provider 컴포넌트
export function ConsoleProvider({
  children,
  initialChatbots = [],
}: ConsoleProviderProps) {
  // 기본 상태
  const [mode, setMode] = useState<ConsoleMode>('page');
  const [chatbots, setChatbots] = useState<ConsoleChatbot[]>(initialChatbots);
  const [currentChatbotIndex, setCurrentChatbotIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(initialChatbots.length === 0);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');

  // Widget 저장 상태 (분리 관리)
  const [widgetSaveStatus, setWidgetSaveStatus] = useState<SaveStatus>('saved');

  // 블록 에디터 상태
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);

  // 테넌트 설정 상태
  const [tier, setTier] = useState<Tier>('basic');
  const [tenantSettings, setTenantSettings] = useState<TenantSettings>(
    DEFAULT_TENANT_SETTINGS
  );
  const [isTenantLoading, setIsTenantLoading] = useState(true);

  // 현재 챗봇 (파생 상태)
  const currentChatbot = useMemo(
    () => chatbots[currentChatbotIndex] ?? null,
    [chatbots, currentChatbotIndex]
  );

  // Page 설정 (현재 챗봇 기준)
  const [pageConfig, setPageConfig] = useState<PublicPageConfig>(
    currentChatbot?.publicPageConfig ?? DEFAULT_PUBLIC_PAGE_CONFIG
  );

  // 원본 설정 (변경사항 비교용)
  const [originalPageConfig, setOriginalPageConfig] =
    useState<PublicPageConfig | null>(null);

  // Widget 설정 (현재 챗봇 기준)
  const [widgetConfig, setWidgetConfig] = useState<WidgetConfig>(
    currentChatbot?.widgetConfig ?? { ...DEFAULT_WIDGET_CONFIG, tenantId: '' }
  );

  // Widget 원본 설정 (변경사항 비교용)
  const [originalWidgetConfig, setOriginalWidgetConfig] =
    useState<WidgetConfig | null>(null);

  // 챗봇 변경 시 설정 동기화
  useEffect(() => {
    if (currentChatbot) {
      // Page 설정 동기화
      setPageConfig(currentChatbot.publicPageConfig);
      setOriginalPageConfig(currentChatbot.publicPageConfig);
      setSaveStatus('saved');

      // Widget 설정 동기화
      setWidgetConfig(currentChatbot.widgetConfig);
      setOriginalWidgetConfig(currentChatbot.widgetConfig);
      setWidgetSaveStatus('saved');

      // 블록 선택 초기화
      setSelectedBlockId(null);
    }
  }, [currentChatbot]);

  // 챗봇 목록 로드
  const reloadChatbots = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/chatbots');
      if (!res.ok) throw new Error('Failed to fetch chatbots');
      const data = await res.json();

      // API 응답을 ConsoleChatbot 형태로 변환
      const mapped: ConsoleChatbot[] = data.chatbots.map((bot: any) => ({
        id: bot.id,
        name: bot.name,
        slug: bot.slug,
        publicPageEnabled: bot.publicPageEnabled ?? false,
        publicPageConfig: parsePublicPageConfig(bot.publicPageConfig),
        tenantId: bot.tenantId,
        // Widget 관련 필드
        widgetEnabled: bot.widgetEnabled ?? false,
        widgetApiKey: bot.widgetApiKey ?? null,
        widgetConfig: parseWidgetConfig(bot.widgetConfig, bot.tenantId),
      }));

      setChatbots(mapped);
      if (currentChatbotIndex >= mapped.length) {
        setCurrentChatbotIndex(0);
      }
    } catch (error) {
      console.error('Failed to load chatbots:', error);
    } finally {
      setIsLoading(false);
    }
  }, [currentChatbotIndex]);

  // 초기 로드
  useEffect(() => {
    if (initialChatbots.length === 0) {
      reloadChatbots();
    }
  }, [initialChatbots.length, reloadChatbots]);

  // 테넌트 설정 로드
  const loadTenantSettings = useCallback(async () => {
    setIsTenantLoading(true);
    try {
      const res = await fetch('/api/tenants/settings');
      if (!res.ok) throw new Error('Failed to fetch tenant settings');
      const data = await res.json();
      setTier(data.tier || 'basic');
      setTenantSettings(data.settings || DEFAULT_TENANT_SETTINGS);
    } catch (error) {
      console.error('Failed to load tenant settings:', error);
    } finally {
      setIsTenantLoading(false);
    }
  }, []);

  // 테넌트 설정 초기 로드
  useEffect(() => {
    loadTenantSettings();
  }, [loadTenantSettings]);

  // 고급 모드 활성화 여부 확인
  const isAdvancedModeEnabled = useCallback(() => {
    return tenantSettings.advancedDatasetMode === true;
  }, [tenantSettings]);

  // 고급 모드 활성화 가능 여부 (티어 기반)
  const canEnableAdvancedMode = useCallback(() => {
    return checkCanEnableAdvancedMode(tier);
  }, [tier]);

  // 고급 모드 설정
  const setAdvancedMode = useCallback(
    async (enabled: boolean) => {
      // Premium 아닌 경우 활성화 불가
      if (enabled && !checkCanEnableAdvancedMode(tier)) {
        console.warn('Advanced mode is only available for premium tier');
        return;
      }

      try {
        const res = await fetch('/api/tenants/settings', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ advancedDatasetMode: enabled }),
        });

        if (!res.ok) throw new Error('Failed to update settings');

        setTenantSettings((prev) => ({
          ...prev,
          advancedDatasetMode: enabled,
        }));
      } catch (error) {
        console.error('Failed to set advanced mode:', error);
        throw error;
      }
    },
    [tier]
  );

  // 챗봇 선택 (인덱스)
  const selectChatbot = useCallback(
    (index: number) => {
      if (index >= 0 && index < chatbots.length) {
        setCurrentChatbotIndex(index);
      }
    },
    [chatbots.length]
  );

  // 챗봇 선택 (ID)
  const selectChatbotById = useCallback(
    (id: string) => {
      const index = chatbots.findIndex((bot) => bot.id === id);
      if (index !== -1) {
        setCurrentChatbotIndex(index);
      }
    },
    [chatbots]
  );

  // 챗봇 네비게이션 (캐러셀용)
  const navigateChatbot = useCallback(
    (direction: 'prev' | 'next') => {
      if (chatbots.length === 0) return;

      setCurrentChatbotIndex((prev) => {
        if (direction === 'prev') {
          return prev > 0 ? prev - 1 : chatbots.length - 1;
        } else {
          return prev < chatbots.length - 1 ? prev + 1 : 0;
        }
      });
    },
    [chatbots.length]
  );

  // Page 설정 업데이트
  const updatePageConfig = useCallback(
    (partial: Partial<PublicPageConfig>) => {
      setPageConfig((prev) => ({ ...prev, ...partial }));
      setSaveStatus('unsaved');
    },
    []
  );

  const updateHeaderConfig = useCallback(
    (partial: Partial<PublicPageConfig['header']>) => {
      setPageConfig((prev) => ({
        ...prev,
        header: { ...prev.header, ...partial },
      }));
      setSaveStatus('unsaved');
    },
    []
  );

  const updateThemeConfig = useCallback(
    (partial: Partial<PublicPageConfig['theme']>) => {
      setPageConfig((prev) => ({
        ...prev,
        theme: { ...prev.theme, ...partial },
      }));
      setSaveStatus('unsaved');
    },
    []
  );

  const updateSeoConfig = useCallback(
    (partial: Partial<PublicPageConfig['seo']>) => {
      setPageConfig((prev) => ({
        ...prev,
        seo: { ...prev.seo, ...partial },
      }));
      setSaveStatus('unsaved');
    },
    []
  );

  const updateChatbotConfig = useCallback(
    (partial: Partial<PublicPageConfig['chatbot']>) => {
      setPageConfig((prev) => ({
        ...prev,
        chatbot: { ...prev.chatbot, ...partial },
      }));
      setSaveStatus('unsaved');
    },
    []
  );

  // Widget 설정 업데이트
  const updateWidgetConfig = useCallback(
    (partial: Partial<WidgetConfig>) => {
      setWidgetConfig((prev) => ({ ...prev, ...partial }));
      setWidgetSaveStatus('unsaved');
    },
    []
  );

  const updateWidgetTheme = useCallback(
    (partial: Partial<WidgetConfig['theme']>) => {
      setWidgetConfig((prev) => ({
        ...prev,
        theme: { ...prev.theme, ...partial },
      }));
      setWidgetSaveStatus('unsaved');
    },
    []
  );

  // 블록 선택
  const selectBlock = useCallback((id: string | null) => {
    setSelectedBlockId(id);
  }, []);

  // Context 값
  const value: ConsoleContextValue = useMemo(
    () => ({
      // 상태
      mode,
      chatbots,
      currentChatbotIndex,
      currentChatbot,
      isLoading,
      pageConfig,
      originalPageConfig,
      saveStatus,
      // 테넌트 상태
      tier,
      tenantSettings,
      isTenantLoading,
      // Widget 상태
      widgetConfig,
      originalWidgetConfig,
      widgetSaveStatus,
      // 블록 에디터 상태
      selectedBlockId,
      // 액션
      setMode,
      selectChatbot,
      selectChatbotById,
      navigateChatbot,
      // 테넌트 설정 액션
      isAdvancedModeEnabled,
      canEnableAdvancedMode,
      setAdvancedMode,
      // Page 설정 액션
      updatePageConfig,
      updateHeaderConfig,
      updateThemeConfig,
      updateSeoConfig,
      updateChatbotConfig,
      setSaveStatus,
      setOriginalPageConfig,
      // Widget 액션
      updateWidgetConfig,
      updateWidgetTheme,
      setWidgetSaveStatus,
      setOriginalWidgetConfig,
      // 블록 에디터 액션
      selectBlock,
      // 공통 액션
      reloadChatbots,
    }),
    [
      mode,
      chatbots,
      currentChatbotIndex,
      currentChatbot,
      isLoading,
      pageConfig,
      originalPageConfig,
      saveStatus,
      tier,
      tenantSettings,
      isTenantLoading,
      widgetConfig,
      originalWidgetConfig,
      widgetSaveStatus,
      selectedBlockId,
      selectChatbot,
      selectChatbotById,
      navigateChatbot,
      isAdvancedModeEnabled,
      canEnableAdvancedMode,
      setAdvancedMode,
      updatePageConfig,
      updateHeaderConfig,
      updateThemeConfig,
      updateSeoConfig,
      updateChatbotConfig,
      updateWidgetConfig,
      updateWidgetTheme,
      selectBlock,
      reloadChatbots,
    ]
  );

  return (
    <ConsoleContext.Provider value={value}>{children}</ConsoleContext.Provider>
  );
}

// 커스텀 훅
export function useConsole(): ConsoleContextValue {
  const context = useContext(ConsoleContext);
  if (!context) {
    throw new Error('useConsole must be used within ConsoleProvider');
  }
  return context;
}

// 선택적 훅 (하위 컴포넌트용)
export function useConsoleMode() {
  const { mode, setMode } = useConsole();
  return { mode, setMode };
}

export function useCurrentChatbot() {
  const {
    currentChatbot,
    currentChatbotIndex,
    chatbots,
    selectChatbot,
    selectChatbotById,
    navigateChatbot,
  } = useConsole();
  return {
    currentChatbot,
    currentChatbotIndex,
    chatbots,
    selectChatbot,
    selectChatbotById,
    navigateChatbot,
  };
}

export function usePageConfig() {
  const {
    pageConfig,
    updatePageConfig,
    updateHeaderConfig,
    updateThemeConfig,
    updateSeoConfig,
    updateChatbotConfig,
  } = useConsole();
  return {
    pageConfig,
    updatePageConfig,
    updateHeaderConfig,
    updateThemeConfig,
    updateSeoConfig,
    updateChatbotConfig,
  };
}

export function useSaveStatus() {
  const { saveStatus, setSaveStatus } = useConsole();
  return { saveStatus, setSaveStatus };
}

export function useWidgetConfig() {
  const {
    widgetConfig,
    originalWidgetConfig,
    widgetSaveStatus,
    updateWidgetConfig,
    updateWidgetTheme,
    setWidgetSaveStatus,
    setOriginalWidgetConfig,
  } = useConsole();
  return {
    widgetConfig,
    originalWidgetConfig,
    widgetSaveStatus,
    updateWidgetConfig,
    updateWidgetTheme,
    setWidgetSaveStatus,
    setOriginalWidgetConfig,
  };
}

export function useTenantSettings() {
  const {
    tier,
    tenantSettings,
    isTenantLoading,
    isAdvancedModeEnabled,
    canEnableAdvancedMode,
    setAdvancedMode,
  } = useConsole();
  return {
    tier,
    tenantSettings,
    isTenantLoading,
    isAdvancedModeEnabled,
    canEnableAdvancedMode,
    setAdvancedMode,
  };
}
