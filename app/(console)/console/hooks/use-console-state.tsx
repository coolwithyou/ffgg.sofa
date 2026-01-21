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
  type UIState,
  type ChatbotListState,
  type TenantState,
  type PageEditorState,
  type WidgetEditorState,
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
import { type Tier, normalizeTier } from '@/lib/tier/constants';
import {
  type TenantSettings,
  DEFAULT_TENANT_SETTINGS,
  canEnableAdvancedMode as checkCanEnableAdvancedMode,
} from '@/lib/tier/types';

// ============================================================
// Context 생성
// ============================================================

const ConsoleContext = createContext<ConsoleContextValue | null>(null);

// ============================================================
// 초기 상태 정의
// ============================================================

const INITIAL_UI_STATE: UIState = {
  mode: 'page',
  selectedBlockId: null,
  isCreateDialogOpen: false,
};

const createInitialChatbotState = (
  initialChatbots: ConsoleChatbot[]
): ChatbotListState => ({
  chatbots: initialChatbots,
  currentChatbotIndex: 0,
  isLoading: initialChatbots.length === 0,
});

const INITIAL_TENANT_STATE: TenantState = {
  tier: 'free',
  tenantSettings: DEFAULT_TENANT_SETTINGS,
  isLoading: true,
};

const INITIAL_PAGE_EDITOR_STATE: PageEditorState = {
  config: DEFAULT_PUBLIC_PAGE_CONFIG,
  originalConfig: null,
  saveStatus: 'saved',
};

const createInitialWidgetState = (): WidgetEditorState => ({
  config: { ...DEFAULT_WIDGET_CONFIG, tenantId: '' },
  originalConfig: null,
  saveStatus: 'saved',
});

// ============================================================
// Provider Props
// ============================================================

interface ConsoleProviderProps {
  children: ReactNode;
  initialChatbots?: ConsoleChatbot[];
}

// ============================================================
// Provider 컴포넌트
// ============================================================

