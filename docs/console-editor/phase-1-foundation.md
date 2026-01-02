# Phase 1: Foundation - 기반 구조

> 라우트 그룹, 3-컬럼 레이아웃, 전역 상태 관리 Context를 구축합니다.

## 개요

### 목표
- `(console)` Route Group 생성
- 3-컬럼 레이아웃 구현
- ConsoleContext 상태 관리 설정
- 챗봇 목록 로드 및 선택 기능

### 의존성
- 없음 (첫 번째 Phase)

### 다음 Phase 준비
- Phase 2 (Preview): `center-preview.tsx`에 디바이스 프레임 추가
- Phase 3 (Settings): `right-settings.tsx`에 설정 폼 추가

---

## 전체 맥락에서의 역할

```
┌─────────────────────────────────────────────────────────────────┐
│                     Phase 1: Foundation                          │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │  layout.tsx                                              │   │
│   │  ├── ConsoleProvider (상태 관리)                         │   │
│   │  │   └── page.tsx                                        │   │
│   │  │       ├── console-header.tsx (상단)                   │   │
│   │  │       └── 3-컬럼 컨테이너                              │   │
│   │  │           ├── left-sidebar.tsx    [Phase 1]           │   │
│   │  │           ├── center-preview.tsx  [Phase 2에서 확장]  │   │
│   │  │           └── right-settings.tsx  [Phase 3에서 확장]  │   │
│   └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 구현 상세

### 1. 디렉토리 구조 생성

```bash
mkdir -p app/(console)/console/components/settings
mkdir -p app/(console)/console/hooks
```

```
app/
├── (console)/
│   └── console/
│       ├── layout.tsx              # [이 Phase에서 구현]
│       ├── page.tsx                # [이 Phase에서 구현]
│       ├── components/
│       │   ├── console-header.tsx  # [이 Phase에서 구현]
│       │   ├── left-sidebar.tsx    # [이 Phase에서 구현]
│       │   ├── center-preview.tsx  # [이 Phase에서 기본 구현]
│       │   └── right-settings.tsx  # [이 Phase에서 기본 구현]
│       ├── hooks/
│       │   └── use-console-state.tsx  # [이 Phase에서 구현]
│       └── types.ts                # [이 Phase에서 구현]
```

---

### 2. 타입 정의

**파일**: `app/(console)/console/types.ts`

```typescript
import type { PublicPageConfig } from '@/lib/public-page/types';

// 챗봇 기본 정보 (목록용)
export interface ConsoleChatbot {
  id: string;
  name: string;
  slug: string | null;
  publicPageEnabled: boolean;
  publicPageConfig: PublicPageConfig;
  tenantId: string;
}

// 편집 모드
export type ConsoleMode = 'page' | 'widget';

// 저장 상태
export type SaveStatus = 'saved' | 'saving' | 'error' | 'unsaved';

// Context 상태 타입
export interface ConsoleState {
  // 모드
  mode: ConsoleMode;

  // 챗봇
  chatbots: ConsoleChatbot[];
  currentChatbotIndex: number;
  isLoading: boolean;

  // 파생 상태 (getter)
  currentChatbot: ConsoleChatbot | null;

  // Page 설정 (현재 선택된 챗봇의)
  pageConfig: PublicPageConfig;

  // 저장 상태
  saveStatus: SaveStatus;
}

// Context 액션 타입
export interface ConsoleActions {
  setMode: (mode: ConsoleMode) => void;
  selectChatbot: (index: number) => void;
  navigateChatbot: (direction: 'prev' | 'next') => void;
  updatePageConfig: (partial: Partial<PublicPageConfig>) => void;
  updateHeaderConfig: (partial: Partial<PublicPageConfig['header']>) => void;
  updateThemeConfig: (partial: Partial<PublicPageConfig['theme']>) => void;
  updateSeoConfig: (partial: Partial<PublicPageConfig['seo']>) => void;
  setSaveStatus: (status: SaveStatus) => void;
  reloadChatbots: () => Promise<void>;
}

