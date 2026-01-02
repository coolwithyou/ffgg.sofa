# Phase 5: Auto Save - 자동 저장 및 발행

> Debounced 자동 저장으로 사용자의 변경사항을 안전하게 보존하고, 발행 기능으로 공개 페이지에 반영합니다.

## 개요

### 목표
- 설정 변경 시 자동 저장 (500ms debounce)
- 저장 상태 표시 (저장됨/저장 중/오류)
- 발행 버튼으로 변경사항 공개 적용
- 기존 API 재사용

### 의존성
- **Phase 1**: ConsoleContext, saveStatus 상태
- **Phase 3**: 설정 패널 (변경 이벤트 발생)

### MVP 포함 여부
- MVP에 포함 (핵심 기능)

---

## 전체 맥락에서의 역할

```
┌─────────────────────────────────────────────────────────────────┐
│                   Phase 5: Auto Save Flow                        │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                   Settings Panel (Phase 3)                  │ │
│  │                                                             │ │
│  │   사용자 입력 (제목, 색상 등)                                │ │
│  │          ↓                                                  │ │
│  │   updatePageConfig({ header: { title: 'New Title' } })     │ │
│  │          ↓                                                  │ │
│  └────────────────────────────────────────────────────────────┘ │
│                      ↓                                          │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                ConsoleContext (Phase 1)                     │ │
│  │                                                             │ │
│  │   pageConfig 상태 업데이트                                   │ │
│  │          ↓                                                  │ │
│  │   saveStatus: 'unsaved'                                     │ │
│  │          ↓                                                  │ │
│  └────────────────────────────────────────────────────────────┘ │
│                      ↓                                          │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │              useAutoSave Hook (Phase 5)                     │ │
│  │                                                             │ │
│  │   useEffect 감지 (pageConfig 변경)                          │ │
│  │          ↓                                                  │ │
│  │   useDebouncedCallback (500ms)                              │ │
│  │          ↓                                                  │ │
│  │   saveStatus: 'saving'                                      │ │
│  │          ↓                                                  │ │
│  │   PATCH /api/chatbots/[id]/public-page                     │ │
│  │          ↓                                                  │ │
│  │   saveStatus: 'saved' or 'error'                           │ │
│  │                                                             │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │                 Header (발행 버튼)                           │ │
│  │                                                             │ │
│  │   [발행하기] 클릭                                            │ │
│  │          ↓                                                  │ │
│  │   POST /api/chatbots/[id]/public-page/publish              │ │
│  │          ↓                                                  │ │
│  │   성공 시 Toast 표시                                         │ │
│  │                                                             │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 구현 상세

### 1. use-debounce 설치

```bash
pnpm add use-debounce
```

---

### 2. Auto Save 설정

**파일**: `app/(console)/console/config/auto-save.config.ts`

```typescript
/**
 * 자동 저장 설정
 *
 * 환경변수 또는 기본값으로 debounce 시간 및 재시도 설정을 관리합니다.
 * 테스트 환경에서는 더 짧은 시간, 프로덕션에서는 안정적인 시간을 사용합니다.
 */

export const AUTO_SAVE_CONFIG = {
  /**
   * Debounce 딜레이 (ms)
   *
   * 사용자 입력 후 저장 API 호출까지 대기 시간
   * - 300ms: 빠른 반응, API 호출 잦음
   * - 500ms: 권장 기본값 (균형)
   * - 1000ms: 타이핑 완료 후 저장, 느린 피드백
   */
  debounceDelay: parseInt(
    process.env.NEXT_PUBLIC_AUTO_SAVE_DEBOUNCE ?? '500',
    10
  ),

  /**
   * 저장 실패 시 재시도 딜레이 (ms)
   */
  retryDelay: parseInt(
    process.env.NEXT_PUBLIC_AUTO_SAVE_RETRY_DELAY ?? '3000',
    10
  ),

  /**
   * 최대 재시도 횟수
   */
  maxRetries: parseInt(
    process.env.NEXT_PUBLIC_AUTO_SAVE_MAX_RETRIES ?? '3',
    10
  ),

  /**
   * 자동 재시도 활성화 여부
   */
  autoRetry: process.env.NEXT_PUBLIC_AUTO_SAVE_AUTO_RETRY !== 'false',
} as const;