export function ConsoleProvider({
  children,
  initialChatbots = [],
}: ConsoleProviderProps) {
  // ────────────────────────────────────────────────────────────
  // 도메인별 상태 (5개의 그룹화된 useState)
  // ────────────────────────────────────────────────────────────

  const [uiState, setUIState] = useState<UIState>(INITIAL_UI_STATE);

  const [chatbotState, setChatbotState] = useState<ChatbotListState>(() =>
    createInitialChatbotState(initialChatbots)
  );

  const [tenantState, setTenantState] =
    useState<TenantState>(INITIAL_TENANT_STATE);

  const [pageEditor, setPageEditor] = useState<PageEditorState>(
    INITIAL_PAGE_EDITOR_STATE
  );

  const [widgetEditor, setWidgetEditor] = useState<WidgetEditorState>(
    createInitialWidgetState
  );

  // ────────────────────────────────────────────────────────────
  // 파생 상태
  // ────────────────────────────────────────────────────────────

  const currentChatbot = useMemo(
    () => chatbotState.chatbots[chatbotState.currentChatbotIndex] ?? null,
    [chatbotState.chatbots, chatbotState.currentChatbotIndex]
  );

  // ────────────────────────────────────────────────────────────
  // 챗봇 변경 시 설정 동기화
  // ────────────────────────────────────────────────────────────

  useEffect(() => {
    if (currentChatbot) {
      // Page 설정 동기화
      setPageEditor({
        config: currentChatbot.publicPageConfig,
        originalConfig: currentChatbot.publicPageConfig,
        saveStatus: 'saved',
      });

      // Widget 설정 동기화
      setWidgetEditor({
        config: currentChatbot.widgetConfig,
        originalConfig: currentChatbot.widgetConfig,
        saveStatus: 'saved',
      });

      // 블록 선택 초기화
      setUIState((prev) => ({ ...prev, selectedBlockId: null }));
    }
  }, [currentChatbot]);

  // ────────────────────────────────────────────────────────────
  // 챗봇 목록 액션
  // ────────────────────────────────────────────────────────────

  const reloadChatbots = useCallback(async () => {
    setChatbotState((prev) => ({ ...prev, isLoading: true }));
    try {
      const res = await fetch('/api/chatbots');
      if (!res.ok) throw new Error('Failed to fetch chatbots');
      const data = await res.json();

      const mapped: ConsoleChatbot[] = data.chatbots.map((bot: any) => ({
        id: bot.id,
        name: bot.name,
        slug: bot.slug,
        publicPageEnabled: bot.publicPageEnabled ?? false,
        publicPageConfig: parsePublicPageConfig(bot.publicPageConfig),
        tenantId: bot.tenantId,
        widgetEnabled: bot.widgetEnabled ?? false,
        widgetApiKey: bot.widgetApiKey ?? null,
        widgetConfig: parseWidgetConfig(bot.widgetConfig, bot.tenantId),
      }));

      setChatbotState((prev) => ({
        chatbots: mapped,
        currentChatbotIndex:
          prev.currentChatbotIndex >= mapped.length
            ? 0
            : prev.currentChatbotIndex,
        isLoading: false,
      }));
    } catch (error) {
      console.error('Failed to load chatbots:', error);
      setChatbotState((prev) => ({ ...prev, isLoading: false }));
    }
  }, []);

  // 초기 로드
  useEffect(() => {
    if (initialChatbots.length === 0) {
      reloadChatbots();
    }
  }, [initialChatbots.length, reloadChatbots]);

  // ────────────────────────────────────────────────────────────
  // 테넌트 설정 액션
  // ────────────────────────────────────────────────────────────

  const loadTenantSettings = useCallback(async () => {
    setTenantState((prev) => ({ ...prev, isLoading: true }));
    try {
      const res = await fetch('/api/tenants/settings');
      if (!res.ok) throw new Error('Failed to fetch tenant settings');
      const data = await res.json();
      setTenantState({
        tier: normalizeTier(data.tier),
        tenantSettings: data.settings || DEFAULT_TENANT_SETTINGS,
        isLoading: false,
      });
    } catch (error) {
      console.error('Failed to load tenant settings:', error);
      setTenantState((prev) => ({ ...prev, isLoading: false }));
    }
  }, []);

  // 테넌트 설정 초기 로드
  useEffect(() => {
    loadTenantSettings();
  }, [loadTenantSettings]);

  const refreshTier = useCallback(async () => {
    await loadTenantSettings();
  }, [loadTenantSettings]);

  const isAdvancedModeEnabled = useCallback(() => {
    return tenantState.tenantSettings.advancedDatasetMode === true;
  }, [tenantState.tenantSettings]);

  const canEnableAdvancedMode = useCallback(() => {
    return checkCanEnableAdvancedMode(tenantState.tier);
  }, [tenantState.tier]);

  const setAdvancedMode = useCallback(
    async (enabled: boolean) => {
      if (enabled && !checkCanEnableAdvancedMode(tenantState.tier)) {
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

        setTenantState((prev) => ({
          ...prev,
          tenantSettings: {
            ...prev.tenantSettings,
            advancedDatasetMode: enabled,
          },
        }));
      } catch (error) {
        console.error('Failed to set advanced mode:', error);
        throw error;
      }
    },
    [tenantState.tier]
  );

  // ────────────────────────────────────────────────────────────
  // 챗봇 선택 액션
  // ────────────────────────────────────────────────────────────

  const selectChatbot = useCallback(
    (index: number) => {
      if (index >= 0 && index < chatbotState.chatbots.length) {
        setChatbotState((prev) => ({ ...prev, currentChatbotIndex: index }));
      }
    },
    [chatbotState.chatbots.length]
  );

  const selectChatbotById = useCallback(
    (id: string) => {
      const index = chatbotState.chatbots.findIndex((bot) => bot.id === id);
      if (index !== -1) {
        setChatbotState((prev) => ({ ...prev, currentChatbotIndex: index }));
      }
    },
    [chatbotState.chatbots]
  );

  const navigateChatbot = useCallback(
    (direction: 'prev' | 'next') => {
      if (chatbotState.chatbots.length === 0) return;

      setChatbotState((prev) => {
        const newIndex =
          direction === 'prev'
            ? prev.currentChatbotIndex > 0
              ? prev.currentChatbotIndex - 1
              : prev.chatbots.length - 1
            : prev.currentChatbotIndex < prev.chatbots.length - 1
              ? prev.currentChatbotIndex + 1
              : 0;
        return { ...prev, currentChatbotIndex: newIndex };
      });
    },
    [chatbotState.chatbots.length]
  );

  // ────────────────────────────────────────────────────────────
  // UI 상태 액션
  // ────────────────────────────────────────────────────────────

  const setMode = useCallback((mode: ConsoleMode) => {
    setUIState((prev) => ({ ...prev, mode }));
  }, []);

  const selectBlock = useCallback((id: string | null) => {
    setUIState((prev) => ({ ...prev, selectedBlockId: id }));
  }, []);

  const openCreateDialog = useCallback(() => {
    setUIState((prev) => ({ ...prev, isCreateDialogOpen: true }));
  }, []);

  const closeCreateDialog = useCallback(() => {
    setUIState((prev) => ({ ...prev, isCreateDialogOpen: false }));
  }, []);

  // ────────────────────────────────────────────────────────────
  // Page 설정 액션
  // ────────────────────────────────────────────────────────────

  const updatePageConfig = useCallback(
    (
      partialOrUpdater:
        | Partial<PublicPageConfig>
        | ((prev: PublicPageConfig) => Partial<PublicPageConfig>)
    ) => {
      setPageEditor((prev) => {
        const partial =
          typeof partialOrUpdater === 'function'
            ? partialOrUpdater(prev.config)
            : partialOrUpdater;
        return {
          ...prev,
          config: { ...prev.config, ...partial },
          saveStatus: 'unsaved',
        };
      });
    },
    []
  );

  const updateHeaderConfig = useCallback(
    (partial: Partial<PublicPageConfig['header']>) => {
      setPageEditor((prev) => ({
        ...prev,
        config: { ...prev.config, header: { ...prev.config.header, ...partial } },
        saveStatus: 'unsaved',
      }));
    },
    []
  );

  const updateThemeConfig = useCallback(
    (partial: Partial<PublicPageConfig['theme']>) => {
      setPageEditor((prev) => ({
        ...prev,
        config: { ...prev.config, theme: { ...prev.config.theme, ...partial } },
        saveStatus: 'unsaved',
      }));
    },
    []
  );

  const updateSeoConfig = useCallback(
    (partial: Partial<PublicPageConfig['seo']>) => {
      setPageEditor((prev) => ({
        ...prev,
        config: { ...prev.config, seo: { ...prev.config.seo, ...partial } },
        saveStatus: 'unsaved',
      }));
    },
    []
  );

  const updateChatbotConfig = useCallback(
    (partial: Partial<PublicPageConfig['chatbot']>) => {
      setPageEditor((prev) => ({
        ...prev,
        config: {
          ...prev.config,
          chatbot: { ...prev.config.chatbot, ...partial },
        },
        saveStatus: 'unsaved',
      }));
    },
    []
  );

  const setSaveStatus = useCallback((status: SaveStatus) => {
    setPageEditor((prev) => ({ ...prev, saveStatus: status }));
  }, []);

  const setOriginalPageConfig = useCallback((config: PublicPageConfig) => {
    setPageEditor((prev) => ({ ...prev, originalConfig: config }));
  }, []);

  // ────────────────────────────────────────────────────────────
  // Widget 설정 액션
  // ────────────────────────────────────────────────────────────

  const updateWidgetConfig = useCallback((partial: Partial<WidgetConfig>) => {
    setWidgetEditor((prev) => ({
      ...prev,
      config: { ...prev.config, ...partial },
      saveStatus: 'unsaved',
    }));
  }, []);

  const updateWidgetTheme = useCallback(
    (partial: Partial<WidgetConfig['theme']>) => {
      setWidgetEditor((prev) => ({
        ...prev,
        config: { ...prev.config, theme: { ...prev.config.theme, ...partial } },
        saveStatus: 'unsaved',
      }));
    },
    []
  );

  const setWidgetSaveStatus = useCallback((status: SaveStatus) => {
    setWidgetEditor((prev) => ({ ...prev, saveStatus: status }));
  }, []);

  const setOriginalWidgetConfig = useCallback((config: WidgetConfig) => {
    setWidgetEditor((prev) => ({ ...prev, originalConfig: config }));
  }, []);

  // ────────────────────────────────────────────────────────────
  // Context 값 (외부 API - 하위 호환성 유지)
  // ────────────────────────────────────────────────────────────

  const value: ConsoleContextValue = useMemo(
    () => ({
      // UI 상태 (펼쳐서 전달)
      mode: uiState.mode,
      selectedBlockId: uiState.selectedBlockId,
      isCreateDialogOpen: uiState.isCreateDialogOpen,

      // 챗봇 상태 (펼쳐서 전달)
      chatbots: chatbotState.chatbots,
      currentChatbotIndex: chatbotState.currentChatbotIndex,
      isLoading: chatbotState.isLoading,
      currentChatbot,

      // 테넌트 상태 (펼쳐서 전달)
      tier: tenantState.tier,
      tenantSettings: tenantState.tenantSettings,
      isTenantLoading: tenantState.isLoading,

      // Page 에디터 상태 (펼쳐서 전달)
      pageConfig: pageEditor.config,
      originalPageConfig: pageEditor.originalConfig,
      saveStatus: pageEditor.saveStatus,

      // Widget 에디터 상태 (펼쳐서 전달)
      widgetConfig: widgetEditor.config,
      originalWidgetConfig: widgetEditor.originalConfig,
      widgetSaveStatus: widgetEditor.saveStatus,

      // 모든 액션
      setMode,
      selectChatbot,
      selectChatbotById,
      navigateChatbot,
      refreshTier,
      isAdvancedModeEnabled,
      canEnableAdvancedMode,
      setAdvancedMode,
      updatePageConfig,
      updateHeaderConfig,
      updateThemeConfig,
      updateSeoConfig,
      updateChatbotConfig,
      setSaveStatus,
      setOriginalPageConfig,
      updateWidgetConfig,
      updateWidgetTheme,
      setWidgetSaveStatus,
      setOriginalWidgetConfig,
      selectBlock,
      openCreateDialog,
      closeCreateDialog,
      reloadChatbots,
    }),
    [
      // 도메인 상태 객체 (5개)
      uiState,
      chatbotState,
      tenantState,
      pageEditor,
      widgetEditor,
      currentChatbot,
      // 액션 함수들 (useCallback으로 안정적)
      setMode,
      selectChatbot,
      selectChatbotById,
      navigateChatbot,
      refreshTier,
      isAdvancedModeEnabled,
      canEnableAdvancedMode,
      setAdvancedMode,
      updatePageConfig,
      updateHeaderConfig,
      updateThemeConfig,
      updateSeoConfig,
      updateChatbotConfig,
      setSaveStatus,
      setOriginalPageConfig,
      updateWidgetConfig,
      updateWidgetTheme,
      setWidgetSaveStatus,
      setOriginalWidgetConfig,
      selectBlock,
      openCreateDialog,
      closeCreateDialog,
      reloadChatbots,
    ]
  );

  return (
    <ConsoleContext.Provider value={value}>{children}</ConsoleContext.Provider>
  );
}

// ============================================================
// 커스텀 훅
// ============================================================

export function useConsole(): ConsoleContextValue {
  const context = useContext(ConsoleContext);
  if (!context) {
    throw new Error('useConsole must be used within ConsoleProvider');
  }
  return context;
}

// ============================================================
// 선택적 훅 (하위 컴포넌트용 - 세분화된 구독)
// ============================================================

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
    refreshTier,
    isAdvancedModeEnabled,
    canEnableAdvancedMode,
    setAdvancedMode,
  } = useConsole();
  return {
    tier,
    tenantSettings,
    isTenantLoading,
    refreshTier,
    isAdvancedModeEnabled,
    canEnableAdvancedMode,
    setAdvancedMode,
  };
}

export function useCreateChatbotDialog() {
  const { isCreateDialogOpen, openCreateDialog, closeCreateDialog } =
    useConsole();
  return {
    isOpen: isCreateDialogOpen,
    open: openCreateDialog,
    close: closeCreateDialog,
  };
}