// Context 전체 타입
export interface ConsoleContextValue extends ConsoleState, ConsoleActions {}
```

---

### 3. ConsoleContext 구현

**파일**: `app/(console)/console/hooks/use-console-state.tsx`

```typescript
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

  // 챗봇 변경 시 설정 동기화
  useEffect(() => {
    if (currentChatbot) {
      setPageConfig(currentChatbot.publicPageConfig);
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
      reloadChatbots,
    }),
    [
      mode,
      chatbots,
      currentChatbotIndex,
      currentChatbot,
      isLoading,
      pageConfig,
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
```

---

### 4. Layout 구현

**파일**: `app/(console)/console/layout.tsx`

```typescript
import type { ReactNode } from 'react';
import { ConsoleProvider } from './hooks/use-console-state';

export const metadata = {
  title: 'Console Editor - SOFA',
  description: '쉽고 직관적인 챗봇 페이지 에디터',
};

interface ConsoleLayoutProps {
  children: ReactNode;
}

export default function ConsoleLayout({ children }: ConsoleLayoutProps) {
  return (
    <ConsoleProvider>
      <div className="h-screen w-screen overflow-hidden bg-background">
        {children}
      </div>
    </ConsoleProvider>
  );
}
```

---

### 5. Page 구현 (3-컬럼 레이아웃)

**파일**: `app/(console)/console/page.tsx`

```typescript
'use client';

import { ConsoleHeader } from './components/console-header';
import { LeftSidebar } from './components/left-sidebar';
import { CenterPreview } from './components/center-preview';
import { RightSettings } from './components/right-settings';
import { useConsole } from './hooks/use-console-state';

export default function ConsolePage() {
  const { isLoading } = useConsole();

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col">
      {/* 상단 헤더 */}
      <ConsoleHeader />

      {/* 3-컬럼 메인 영역 */}
      <div className="flex flex-1 overflow-hidden">
        {/* 좌측: 모드 탭 + 챗봇 목록 */}
        <LeftSidebar />

        {/* 중앙: 프리뷰 */}
        <CenterPreview />

        {/* 우측: 설정 패널 */}
        <RightSettings />
      </div>
    </div>
  );
}
```

---

### 6. ConsoleHeader 구현

**파일**: `app/(console)/console/components/console-header.tsx`

```typescript
'use client';

import Link from 'next/link';
import { useSaveStatus, useCurrentChatbot } from '../hooks/use-console-state';
import { Button } from '@/components/ui/button';
import { Check, Loader2, AlertCircle, ExternalLink } from 'lucide-react';

export function ConsoleHeader() {
  const { saveStatus } = useSaveStatus();
  const { currentChatbot } = useCurrentChatbot();

  // 저장 상태 표시
  const renderSaveStatus = () => {
    switch (saveStatus) {
      case 'saved':
        return (
          <span className="flex items-center gap-1 text-sm text-green-500">
            <Check className="h-4 w-4" />
            저장됨
          </span>
        );
      case 'saving':
        return (
          <span className="flex items-center gap-1 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            저장 중...
          </span>
        );
      case 'unsaved':
        return (
          <span className="flex items-center gap-1 text-sm text-yellow-500">
            <AlertCircle className="h-4 w-4" />
            저장되지 않음
          </span>
        );
      case 'error':
        return (
          <span className="flex items-center gap-1 text-sm text-destructive">
            <AlertCircle className="h-4 w-4" />
            저장 실패
          </span>
        );
    }
  };

  return (
    <header className="flex h-14 items-center justify-between border-b border-border bg-card px-4">
      {/* 좌측: 로고 */}
      <div className="flex items-center gap-4">
        <Link href="/" className="text-xl font-bold text-primary">
          SOFA
        </Link>
        <span className="text-sm text-muted-foreground">Console Editor</span>
      </div>

      {/* 중앙: 저장 상태 */}
      <div className="flex items-center gap-4">
        {renderSaveStatus()}
      </div>

      {/* 우측: 액션 버튼 */}
      <div className="flex items-center gap-2">
        {currentChatbot?.slug && currentChatbot.publicPageEnabled && (
          <Button variant="outline" size="sm" asChild>
            <a
              href={`/${currentChatbot.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1"
            >
              <ExternalLink className="h-4 w-4" />
              미리보기
            </a>
          </Button>
        )}
        <Button size="sm" disabled={saveStatus === 'saving'}>
          발행하기
        </Button>
      </div>
    </header>
  );
}
```

---

### 7. LeftSidebar 구현

**파일**: `app/(console)/console/components/left-sidebar.tsx`

```typescript
'use client';

import { useConsoleMode, useCurrentChatbot } from '../hooks/use-console-state';
import { cn } from '@/lib/utils';
import { FileText, MessageSquare, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function LeftSidebar() {
  const { mode, setMode } = useConsoleMode();
  const { chatbots, currentChatbotIndex, selectChatbot } = useCurrentChatbot();

  return (
    <aside className="flex w-64 flex-col border-r border-border bg-card">
      {/* 모드 탭 */}
      <div className="flex border-b border-border">
        <button
          onClick={() => setMode('page')}
          className={cn(
            'flex flex-1 items-center justify-center gap-2 py-3 text-sm font-medium transition-colors',
            mode === 'page'
              ? 'border-b-2 border-primary text-primary'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <FileText className="h-4 w-4" />
          Page
        </button>
        <button
          onClick={() => setMode('widget')}
          className={cn(
            'flex flex-1 items-center justify-center gap-2 py-3 text-sm font-medium transition-colors',
            mode === 'widget'
              ? 'border-b-2 border-primary text-primary'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <MessageSquare className="h-4 w-4" />
          Widget
        </button>
      </div>

      {/* 챗봇 목록 */}
      <div className="flex-1 overflow-y-auto p-3">
        <h3 className="mb-2 text-xs font-medium uppercase text-muted-foreground">
          내 챗봇
        </h3>
        <div className="space-y-1">
          {chatbots.map((bot, index) => (
            <button
              key={bot.id}
              onClick={() => selectChatbot(index)}
              className={cn(
                'flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors',
                currentChatbotIndex === index
                  ? 'bg-primary/10 text-primary'
                  : 'text-foreground hover:bg-muted'
              )}
            >
              <span className="truncate">{bot.name}</span>
              {bot.publicPageEnabled && (
                <span className="ml-auto h-2 w-2 rounded-full bg-green-500" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* 새 챗봇 추가 버튼 */}
      <div className="border-t border-border p-3">
        <Button variant="outline" className="w-full" size="sm">
          <Plus className="mr-2 h-4 w-4" />
          새 챗봇 추가
        </Button>
      </div>
    </aside>
  );
}
```

---

### 8. CenterPreview 구현 (기본)

**파일**: `app/(console)/console/components/center-preview.tsx`

```typescript
'use client';

import { useCurrentChatbot, usePageConfig } from '../hooks/use-console-state';

export function CenterPreview() {
  const { currentChatbot } = useCurrentChatbot();
  const { pageConfig } = usePageConfig();

  if (!currentChatbot) {
    return (
      <main className="flex flex-1 items-center justify-center bg-muted/30">
        <p className="text-muted-foreground">챗봇을 선택해주세요</p>
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center bg-muted/30 p-8">
      {/* Phase 2에서 디바이스 프레임 + 프리뷰 추가 */}
      <div className="text-center">
        <p className="text-lg font-medium text-foreground">
          {currentChatbot.name}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          프리뷰 영역 (Phase 2에서 구현)
        </p>
        <p className="mt-4 text-xs text-muted-foreground">
          배경색: {pageConfig.theme.backgroundColor}
        </p>
      </div>
    </main>
  );
}
```

---

### 9. RightSettings 구현 (기본)

**파일**: `app/(console)/console/components/right-settings.tsx`

```typescript
'use client';

import { useConsoleMode, useCurrentChatbot } from '../hooks/use-console-state';

export function RightSettings() {
  const { mode } = useConsoleMode();
  const { currentChatbot } = useCurrentChatbot();

  if (!currentChatbot) {
    return (
      <aside className="flex w-80 items-center justify-center border-l border-border bg-card">
        <p className="text-sm text-muted-foreground">챗봇을 선택해주세요</p>
      </aside>
    );
  }

  return (
    <aside className="w-80 overflow-y-auto border-l border-border bg-card">
      <div className="p-4">
        <h2 className="text-lg font-semibold text-foreground">
          {mode === 'page' ? '페이지 설정' : '위젯 설정'}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {currentChatbot.name}의 {mode === 'page' ? '공개 페이지' : '위젯'}을
          커스터마이징하세요.
        </p>

        {/* Phase 3에서 설정 폼 추가 */}
        <div className="mt-6 space-y-4">
          <div className="rounded-lg border border-border p-4">
            <p className="text-sm text-muted-foreground">
              설정 패널 (Phase 3에서 구현)
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}
```

---

## 완료 체크리스트

### 필수
- [ ] `app/(console)/console/types.ts` 생성
- [ ] `app/(console)/console/hooks/use-console-state.tsx` 생성
- [ ] `app/(console)/console/layout.tsx` 생성
- [ ] `app/(console)/console/page.tsx` 생성
- [ ] `app/(console)/console/components/console-header.tsx` 생성
- [ ] `app/(console)/console/components/left-sidebar.tsx` 생성
- [ ] `app/(console)/console/components/center-preview.tsx` 생성 (기본)
- [ ] `app/(console)/console/components/right-settings.tsx` 생성 (기본)

### 검증
- [ ] `/console` 라우트 접근 가능
- [ ] 3-컬럼 레이아웃 정상 렌더링
- [ ] 챗봇 목록 로드 및 표시
- [ ] 챗봇 선택 시 상태 변경
- [ ] 모드 탭 (Page/Widget) 전환 동작
- [ ] 다크모드 스타일 적용

---

## 반응형 디자인 전략

### 브레이크포인트 정의

| 브레이크포인트 | 너비 | 레이아웃 |
|--------------|------|---------|
| Desktop XL | 1280px+ | 3-컬럼 (256px + flex-1 + 320px) |
| Desktop | 1024-1279px | 3-컬럼 (축소) |
| Tablet | 768-1023px | 2-컬럼 (Settings는 Sheet로 전환) |
| Mobile | ~767px | 1-컬럼 (탭 전환) |

### 반응형 레이아웃 구현

**파일**: `app/(console)/console/page.tsx` (확장)

```typescript
'use client';

import { useState } from 'react';
import { useMediaQuery } from '@/hooks/use-media-query';
import { ConsoleHeader } from './components/console-header';
import { LeftSidebar } from './components/left-sidebar';
import { CenterPreview } from './components/center-preview';
import { RightSettings } from './components/right-settings';
import { MobileNav } from './components/mobile-nav';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Settings } from 'lucide-react';

export default function ConsolePage() {
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const isTablet = useMediaQuery('(min-width: 768px)');
  const [settingsOpen, setSettingsOpen] = useState(false);

  // 모바일: 탭 전환 UI
  if (!isTablet) {
    return <MobileConsoleView />;
  }

  // 태블릿: Settings를 Sheet로
  if (!isDesktop) {
    return (
      <div className="flex h-screen flex-col">
        <ConsoleHeader />
        <div className="flex flex-1 overflow-hidden">
          <LeftSidebar className="w-56" />
          <CenterPreview />
          <Sheet open={settingsOpen} onOpenChange={setSettingsOpen}>
            <SheetTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="fixed bottom-4 right-4 z-50 h-12 w-12 rounded-full shadow-lg"
              >
                <Settings className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-80 p-0">
              <RightSettings />
            </SheetContent>
          </Sheet>
        </div>
      </div>
    );
  }

  // 데스크톱: 3-컬럼
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
```

### 모바일 전용 네비게이션

**파일**: `app/(console)/console/components/mobile-nav.tsx`

```typescript
'use client';

import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LeftSidebar } from './left-sidebar';
import { CenterPreview } from './center-preview';
import { RightSettings } from './right-settings';
import { ConsoleHeader } from './console-header';
import { List, Eye, Settings } from 'lucide-react';

export function MobileConsoleView() {
  const [activeTab, setActiveTab] = useState('preview');

  return (
    <div className="flex h-screen flex-col">
      <ConsoleHeader />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-1 flex-col">
        <div className="flex-1 overflow-hidden">
          <TabsContent value="chatbots" className="m-0 h-full">
            <LeftSidebar className="w-full border-r-0" />
          </TabsContent>
          <TabsContent value="preview" className="m-0 h-full">
            <CenterPreview />
          </TabsContent>
          <TabsContent value="settings" className="m-0 h-full">
            <RightSettings className="w-full border-l-0" />
          </TabsContent>
        </div>

        {/* 하단 탭 바 */}
        <TabsList className="grid h-16 w-full grid-cols-3 rounded-none border-t">
          <TabsTrigger value="chatbots" className="flex flex-col gap-1">
            <List className="h-5 w-5" />
            <span className="text-xs">챗봇</span>
          </TabsTrigger>
          <TabsTrigger value="preview" className="flex flex-col gap-1">
            <Eye className="h-5 w-5" />
            <span className="text-xs">프리뷰</span>
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex flex-col gap-1">
            <Settings className="h-5 w-5" />
            <span className="text-xs">설정</span>
          </TabsTrigger>
        </TabsList>
      </Tabs>
    </div>
  );
}
```

---

## 로딩 UI (스켈레톤)

### 전체 로딩 스켈레톤

**파일**: `app/(console)/console/components/console-skeleton.tsx`

```typescript
import { Skeleton } from '@/components/ui/skeleton';

/**
 * Console 전체 로딩 스켈레톤
 *
 * 초기 데이터 로드 중 표시
 */
export function ConsoleSkeleton() {
  return (
    <div className="flex h-screen flex-col">
      {/* 헤더 스켈레톤 */}
      <div className="flex h-14 items-center justify-between border-b border-border bg-card px-4">
        <Skeleton className="h-6 w-24" />
        <Skeleton className="h-4 w-20" />
        <div className="flex gap-2">
          <Skeleton className="h-8 w-20" />
          <Skeleton className="h-8 w-24" />
        </div>
      </div>

      {/* 3-컬럼 스켈레톤 */}
      <div className="flex flex-1 overflow-hidden">
        {/* 좌측 사이드바 */}
        <div className="w-64 border-r border-border bg-card p-4">
          <div className="flex border-b border-border pb-3">
            <Skeleton className="h-8 flex-1" />
            <Skeleton className="ml-2 h-8 flex-1" />
          </div>
          <div className="mt-4 space-y-2">
            <Skeleton className="h-3 w-16" />
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        </div>

        {/* 중앙 프리뷰 */}
        <div className="flex flex-1 items-center justify-center bg-muted/30">
          <div className="flex flex-col items-center gap-4">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-[667px] w-[375px] rounded-[40px]" />
            <div className="flex gap-2">
              <Skeleton className="h-2 w-2 rounded-full" />
              <Skeleton className="h-2 w-2 rounded-full" />
              <Skeleton className="h-2 w-2 rounded-full" />
            </div>
          </div>
        </div>

        {/* 우측 설정 */}
        <div className="w-80 border-l border-border bg-card p-4">
          <Skeleton className="h-6 w-24" />
          <Skeleton className="mt-2 h-4 w-48" />
          <div className="mt-6 space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="rounded-lg border border-border p-4">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="mt-3 h-10 w-full" />
                <Skeleton className="mt-2 h-10 w-full" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
```

### Page에 스켈레톤 적용

```typescript
// app/(console)/console/page.tsx 수정

import { Suspense } from 'react';
import { ConsoleSkeleton } from './components/console-skeleton';

export default function ConsolePage() {
  return (
    <Suspense fallback={<ConsoleSkeleton />}>
      <ConsoleContent />
    </Suspense>
  );
}

function ConsoleContent() {
  const { isLoading } = useConsole();

  if (isLoading) {
    return <ConsoleSkeleton />;
  }

  // ... 기존 코드
}
```

### 부분 로딩 스켈레톤

```typescript
// 챗봇 목록 로딩
export function ChatbotListSkeleton() {
  return (
    <div className="space-y-2">
      {[...Array(5)].map((_, i) => (
        <Skeleton key={i} className="h-10 w-full rounded-md" />
      ))}
    </div>
  );
}

// 설정 패널 로딩
export function SettingsPanelSkeleton() {
  return (
    <div className="space-y-4">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="rounded-lg border border-border p-4">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="mt-3 h-10 w-full" />
        </div>
      ))}
    </div>
  );
}
```

---

## 접근성 체크리스트

### 키보드 네비게이션
- [ ] Tab으로 모든 인터랙티브 요소 접근 가능
- [ ] Enter/Space로 버튼/탭 활성화
- [ ] Escape로 모달/Sheet 닫기
- [ ] 포커스 트랩 (모달 내부)

### 스크린 리더
- [ ] 모든 버튼에 적절한 `aria-label`
- [ ] 현재 선택 상태 `aria-selected`
- [ ] 로딩 상태 `aria-busy`
- [ ] 에러 메시지 `aria-live="polite"`

### 색상 대비
- [ ] 텍스트 대비 4.5:1 이상
- [ ] 인터랙티브 요소 대비 3:1 이상
- [ ] 포커스 링 명확히 표시

---

## 다음 Phase 연결점

### Phase 2 (Preview)에서 확장할 부분
- `center-preview.tsx`: 디바이스 프레임 + `PublicPageView` 렌더링 추가

### Phase 3 (Settings)에서 확장할 부분
- `right-settings.tsx`: 헤더/테마/SEO 설정 폼 추가

### Phase 4 (Carousel)에서 확장할 부분
- `center-preview.tsx`: GSAP 캐러셀 애니메이션 추가

### Phase 5 (Auto-Save)에서 확장할 부분
- `use-auto-save.tsx` 훅 추가
- `console-header.tsx`: 발행 기능 연결
