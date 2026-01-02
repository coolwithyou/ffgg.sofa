'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { useDebouncedCallback } from 'use-debounce';
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

  // 최초 로드 여부 체크 (첫 렌더링 시 저장 방지)
  const isInitialMount = useRef(true);
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
    // 최초 마운트 시 스킵
    if (isInitialMount.current) {
      isInitialMount.current = false;
      lastSavedConfig.current = pageConfig;
      return;
    }

    // 변경사항 없으면 스킵
    if (
      lastSavedConfig.current &&
      JSON.stringify(pageConfig) === JSON.stringify(lastSavedConfig.current)
    ) {
      return;
    }

    // 상태를 unsaved로 변경 후 디바운스 저장
    setSaveStatus('unsaved');
    debouncedSave(pageConfig);
  }, [pageConfig, debouncedSave, setSaveStatus]);

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
