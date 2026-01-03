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
import { useDebouncedCallback } from 'use-debounce';
import { toast } from 'sonner';
import { useConsole } from './use-console-state';
import { AUTO_SAVE_CONFIG } from '../config/auto-save.config';
import type { PublicPageConfig } from '@/lib/public-page/types';

/**
 * 에러 상태 타입
 */
export interface SaveError {
  message: string;
  code?: string;
  retryCount: number;
  canRetry: boolean;
  timestamp: Date;
}

/**
 * 자동 저장 훅 옵션
 *
 * 기본 설정을 오버라이드할 수 있습니다.
 */
interface UseAutoSaveOptions {
  debounceDelay?: number;
  maxRetries?: number;
  autoRetry?: boolean;
  onSaveSuccess?: () => void;
  onSaveError?: (error: SaveError) => void;
}

/**
 * 자동 저장 훅
 *
 * pageConfig 변경 시 설정된 debounce 시간 후 API 호출
 * 실패 시 자동 재시도 및 에러 상태 관리
 */
export function useAutoSave(options?: UseAutoSaveOptions) {
  const {
    debounceDelay = AUTO_SAVE_CONFIG.debounceDelay,
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

  // 에러 상태 관리
  const [error, setError] = useState<SaveError | null>(null);
  const retryCountRef = useRef(0);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 마지막 저장된 설정 (중복 저장 방지용)
  const lastSavedConfig = useRef<PublicPageConfig | null>(null);

  // 재시도 타이머 정리
  const clearRetryTimeout = useCallback(() => {
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
  }, []);

  // 에러 초기화
  const clearError = useCallback(() => {
    setError(null);
    retryCountRef.current = 0;
    clearRetryTimeout();
  }, [clearRetryTimeout]);

  // 저장 API 호출
  const saveToServer = useCallback(
    async (config: PublicPageConfig, isRetry = false) => {
      if (!currentChatbot) return;

      try {
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
          throw new Error(errorData.message || '저장에 실패했습니다');
        }

        // 성공
        lastSavedConfig.current = config;
        setOriginalPageConfig(config);
        setSaveStatus('saved');
        clearError();
        toast.success('저장됨');
        onSaveSuccess?.();
      } catch (err) {
        console.error('Auto save failed:', err);

        const errorMessage =
          err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다';
        const canRetry = retryCountRef.current < maxRetries;

        const saveError: SaveError = {
          message: errorMessage,
          code: err instanceof Error ? (err as any).code : undefined,
          retryCount: retryCountRef.current,
          canRetry,
          timestamp: new Date(),
        };

        setError(saveError);
        setSaveStatus('error');
        toast.error('저장 실패', { description: errorMessage });
        onSaveError?.(saveError);

        // 자동 재시도
        if (autoRetry && canRetry && !isRetry) {
          retryCountRef.current += 1;
          retryTimeoutRef.current = setTimeout(() => {
            saveToServer(config, true);
          }, AUTO_SAVE_CONFIG.retryDelay);
        }
      }
    },
    [
      currentChatbot,
      setSaveStatus,
      setOriginalPageConfig,
      clearError,
      maxRetries,
      autoRetry,
      onSaveSuccess,
      onSaveError,
    ]
  );

  // 디바운스된 저장 함수 (설정 가능한 delay)
  const debouncedSave = useDebouncedCallback(saveToServer, debounceDelay);

  // pageConfig 변경 감지 및 저장
  useEffect(() => {
    // originalPageConfig가 없으면 아직 서버 데이터 로드 중 → 저장 스킵
    // (서버에서 로드된 원본이 없으면 비교 기준이 없음)
    if (!originalPageConfig) {
      return;
    }

    // 원본과 동일하면 스킵 (실제 사용자 변경 없음)
    if (JSON.stringify(pageConfig) === JSON.stringify(originalPageConfig)) {
      return;
    }

    // 마지막 저장값과 동일하면 스킵 (중복 저장 방지)
    if (
      lastSavedConfig.current &&
      JSON.stringify(pageConfig) === JSON.stringify(lastSavedConfig.current)
    ) {
      return;
    }

    // 상태를 unsaved로 변경 후 디바운스 저장
    setSaveStatus('unsaved');
    debouncedSave(pageConfig);
  }, [pageConfig, originalPageConfig, debouncedSave, setSaveStatus]);

  // 컴포넌트 언마운트 시 대기 중인 저장 실행 및 정리
  useEffect(() => {
    return () => {
      debouncedSave.flush();
      clearRetryTimeout();
    };
  }, [debouncedSave, clearRetryTimeout]);

  // 수동 저장 함수
  const saveNow = useCallback(() => {
    debouncedSave.cancel();
    clearRetryTimeout();
    retryCountRef.current = 0;
    saveToServer(pageConfig);
  }, [debouncedSave, clearRetryTimeout, saveToServer, pageConfig]);

  // 수동 재시도 함수
  const retry = useCallback(() => {
    clearRetryTimeout();
    retryCountRef.current = 0;
    saveToServer(pageConfig);
  }, [clearRetryTimeout, saveToServer, pageConfig]);

  // 변경사항 존재 여부
  const hasChanges =
    originalPageConfig &&
    JSON.stringify(pageConfig) !== JSON.stringify(originalPageConfig);

  return {
    saveStatus,
    hasChanges,
    saveNow,
    error,
    retry,
    clearError,
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
  hasChanges: boolean | null;
  saveNow: () => void;
  error: SaveError | null;
  retry: () => void;
  clearError: () => void;
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