export type AutoSaveConfig = typeof AUTO_SAVE_CONFIG;

/**
 * 환경별 권장 설정
 *
 * .env.local:
 *   NEXT_PUBLIC_AUTO_SAVE_DEBOUNCE=500
 *   NEXT_PUBLIC_AUTO_SAVE_RETRY_DELAY=3000
 *   NEXT_PUBLIC_AUTO_SAVE_MAX_RETRIES=3
 *   NEXT_PUBLIC_AUTO_SAVE_AUTO_RETRY=true
 *
 * .env.test:
 *   NEXT_PUBLIC_AUTO_SAVE_DEBOUNCE=100
 *   NEXT_PUBLIC_AUTO_SAVE_RETRY_DELAY=500
 *   NEXT_PUBLIC_AUTO_SAVE_MAX_RETRIES=1
 *   NEXT_PUBLIC_AUTO_SAVE_AUTO_RETRY=false
 */
```

---

### 3. useAutoSave 훅

**파일**: `app/(console)/console/hooks/use-auto-save.tsx`

```typescript
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
```

---

### 3. ConsoleContext 확장 (originalPageConfig 추가)

**파일**: `app/(console)/console/hooks/use-console-state.tsx` (Phase 1에서 확장)

```typescript
// ConsoleState에 추가
interface ConsoleState {
  // ... 기존 필드

  // 원본 설정 (변경사항 비교용)
  originalPageConfig: PublicPageConfig | null;
  setOriginalPageConfig: (config: PublicPageConfig) => void;
}

// Provider에서 추가
const [originalPageConfig, setOriginalPageConfig] =
  useState<PublicPageConfig | null>(null);

// 챗봇 선택 시 원본 설정도 저장
const selectChatbot = useCallback(async (index: number) => {
  setCurrentChatbotIndex(index);

  const chatbot = chatbots[index];
  if (chatbot) {
    const response = await fetch(`/api/chatbots/${chatbot.id}/public-page`);
    const data = await response.json();
    setPageConfig(data.config);
    setOriginalPageConfig(data.config); // 원본 저장
  }
}, [chatbots]);
```

---

### 4. SaveStatusIndicator 컴포넌트

**파일**: `app/(console)/console/components/save-status-indicator.tsx`

```typescript
'use client';

