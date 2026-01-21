'use client';

import {
  useEffect,
  useRef,
  useCallback,
  useState,
  createContext,
  useContext,
  type ReactNode,
} from 'react';
import { toast } from 'sonner';
import { useConsole } from './use-console-state';
import { useIdleTimer } from './use-idle-timer';
import { useSaveWithRetry, type SaveError } from './use-save-with-retry';
import { AUTO_SAVE_CONFIG } from '../config/auto-save.config';
import type { PublicPageConfig } from '@/lib/public-page/types';

// SaveError 타입 re-export (하위 호환성)
export type { SaveError };

/**
 * 자동 저장 훅 옵션
 */
interface UseAutoSaveOptions {
  idleDelay?: number;
  minSaveInterval?: number;
  maxRetries?: number;
  autoRetry?: boolean;
  onSaveSuccess?: () => void;
  onSaveError?: (error: SaveError) => void;
}

/**
 * Idle 기반 자동 저장 훅
 *
 * 동작 방식:
 * 1. 변경 감지 → "unsaved" 상태로 마킹
 * 2. idleDelay 동안 추가 변경 없음 → 저장 실행
 * 3. 저장 후 minSaveInterval 동안 다음 저장 불가 (throttle)
 *
 * 자동 저장 비활성화 시:
 * - 변경 감지만 수행하고 저장은 수동으로만 가능
 *
 * 리팩토링: useIdleTimer + useSaveWithRetry 조합
 */
export function useAutoSave(options?: UseAutoSaveOptions) {
  const {
    idleDelay = AUTO_SAVE_CONFIG.idleDelay,
    minSaveInterval = AUTO_SAVE_CONFIG.minSaveInterval,
    maxRetries = AUTO_SAVE_CONFIG.maxRetries,
    autoRetry = AUTO_SAVE_CONFIG.autoRetry,
    onSaveSuccess,
    onSaveError,
  } = options ?? {};

  const {
    currentChatbot,
    pageConfig,
    originalPageConfig,
    saveStatus,
    setSaveStatus,
    setOriginalPageConfig,
  } = useConsole();

  // 자동 저장 활성화 상태 (localStorage에 저장)
  const [isAutoSaveEnabled, setIsAutoSaveEnabled] = useState(() => {
    if (typeof window === 'undefined') return AUTO_SAVE_CONFIG.defaultAutoSaveEnabled;
    const stored = localStorage.getItem('sofa-auto-save-enabled');
    return stored !== null ? stored === 'true' : AUTO_SAVE_CONFIG.defaultAutoSaveEnabled;
  });

  // Throttle 관리용 refs
  const lastSaveTimeRef = useRef<number>(0);
  const throttleTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 마지막 저장된 설정 (중복 저장 방지용)
  const lastSavedConfigRef = useRef<PublicPageConfig | null>(null);

  // 현재 pageConfig를 ref로 유지 (저장 함수에서 최신값 참조)
  const pageConfigRef = useRef(pageConfig);
  pageConfigRef.current = pageConfig;

  // 자동 저장 설정 변경 시 localStorage에 저장
  useEffect(() => {
    localStorage.setItem('sofa-auto-save-enabled', String(isAutoSaveEnabled));
  }, [isAutoSaveEnabled]);

  // Throttle 타이머 정리
  const clearThrottleTimer = useCallback(() => {
    if (throttleTimerRef.current) {
      clearTimeout(throttleTimerRef.current);
      throttleTimerRef.current = null;
    }
  }, []);

  // 저장 함수 (useSaveWithRetry에 전달)
  const saveFn = useCallback(async () => {
    if (!currentChatbot) {
      return { success: false, error: new Error('챗봇이 선택되지 않았습니다') };
    }

    const config = pageConfigRef.current;

    setSaveStatus('saving');

    const response = await fetch(
      `/api/chatbots/${currentChatbot.id}/public-page`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      setSaveStatus('error');
      throw new Error(errorData.message || '저장에 실패했습니다');
    }

    // 성공
    lastSavedConfigRef.current = config;
    lastSaveTimeRef.current = Date.now();
    setOriginalPageConfig(config);
    setSaveStatus('saved');

    return { success: true };
  }, [currentChatbot, setSaveStatus, setOriginalPageConfig]);

  // useSaveWithRetry 훅 사용
  const {
    save: executeSave,
    retry: executeRetry,
    clearError,
    error,
    isSaving,
  } = useSaveWithRetry(saveFn, {
    maxRetries,
    retryDelay: AUTO_SAVE_CONFIG.retryDelay,
    autoRetry,
    onSuccess: () => {
      toast.success('저장됨');
      onSaveSuccess?.();
    },
    onError: (saveError) => {
      toast.error('저장 실패', { description: saveError.message });
      onSaveError?.(saveError);
    },
  });

  // Throttle을 고려한 저장 실행
  const saveWithThrottle = useCallback(async () => {
    const now = Date.now();
    const timeSinceLastSave = now - lastSaveTimeRef.current;

    if (timeSinceLastSave < minSaveInterval && lastSaveTimeRef.current > 0) {
      // Throttle 시간이 지난 후 저장 스케줄
      clearThrottleTimer();
      const delay = minSaveInterval - timeSinceLastSave;
      throttleTimerRef.current = setTimeout(() => {
        executeSave();
      }, delay);
      return false;
    }

    return executeSave();
  }, [minSaveInterval, clearThrottleTimer, executeSave]);

  // Idle 타이머 훅 사용
  const { reset: resetIdleTimer, cancel: cancelIdleTimer } = useIdleTimer({
    delay: idleDelay,
    onIdle: saveWithThrottle,
    autoStart: false,
  });

  // 변경사항 존재 여부 계산
  const hasChanges =
    originalPageConfig !== null &&
    JSON.stringify(pageConfig) !== JSON.stringify(originalPageConfig);

  // pageConfig 변경 감지 및 Idle 저장 스케줄링
  useEffect(() => {
    // originalPageConfig가 없으면 아직 서버 데이터 로드 중
    if (!originalPageConfig) {
      return;
    }

    // 원본과 동일하면 스킵
    if (JSON.stringify(pageConfig) === JSON.stringify(originalPageConfig)) {
      // 저장 완료 후 unsaved 상태에서 saved로 변경
      if (saveStatus === 'unsaved') {
        setSaveStatus('saved');
      }
      return;
    }

    // 마지막 저장값과 동일하면 스킵
    if (
      lastSavedConfigRef.current &&
      JSON.stringify(pageConfig) === JSON.stringify(lastSavedConfigRef.current)
    ) {
      return;
    }

    // 상태를 unsaved로 변경
    setSaveStatus('unsaved');

    // 자동 저장이 비활성화되어 있으면 여기서 종료
    if (!isAutoSaveEnabled) {
      cancelIdleTimer();
      return;
    }

    // Idle 타이머 리셋 (새 변경 감지)
    resetIdleTimer();
  }, [
    pageConfig,
    originalPageConfig,
    isAutoSaveEnabled,
    resetIdleTimer,
    cancelIdleTimer,
    setSaveStatus,
    saveStatus,
  ]);

  // 컴포넌트 언마운트 시 정리
  useEffect(() => {
    return () => {
      cancelIdleTimer();
      clearThrottleTimer();
    };
  }, [cancelIdleTimer, clearThrottleTimer]);

  // 수동 저장 함수 (버튼 클릭 시)
  const saveNow = useCallback(async () => {
    cancelIdleTimer();
    clearThrottleTimer();
    // Throttle 무시하고 즉시 저장
    lastSaveTimeRef.current = 0;
    return executeSave();
  }, [cancelIdleTimer, clearThrottleTimer, executeSave]);

  // 수동 재시도 함수
  const retry = useCallback(() => {
    clearThrottleTimer();
    lastSaveTimeRef.current = 0;
    executeRetry();
  }, [clearThrottleTimer, executeRetry]);

  // 자동 저장 토글
  const toggleAutoSave = useCallback((enabled?: boolean) => {
    setIsAutoSaveEnabled((prev) => enabled ?? !prev);
  }, []);

  return {
    saveStatus,
    hasChanges,
    saveNow,
    error,
    retry,
    clearError,
    isAutoSaveEnabled,
    toggleAutoSave,
  };
}

