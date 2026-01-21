'use client';

import { useRef, useCallback, useEffect } from 'react';

/**
 * Idle 타이머 훅 옵션
 */
export interface UseIdleTimerOptions {
  /** Idle 상태 판정까지의 지연 시간 (ms) */
  delay: number;
  /** Idle 상태가 되었을 때 실행할 콜백 */
  onIdle: () => void;
  /** 자동 시작 여부 (기본값: false) */
  autoStart?: boolean;
}

/**
 * Idle 타이머 훅
 *
 * 특정 시간 동안 활동이 없으면 콜백을 실행합니다.
 * reset()을 호출할 때마다 타이머가 재시작됩니다.
 *
 * @example
 * const { reset, cancel, isRunning } = useIdleTimer({
 *   delay: 2000,
 *   onIdle: () => console.log('User is idle'),
 * });
 *
 * // 사용자 활동 시 타이머 리셋
 * <input onChange={() => reset()} />
 */
export function useIdleTimer(options: UseIdleTimerOptions) {
  const { delay, onIdle, autoStart = false } = options;

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const isRunningRef = useRef(autoStart);
  const callbackRef = useRef(onIdle);

  // 콜백 ref 업데이트 (의존성 배열 안정화)
  useEffect(() => {
    callbackRef.current = onIdle;
  }, [onIdle]);

  // 타이머 취소
  const cancel = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    isRunningRef.current = false;
  }, []);

  // 타이머 시작/리셋
  const reset = useCallback(() => {
    cancel();
    isRunningRef.current = true;
    timerRef.current = setTimeout(() => {
      isRunningRef.current = false;
      callbackRef.current();
    }, delay);
  }, [cancel, delay]);

  // 컴포넌트 언마운트 시 정리
  useEffect(() => {
    if (autoStart) {
      reset();
    }
    return cancel;
  }, [autoStart, reset, cancel]);

  return {
    /** 타이머 시작/리셋 */
    reset,
    /** 타이머 취소 */
    cancel,
    /** 현재 실행 중 여부 */
    get isRunning() {
      return isRunningRef.current;
    },
  };
}

/**
 * Throttle된 Idle 타이머 훅
 *
 * useIdleTimer에 최소 실행 간격(throttle)을 추가한 버전입니다.
 * 마지막 실행 후 minInterval이 지나지 않으면 해당 시간 후에 실행됩니다.
 */
export interface UseThrottledIdleTimerOptions extends UseIdleTimerOptions {
  /** 최소 실행 간격 (ms) */
  minInterval: number;
}

export function useThrottledIdleTimer(options: UseThrottledIdleTimerOptions) {
  const { delay, minInterval, onIdle, autoStart = false } = options;

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const lastExecutionRef = useRef<number>(0);
  const isRunningRef = useRef(autoStart);
  const callbackRef = useRef(onIdle);
  const pendingExecutionRef = useRef(false);

  useEffect(() => {
    callbackRef.current = onIdle;
  }, [onIdle]);

  const cancel = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    isRunningRef.current = false;
    pendingExecutionRef.current = false;
  }, []);

  const executeCallback = useCallback(() => {
    isRunningRef.current = false;
    pendingExecutionRef.current = false;
    lastExecutionRef.current = Date.now();
    callbackRef.current();
  }, []);

  const reset = useCallback(() => {
    cancel();
    isRunningRef.current = true;

    const now = Date.now();
    const timeSinceLastExecution = now - lastExecutionRef.current;

    if (timeSinceLastExecution < minInterval && lastExecutionRef.current > 0) {
      // Throttle: minInterval 후에 실행
      const throttleDelay = minInterval - timeSinceLastExecution;
      pendingExecutionRef.current = true;
      timerRef.current = setTimeout(() => {
        // Throttle 후 다시 idle 타이머 시작
        timerRef.current = setTimeout(executeCallback, delay);
      }, throttleDelay);
    } else {
      // 정상 idle 타이머
      timerRef.current = setTimeout(executeCallback, delay);
    }
  }, [cancel, delay, minInterval, executeCallback]);

  useEffect(() => {
    if (autoStart) {
      reset();
    }
    return cancel;
  }, [autoStart, reset, cancel]);

  return {
    reset,
    cancel,
    /** 마지막 실행 시간 초기화 (throttle 무시용) */
    resetThrottle: useCallback(() => {
      lastExecutionRef.current = 0;
    }, []),
    get isRunning() {
      return isRunningRef.current;
    },
    get isPending() {
      return pendingExecutionRef.current;
    },
  };
}