import { useAutoSave } from '../hooks/use-auto-save';
import { Check, Loader2, AlertCircle, Circle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

/**
 * 저장 상태 표시 인디케이터
 *
 * 상태별 표시:
 * - saved: 녹색 체크 + "저장됨"
 * - saving: 스피너 + "저장 중..."
 * - error: 빨간색 경고 + "저장 오류" + 재시도 버튼
 * - unsaved: 회색 점 + "저장되지 않음"
 */
export function SaveStatusIndicator() {
  const { saveStatus, error, retry } = useAutoSave();

  const config = {
    saved: {
      icon: Check,
      text: '저장됨',
      className: 'text-green-500',
    },
    saving: {
      icon: Loader2,
      text: '저장 중...',
      className: 'text-muted-foreground',
      iconClassName: 'animate-spin',
    },
    error: {
      icon: AlertCircle,
      text: '저장 오류',
      className: 'text-destructive',
    },
    unsaved: {
      icon: Circle,
      text: '저장되지 않음',
      className: 'text-muted-foreground',
    },
  };

  const current = config[saveStatus];
  const Icon = current.icon;

  // 에러 상태일 때 확장된 UI
  if (saveStatus === 'error' && error) {
    return (
      <div className="flex items-center gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <div className={cn('flex items-center gap-1.5 text-sm', current.className)}>
              <Icon className="h-4 w-4" />
              <span>{current.text}</span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-xs">
            <p className="text-sm">{error.message}</p>
            {error.retryCount > 0 && (
              <p className="mt-1 text-xs text-muted-foreground">
                재시도 {error.retryCount}회 실패
              </p>
            )}
          </TooltipContent>
        </Tooltip>

        {error.canRetry && (
          <Button
            variant="ghost"
            size="sm"
            onClick={retry}
            className="h-7 gap-1 px-2 text-xs"
          >
            <RefreshCw className="h-3 w-3" />
            재시도
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className={cn('flex items-center gap-1.5 text-sm', current.className)}>
      <Icon
        className={cn('h-4 w-4', 'iconClassName' in current && current.iconClassName)}
      />
      <span>{current.text}</span>
    </div>
  );
}
```

---

### 5. SaveErrorBanner 컴포넌트 (고급 에러 UI)

**파일**: `app/(console)/console/components/save-error-banner.tsx`

에러 발생 시 화면 상단에 배너 형태로 표시되는 더 눈에 띄는 UI입니다.

```typescript
'use client';

import { useAutoSave } from '../hooks/use-auto-save';
import { AlertCircle, RefreshCw, X, Wifi, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useEffect, useState } from 'react';

/**
 * 저장 에러 배너
 *
 * 에러 발생 시 화면 상단에 슬라이드 다운으로 표시
 * - 에러 메시지 + 재시도 버튼
 * - 네트워크 상태 표시
 * - 자동 재시도 진행 상황
 */
export function SaveErrorBanner() {
  const { saveStatus, error, retry, clearError } = useAutoSave();
  const [isOnline, setIsOnline] = useState(true);
  const [isVisible, setIsVisible] = useState(false);

  // 네트워크 상태 감지
  useEffect(() => {
    setIsOnline(navigator.onLine);

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // 에러 발생 시 배너 표시
  useEffect(() => {
    if (saveStatus === 'error' && error) {
      setIsVisible(true);
    }
  }, [saveStatus, error]);

  // 저장 성공 시 배너 숨김
  useEffect(() => {
    if (saveStatus === 'saved') {
      setIsVisible(false);
    }
  }, [saveStatus]);

  const handleDismiss = () => {
    setIsVisible(false);
    clearError();
  };

  if (!isVisible || !error) return null;

  return (
    <div
      className={cn(
        'fixed inset-x-0 top-14 z-50 mx-auto max-w-2xl px-4',
        'animate-in slide-in-from-top duration-300'
      )}
    >
      <div
        className={cn(
          'flex items-center gap-3 rounded-lg p-3',
          'border border-destructive/20 bg-destructive/10 backdrop-blur-sm',
          'shadow-lg'
        )}
      >
        {/* 아이콘 */}
        <div className="flex-shrink-0">
          {isOnline ? (
            <AlertCircle className="h-5 w-5 text-destructive" />
          ) : (
            <WifiOff className="h-5 w-5 text-destructive" />
          )}
        </div>

        {/* 메시지 */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-destructive">
            {isOnline ? '저장에 실패했습니다' : '네트워크 연결 끊김'}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground truncate">
            {error.message}
          </p>
          {error.retryCount > 0 && (
            <p className="mt-0.5 text-xs text-muted-foreground">
              자동 재시도 {error.retryCount}회 실패
            </p>
          )}
        </div>

        {/* 액션 버튼 */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {error.canRetry && isOnline && (
            <Button
              variant="outline"
              size="sm"
              onClick={retry}
              className="h-8 gap-1.5 border-destructive/30 text-destructive hover:bg-destructive/10"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              재시도
            </Button>
          )}

          <Button
            variant="ghost"
            size="icon"
            onClick={handleDismiss}
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
```

---

### 6. 네트워크 상태 감지 훅 (선택사항)

**파일**: `app/(console)/console/hooks/use-network-status.tsx`

```typescript
'use client';

import { useState, useEffect, useCallback } from 'react';

interface NetworkStatus {
  isOnline: boolean;
  wasOffline: boolean;
  lastOnlineAt: Date | null;
}

/**
 * 네트워크 상태 감지 훅
 *
 * 오프라인 → 온라인 복구 시 자동 저장 재시도 트리거 가능
 */
export function useNetworkStatus() {
  const [status, setStatus] = useState<NetworkStatus>({
    isOnline: true,
    wasOffline: false,
    lastOnlineAt: null,
  });

  useEffect(() => {
    // 초기 상태
    setStatus((prev) => ({
      ...prev,
      isOnline: navigator.onLine,
    }));

    const handleOnline = () => {
      setStatus((prev) => ({
        isOnline: true,
        wasOffline: !prev.isOnline || prev.wasOffline,
        lastOnlineAt: new Date(),
      }));
    };

    const handleOffline = () => {
      setStatus((prev) => ({
        ...prev,
        isOnline: false,
      }));
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const resetWasOffline = useCallback(() => {
    setStatus((prev) => ({
      ...prev,
      wasOffline: false,
    }));
  }, []);

  return {
    ...status,
    resetWasOffline,
  };
}
```

---

### 7. useAutoSave와 네트워크 상태 통합

**파일**: `app/(console)/console/hooks/use-auto-save-with-network.tsx`

```typescript
'use client';

import { useEffect } from 'react';
import { useAutoSave } from './use-auto-save';
import { useNetworkStatus } from './use-network-status';

/**
 * 네트워크 상태를 고려한 자동 저장 훅
 *
 * 오프라인 → 온라인 복구 시 자동으로 저장 재시도
 */
export function useAutoSaveWithNetwork() {
  const autoSave = useAutoSave();
  const { isOnline, wasOffline, resetWasOffline } = useNetworkStatus();

  // 네트워크 복구 시 재시도
  useEffect(() => {
    if (isOnline && wasOffline && autoSave.saveStatus === 'error') {
      autoSave.retry();
      resetWasOffline();
    }
  }, [isOnline, wasOffline, autoSave, resetWasOffline]);

  return {
    ...autoSave,
    isOnline,
  };
}
```

---

### 5. ConsoleHeader 업데이트 (상태 표시 + 발행 버튼)

**파일**: `app/(console)/console/components/console-header.tsx`

```typescript
'use client';

import Link from 'next/link';
import { useCurrentChatbot } from '../hooks/use-console-state';
import { useAutoSave } from '../hooks/use-auto-save';
import { SaveStatusIndicator } from './save-status-indicator';
import { Button } from '@/components/ui/button';
import { ExternalLink, Rocket } from 'lucide-react';
import { toast } from 'sonner';

/**
 * 콘솔 헤더
 *
 * 좌측: 로고
 * 중앙: 저장 상태
 * 우측: 미리보기 링크 + 발행 버튼
 */
export function ConsoleHeader() {
  const { currentChatbot } = useCurrentChatbot();
  const { saveStatus, saveNow } = useAutoSave();

  const handlePublish = async () => {
    if (!currentChatbot) return;

    // 저장되지 않은 변경사항이 있으면 먼저 저장
    if (saveStatus === 'unsaved') {
      saveNow();
    }

    try {
      const response = await fetch(
        `/api/chatbots/${currentChatbot.id}/public-page/publish`,
        { method: 'POST' }
      );

      if (!response.ok) {
        throw new Error('발행에 실패했습니다');
      }

      toast.success('발행 완료', {
        description: '변경사항이 공개 페이지에 적용되었습니다.',
      });
    } catch (error) {
      toast.error('발행 실패', {
        description: '잠시 후 다시 시도해주세요.',
      });
    }
  };

  return (
    <header className="flex h-14 items-center justify-between border-b border-border bg-background px-4">
      {/* 좌측: 로고 */}
      <div className="flex items-center gap-3">
        <Link href="/" className="text-lg font-bold text-foreground">
          SOFA
        </Link>
        <span className="text-sm text-muted-foreground">Console</span>
      </div>

      {/* 중앙: 저장 상태 */}
      <div className="absolute left-1/2 -translate-x-1/2">
        <SaveStatusIndicator />
      </div>

      {/* 우측: 미리보기 + 발행 */}
      <div className="flex items-center gap-3">
        {currentChatbot?.slug && (
          <Button variant="ghost" size="sm" asChild>
            <Link
              href={`/${currentChatbot.slug}`}
              target="_blank"
              className="flex items-center gap-1.5"
            >
              <ExternalLink className="h-4 w-4" />
              미리보기
            </Link>
          </Button>
        )}

        <Button
          size="sm"
          onClick={handlePublish}
          disabled={saveStatus === 'saving'}
          className="flex items-center gap-1.5"
        >
          <Rocket className="h-4 w-4" />
          발행하기
        </Button>
      </div>
    </header>
  );
}
```

---

### 6. 발행 전 확인 다이얼로그 (선택사항)

사용자에게 발행 전 확인을 요청하려면 다음과 같이 확장할 수 있습니다:

```typescript
'use client';

import { useAlertDialog } from '@/components/ui/alert-dialog';

// ConsoleHeader 내부에 추가
const { confirm } = useAlertDialog();

const handlePublish = async () => {
  if (!currentChatbot) return;

  const confirmed = await confirm({
    title: '페이지 발행',
    message: '변경사항을 공개 페이지에 적용하시겠습니까?',
    confirmText: '발행하기',
    cancelText: '취소',
  });

  if (!confirmed) return;

  // ... 발행 로직
};
```

---

### 7. useAutoSave 훅 통합 위치

**파일**: `app/(console)/console/page.tsx`

```typescript
'use client';

import { Suspense } from 'react';
import { ConsoleHeader } from './components/console-header';
import { LeftSidebar } from './components/left-sidebar';
import { CenterPreview } from './components/center-preview';
import { RightSettings } from './components/right-settings';
import { useAutoSave } from './hooks/use-auto-save';

function ConsoleContent() {
  // 자동 저장 훅 활성화
  useAutoSave();

  return (
    <div className="flex h-screen flex-col">
      <ConsoleHeader />
      <div className="flex flex-1 overflow-hidden">
        <LeftSidebar />
        <CenterPreview />
        <RightSettings />
      </div>
    </div>
  );
}

export default function ConsolePage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ConsoleContent />
    </Suspense>
  );
}
```

---

### 8. 페이지 이탈 경고 (선택사항)

저장되지 않은 변경사항이 있을 때 페이지 이탈 시 경고:

**파일**: `app/(console)/console/hooks/use-before-unload.tsx`

```typescript
'use client';

import { useEffect } from 'react';
import { useAutoSave } from './use-auto-save';

/**
 * 저장되지 않은 변경사항이 있을 때 페이지 이탈 경고
 */
export function useBeforeUnload() {
  const { saveStatus, hasChanges } = useAutoSave();

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (saveStatus === 'unsaved' || hasChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [saveStatus, hasChanges]);
}

// ConsoleContent에서 사용
function ConsoleContent() {
  useAutoSave();
  useBeforeUnload(); // 페이지 이탈 경고

  return (/* ... */);
}
```

---

## API 엔드포인트 (기존 재사용)

### 설정 저장
```
PATCH /api/chatbots/[id]/public-page
Body: { config: PublicPageConfig }
Response: { config: PublicPageConfig }
```

### 발행
```
POST /api/chatbots/[id]/public-page/publish
Response: { success: true, publishedAt: string }
```

---

## 저장 상태 흐름

```
┌─────────────┐     사용자 입력     ┌─────────────┐
│   saved     │ ──────────────────▶ │   unsaved   │
└─────────────┘                     └──────┬──────┘
      ▲                                    │
      │                            500ms debounce
      │                                    │
      │                                    ▼
      │                             ┌─────────────┐
      │◀───────── 성공 ────────────│   saving    │
      │                             └──────┬──────┘
      │                                    │
      │                                    │ 실패
      │                                    ▼
      │                             ┌─────────────┐
      └────────── 재시도 ───────────│    error    │
                                    └─────────────┘
```

---

## 완료 체크리스트

### 필수
- [ ] `pnpm add use-debounce` 설치
- [ ] `auto-save.config.ts` 설정 파일 생성
- [ ] `use-auto-save.tsx` 훅 생성 (에러 상태, 재시도 로직 포함)
- [ ] `save-status-indicator.tsx` 컴포넌트 생성 (에러 시 재시도 버튼)
- [ ] `console-header.tsx` 업데이트 (상태 표시 + 발행 버튼)
- [ ] ConsoleContext에 `originalPageConfig` 추가

### 선택사항 (권장)
- [ ] `save-error-banner.tsx` 컴포넌트 생성 (눈에 띄는 에러 UI)
- [ ] `use-network-status.tsx` 훅 생성 (네트워크 상태 감지)
- [ ] `use-auto-save-with-network.tsx` 훅 생성 (네트워크 복구 시 자동 재시도)
- [ ] 발행 확인 다이얼로그
- [ ] `use-before-unload.tsx` 훅 (페이지 이탈 경고)

### 환경 변수 설정
```env
# .env.local
NEXT_PUBLIC_AUTO_SAVE_DEBOUNCE=500
NEXT_PUBLIC_AUTO_SAVE_RETRY_DELAY=3000
NEXT_PUBLIC_AUTO_SAVE_MAX_RETRIES=3
NEXT_PUBLIC_AUTO_SAVE_AUTO_RETRY=true
```

### 검증
- [ ] 설정 변경 시 설정된 debounce 시간 후 자동 저장
- [ ] 저장 상태 인디케이터 정상 표시
- [ ] 발행 버튼 클릭 시 API 호출 및 토스트
- [ ] 저장 오류 시 error 상태 표시 및 재시도 버튼 동작
- [ ] 자동 재시도 동작 확인 (maxRetries까지)
- [ ] 네트워크 오프라인 → 온라인 시 자동 재시도
- [ ] 페이지 새로고침 후 변경사항 유지

---

## 다음 Phase 연결점

### Phase 6 (Widget 모드)에서 고려사항
- Widget 설정도 동일한 자동 저장 패턴 적용
- `useAutoSave` 훅을 Widget 모드에도 재사용
- Widget 발행은 별도 API 엔드포인트 필요 가능성

---

## 에러 핸들링

### 네트워크 오류
```typescript
// use-auto-save.tsx에서
catch (error) {
  console.error('Auto save failed:', error);
  setSaveStatus('error');

  // 3초 후 재시도 (선택사항)
  setTimeout(() => {
    if (saveStatus === 'error') {
      debouncedSave(pageConfig);
    }
  }, 3000);
}
```

### 충돌 감지 (고급)
서버에서 더 최신 버전이 있을 경우 처리:

```typescript
// API 응답에서 버전 체크
interface SaveResponse {
  config: PublicPageConfig;
  version: number;
  updatedAt: string;
}

// 버전 불일치 시 사용자에게 알림
if (serverVersion > localVersion) {
  toast.warning('다른 기기에서 변경사항이 있습니다', {
    action: {
      label: '새로고침',
      onClick: () => window.location.reload(),
    },
  });
}
```

---

## 성능 최적화

### Debounce 시간 조정
| 시간 | 특징 |
|------|------|
| 300ms | 빠른 저장, API 호출 잦음 |
| **500ms** | **권장 기본값** |
| 1000ms | 타이핑 완료 후 저장, 느린 피드백 |

### 저장 최적화
- 변경된 필드만 PATCH (delta update)
- 큰 이미지는 별도 업로드 후 URL만 저장

```typescript
// Delta update 예시
const changedFields = getChangedFields(originalPageConfig, pageConfig);
if (Object.keys(changedFields).length > 0) {
  await fetch(`/api/chatbots/${id}/public-page`, {
    method: 'PATCH',
    body: JSON.stringify({ config: changedFields }),
  });
}
```