// ============================================
// Context 기반 싱글톤 패턴
// ============================================

/**
 * AutoSave Context 값 타입
 */
interface AutoSaveContextValue {
  saveStatus: ReturnType<typeof useConsole>['saveStatus'];
  hasChanges: boolean;
  saveNow: () => Promise<boolean>;
  error: SaveError | null;
  retry: () => void;
  clearError: () => void;
  isAutoSaveEnabled: boolean;
  toggleAutoSave: (enabled?: boolean) => void;
}

const AutoSaveContext = createContext<AutoSaveContextValue | null>(null);

/**
 * AutoSave Provider Props
 */
interface AutoSaveProviderProps {
  children: ReactNode;
  /** 저장 성공 시 호출될 콜백 (버전 새로고침 등) */
  onSaveSuccess?: () => void;
}

/**
 * AutoSave Provider
 *
 * 자동 저장 로직을 단일 인스턴스로 관리합니다.
 * ConsoleShell에서 한 번만 래핑하면 됩니다.
 */
export function AutoSaveProvider({
  children,
  onSaveSuccess,
}: AutoSaveProviderProps) {
  const value = useAutoSave({ onSaveSuccess });

  return (
    <AutoSaveContext.Provider value={value}>
      {children}
    </AutoSaveContext.Provider>
  );
}

/**
 * AutoSave Context 소비 훅
 *
 * 저장 로직 없이 상태와 함수만 조회합니다.
 * 여러 컴포넌트에서 호출해도 중복 저장이 발생하지 않습니다.
 *
 * @throws AutoSaveProvider 외부에서 호출 시 에러
 */
export function useAutoSaveContext(): AutoSaveContextValue {
  const context = useContext(AutoSaveContext);
  if (!context) {
    throw new Error(
      'useAutoSaveContext must be used within AutoSaveProvider'
    );
  }
  return context;
}
