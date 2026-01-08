'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { useDebouncedCallback } from 'use-debounce';
import { toast } from 'sonner';
import { useConsole, useWidgetConfig } from './use-console-state';
import { AUTO_SAVE_CONFIG } from '../config/auto-save.config';
import type { WidgetConfig } from '@/lib/widget/types';

/**
 * 에러 상태 타입
 */
export interface WidgetSaveError {
  message: string;
  code?: string;
  retryCount: number;
  canRetry: boolean;
  timestamp: Date;
}

/**
 * 위젯 자동 저장 훅 옵션
 */
interface UseWidgetAutoSaveOptions {
  /** Idle 딜레이 (ms) - 변경 후 저장까지 대기 시간 */
  idleDelay?: number;
  maxRetries?: number;
  autoRetry?: boolean;
  onSaveSuccess?: () => void;
  onSaveError?: (error: WidgetSaveError) => void;
}

/**
 * 위젯 자동 저장 훅
 *
 * widgetConfig 변경 시 설정된 idle 시간 후 API 호출
 * 실패 시 자동 재시도 및 에러 상태 관리
 */
export function useWidgetAutoSave(options?: UseWidgetAutoSaveOptions) {
  const {
    idleDelay = AUTO_SAVE_CONFIG.idleDelay,
    maxRetries = AUTO_SAVE_CONFIG.maxRetries,
    autoRetry = AUTO_SAVE_CONFIG.autoRetry,
    onSaveSuccess,
    onSaveError,
  } = options ?? {};

  const { currentChatbot } = useConsole();
  const {
    widgetConfig,
    originalWidgetConfig,
    widgetSaveStatus,
    setWidgetSaveStatus,
    setOriginalWidgetConfig,
  } = useWidgetConfig();

  // 에러 상태 관리
  const [error, setError] = useState<WidgetSaveError | null>(null);
  const retryCountRef = useRef(0);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 최초 로드 여부 체크 (첫 렌더링 시 저장 방지)
  const isInitialMount = useRef(true);
  const lastSavedConfig = useRef<WidgetConfig | null>(null);

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
    async (config: WidgetConfig, isRetry = false) => {
      if (!currentChatbot) return;

      try {
        setWidgetSaveStatus('saving');

        const response = await fetch(
          `/api/chatbots/${currentChatbot.id}/widget`,
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
        setOriginalWidgetConfig(config);
        setWidgetSaveStatus('saved');
        clearError();
        toast.success('위젯 설정 저장됨');
        onSaveSuccess?.();
      } catch (err) {
        console.error('Widget auto save failed:', err);

        const errorMessage =
          err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다';
        const canRetry = retryCountRef.current < maxRetries;

        const saveError: WidgetSaveError = {
          message: errorMessage,
          code: err instanceof Error ? (err as any).code : undefined,
          retryCount: retryCountRef.current,
          canRetry,
          timestamp: new Date(),
        };

        setError(saveError);
        setWidgetSaveStatus('error');
        toast.error('위젯 저장 실패', { description: errorMessage });
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
      setWidgetSaveStatus,
      setOriginalWidgetConfig,
      clearError,
      maxRetries,
      autoRetry,
      onSaveSuccess,
      onSaveError,
    ]
  );

  // 디바운스된 저장 함수 (Idle 기반)
  const debouncedSave = useDebouncedCallback(saveToServer, idleDelay);

  // widgetConfig 변경 감지 및 저장
  useEffect(() => {
    // 최초 마운트 시 스킵
    if (isInitialMount.current) {
      isInitialMount.current = false;
      lastSavedConfig.current = widgetConfig;
      return;
    }

    // 변경사항 없으면 스킵
    if (
      lastSavedConfig.current &&
      JSON.stringify(widgetConfig) === JSON.stringify(lastSavedConfig.current)
    ) {
      return;
    }

    // 상태를 unsaved로 변경 후 디바운스 저장
    setWidgetSaveStatus('unsaved');
    debouncedSave(widgetConfig);
  }, [widgetConfig, debouncedSave, setWidgetSaveStatus]);

  // 컴포넌트 언마운트 시 대기 중인 저장 실행 및 정리
  useEffect(() => {
    return () => {
      debouncedSave.flush();
      clearRetryTimeout();
    };
  }, [debouncedSave, clearRetryTimeout]);

  // 수동 저장 함수
  const saveNow = useCallback(async () => {
    debouncedSave.cancel();
    clearRetryTimeout();
    retryCountRef.current = 0;
    await saveToServer(widgetConfig);
  }, [debouncedSave, clearRetryTimeout, saveToServer, widgetConfig]);

  // 수동 재시도 함수
  const retry = useCallback(() => {
    clearRetryTimeout();
    retryCountRef.current = 0;
    saveToServer(widgetConfig);
  }, [clearRetryTimeout, saveToServer, widgetConfig]);

  // 변경사항 존재 여부
  const hasChanges =
    originalWidgetConfig &&
    JSON.stringify(widgetConfig) !== JSON.stringify(originalWidgetConfig);

  return {
    saveStatus: widgetSaveStatus,
    hasChanges,
    saveNow,
    error,
    retry,
    clearError,
  };
}
