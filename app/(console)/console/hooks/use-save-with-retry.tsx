'use client';

import { useRef, useCallback, useState } from 'react';

/**
 * 저장 에러 상태 타입
 */
export interface SaveError {
  message: string;
  code?: string;
  retryCount: number;
  canRetry: boolean;
  timestamp: Date;
}

/**
 * 저장 결과 타입
 */
export interface SaveResult<T = void> {
  success: boolean;
  data?: T;
  error?: Error;
}

/**
 * useSaveWithRetry 훅 옵션
 */
export interface UseSaveWithRetryOptions {
  /** 최대 재시도 횟수 */
  maxRetries?: number;
  /** 재시도 간격 (ms) */
  retryDelay?: number;
  /** 자동 재시도 활성화 여부 */
  autoRetry?: boolean;
  /** 저장 성공 시 콜백 */
  onSuccess?: () => void;
  /** 저장 실패 시 콜백 */
  onError?: (error: SaveError) => void;
}

/**
 * useSaveWithRetry 훅 반환 타입
 */
export interface UseSaveWithRetryReturn<T = void> {
  /** 저장 실행 */
  save: () => Promise<boolean>;
  /** 수동 재시도 */
  retry: () => Promise<boolean>;
  /** 에러 초기화 */
  clearError: () => void;
  /** 현재 에러 상태 */
  error: SaveError | null;
  /** 저장 중 여부 */
  isSaving: boolean;
}

/**
 * 재시도 로직이 포함된 저장 훅
 *
 * 범용 저장 함수에 재시도, 에러 관리 기능을 추가합니다.
 *
 * @example
 * const { save, retry, error, isSaving } = useSaveWithRetry(
 *   async () => {
 *     const res = await fetch('/api/save', { method: 'POST', body: data });
 *     if (!res.ok) throw new Error('저장 실패');
 *   },
 *   { maxRetries: 3, autoRetry: true }
 * );
 */
export function useSaveWithRetry<T = void>(
  saveFn: () => Promise<SaveResult<T> | void>,
  options?: UseSaveWithRetryOptions
): UseSaveWithRetryReturn<T> {
  const {
    maxRetries = 3,
    retryDelay = 3000,
    autoRetry = true,
    onSuccess,
    onError,
  } = options ?? {};

  const [error, setError] = useState<SaveError | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const retryCountRef = useRef(0);
  const retryTimerRef = useRef<NodeJS.Timeout | null>(null);
  const saveFnRef = useRef(saveFn);

  // saveFn ref 업데이트 (의존성 안정화)
  saveFnRef.current = saveFn;

  // 재시도 타이머 정리
  const clearRetryTimer = useCallback(() => {
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
  }, []);

  // 에러 초기화
  const clearError = useCallback(() => {
    setError(null);
    retryCountRef.current = 0;
    clearRetryTimer();
  }, [clearRetryTimer]);

  // 저장 실행 (내부)
  const executeInternal = useCallback(
    async (isRetry: boolean): Promise<boolean> => {
      if (isSaving) return false;

      setIsSaving(true);

      try {
        const result = await saveFnRef.current();

        // 결과가 SaveResult 형태이고 success가 false인 경우
        if (result && typeof result === 'object' && 'success' in result) {
          if (!result.success && result.error) {
            throw result.error;
          }
        }

        // 성공
        setError(null);
        retryCountRef.current = 0;
        onSuccess?.();
        return true;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다';
        const canRetry = retryCountRef.current < maxRetries;

        const saveError: SaveError = {
          message: errorMessage,
          code: err instanceof Error ? (err as Error & { code?: string }).code : undefined,
          retryCount: retryCountRef.current,
          canRetry,
          timestamp: new Date(),
        };

        setError(saveError);
        onError?.(saveError);

        // 자동 재시도
        if (autoRetry && canRetry && !isRetry) {
          retryCountRef.current += 1;
          retryTimerRef.current = setTimeout(() => {
            executeInternal(true);
          }, retryDelay);
        }

        return false;
      } finally {
        setIsSaving(false);
      }
    },
    [isSaving, maxRetries, retryDelay, autoRetry, onSuccess, onError]
  );

  // 저장 실행 (외부 API)
  const save = useCallback(async (): Promise<boolean> => {
    clearRetryTimer();
    retryCountRef.current = 0;
    return executeInternal(false);
  }, [clearRetryTimer, executeInternal]);

  // 수동 재시도
  const retry = useCallback(async (): Promise<boolean> => {
    clearRetryTimer();
    retryCountRef.current = 0;
    return executeInternal(false);
  }, [clearRetryTimer, executeInternal]);

  return {
    save,
    retry,
    clearError,
    error,
    isSaving,
  };
}
