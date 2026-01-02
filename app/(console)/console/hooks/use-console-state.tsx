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

  // 챗봇 변경 시 설정 동기화
  useEffect(() => {
    if (currentChatbot) {
      setPageConfig(currentChatbot.publicPageConfig);
      setOriginalPageConfig(currentChatbot.publicPageConfig);
      setSaveStatus('saved');
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

  // 챗봇 선택
  const selectChatbot = useCallback(
    (index: number) => {
      if (index >= 0 && index < chatbots.length) {
        setCurrentChatbotIndex(index);
      }
    },
    [chatbots.length]
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
      // 액션
      setMode,
      selectChatbot,
      navigateChatbot,
      updatePageConfig,
      updateHeaderConfig,
      updateThemeConfig,
      updateSeoConfig,
      setSaveStatus,
      setOriginalPageConfig,
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
      selectChatbot,
      navigateChatbot,
      updatePageConfig,
      updateHeaderConfig,
      updateThemeConfig,
      updateSeoConfig,
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
  const { currentChatbot, currentChatbotIndex, chatbots, selectChatbot, navigateChatbot } =
    useConsole();
  return { currentChatbot, currentChatbotIndex, chatbots, selectChatbot, navigateChatbot };
}

export function usePageConfig() {
  const {
    pageConfig,
    updatePageConfig,
    updateHeaderConfig,
    updateThemeConfig,
    updateSeoConfig,
  } = useConsole();
  return {
    pageConfig,
    updatePageConfig,
    updateHeaderConfig,
    updateThemeConfig,
    updateSeoConfig,
  };
}

export function useSaveStatus() {
  const { saveStatus, setSaveStatus } = useConsole();
  return { saveStatus, setSaveStatus };
}
