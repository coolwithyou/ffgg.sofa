# Phase 2: Preview System - 디바이스 프레임 프리뷰

> 모바일 디바이스 프레임 안에 `PublicPageView`를 직접 렌더링하여 실시간 WYSIWYG 프리뷰를 제공합니다.

## 개요

### 목표
- iPhone 스타일 디바이스 프레임 구현
- 기존 `PublicPageView` 컴포넌트 재사용
- 실시간 테마/설정 변경 반영

### 의존성
- **Phase 1**: ConsoleContext, CenterPreview 기본 구조

### 다음 Phase 준비
- Phase 3: 설정 변경 시 프리뷰 즉시 반영
- Phase 4: 캐러셀 슬라이드 컨테이너 추가

---

## 전체 맥락에서의 역할

```
┌─────────────────────────────────────────────────────────────────┐
│                     Phase 2: Preview System                      │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                    center-preview.tsx                      │  │
│  │  ┌─────────────────────────────────────────────────────┐  │  │
│  │  │              device-frame.tsx                        │  │  │
│  │  │  ┌───────────────────────────────────────────────┐  │  │  │
│  │  │  │                                               │  │  │  │
│  │  │  │            PublicPageView                     │  │  │  │
│  │  │  │       (기존 컴포넌트 직접 렌더링)              │  │  │  │
│  │  │  │                                               │  │  │  │
│  │  │  │  ┌─────────────────────────────────────────┐  │  │  │  │
│  │  │  │  │ HeaderBlock (제목, 설명, 로고)          │  │  │  │  │
│  │  │  │  └─────────────────────────────────────────┘  │  │  │  │
│  │  │  │  ┌─────────────────────────────────────────┐  │  │  │  │
│  │  │  │  │ ChatbotBlock (채팅 UI)                  │  │  │  │  │
│  │  │  │  └─────────────────────────────────────────┘  │  │  │  │
│  │  │  │  ┌─────────────────────────────────────────┐  │  │  │  │
│  │  │  │  │ Footer (Powered by SOFA)                │  │  │  │  │
│  │  │  │  └─────────────────────────────────────────┘  │  │  │  │
│  │  │  │                                               │  │  │  │
│  │  │  └───────────────────────────────────────────────┘  │  │  │
│  │  └─────────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 구현 상세

### 1. DeviceFrame 컴포넌트

**파일**: `app/(console)/console/components/device-frame.tsx`

```typescript
'use client';

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface DeviceFrameProps {
  children: ReactNode;
  className?: string;
  isLoading?: boolean;
}

/**
 * 디바이스 프레임 설정
 *
 * 주의: 물리적 디바이스 시뮬레이션이므로 테마 색상을 사용하지 않음
 */
const DEVICE_CONFIG = {
  width: 375,
  height: 667,
  padding: 12,
  borderRadius: {
    outer: 40,
    inner: 28,
  },
  colors: {
    frame: '#1f2937',       // 디바이스 프레임 (고정)
    homeIndicator: '#4b5563', // 홈 인디케이터 (고정)
  },
} as const;

/**
 * iPhone 스타일 디바이스 프레임
 *
 * 디자인 결정:
 * - 375x667 (iPhone SE 기준) - 가장 보편적인 모바일 뷰포트
 * - 둥근 테두리와 노치로 실제 디바이스 느낌 제공
 * - 그림자로 깊이감 추가
 *
 * 색상 참고:
 * - 프레임 색상은 물리적 디바이스를 시뮬레이션하므로
 *   시맨틱 토큰 대신 고정값 사용 (DEVICE_CONFIG 참조)
 */
export function DeviceFrame({ children, className, isLoading }: DeviceFrameProps) {
  return (
    <div
      className={cn(
        'relative flex flex-col overflow-hidden shadow-2xl',
        className
      )}
      style={{
        width: DEVICE_CONFIG.width,
        height: DEVICE_CONFIG.height,
        padding: DEVICE_CONFIG.padding,
        borderRadius: DEVICE_CONFIG.borderRadius.outer,
        backgroundColor: DEVICE_CONFIG.colors.frame,
      }}
    >
      {/* 노치 (상단 센서 영역) */}
      <div
        className="absolute left-1/2 top-3 z-10 h-6 w-32 -translate-x-1/2 rounded-full"
        style={{ backgroundColor: DEVICE_CONFIG.colors.frame }}
      />

      {/* 내부 스크린 - bg-card로 테마 적응 */}
      <div
        className="relative flex-1 overflow-hidden bg-card"
        style={{ borderRadius: DEVICE_CONFIG.borderRadius.inner }}
      >
        {/* 상단 상태바 공간 */}
        <div className="h-11 w-full bg-inherit" />

        {/* 콘텐츠 영역 */}
        <div className="h-[calc(100%-44px)] overflow-y-auto">
          {isLoading ? <DeviceFrameSkeleton /> : children}
        </div>
      </div>

      {/* 하단 홈 인디케이터 */}
      <div
        className="absolute bottom-2 left-1/2 h-1 w-32 -translate-x-1/2 rounded-full"
        style={{ backgroundColor: DEVICE_CONFIG.colors.homeIndicator }}
      />
    </div>
  );
}

/**
 * 디바이스 프레임 내부 로딩 스켈레톤
 */
function DeviceFrameSkeleton() {
  return (
    <div className="flex h-full flex-col gap-4 p-4">
      {/* 헤더 스켈레톤 */}
      <div className="space-y-3">
        <Skeleton className="h-10 w-10 rounded-full" />
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
      </div>

      {/* 채팅 영역 스켈레톤 */}
      <div className="flex-1 space-y-3">
        <Skeleton className="ml-auto h-12 w-2/3 rounded-2xl" />
        <Skeleton className="h-16 w-3/4 rounded-2xl" />
        <Skeleton className="ml-auto h-10 w-1/2 rounded-2xl" />
      </div>

      {/* 입력 영역 스켈레톤 */}
      <Skeleton className="h-12 w-full rounded-full" />
    </div>
  );
}

// Skeleton 컴포넌트 import 필요
import { Skeleton } from '@/components/ui/skeleton';
```

---

### 2. PreviewContent 컴포넌트 (PublicPageView 래퍼)

**파일**: `app/(console)/console/components/preview-content.tsx`

```typescript
'use client';

import { useCurrentChatbot, usePageConfig } from '../hooks/use-console-state';
import { PublicPageView } from '@/app/[slug]/public-page-view';

/**
 * 프리뷰 콘텐츠
 *
 * 기존 PublicPageView를 Context의 상태와 연결하여
 * 실시간 변경사항이 반영되도록 합니다.
 */
export function PreviewContent() {
  const { currentChatbot } = useCurrentChatbot();
  const { pageConfig } = usePageConfig();

  if (!currentChatbot) {
    return (
      <div className="flex h-full items-center justify-center bg-muted">
        <p className="text-sm text-muted-foreground">챗봇을 선택해주세요</p>
      </div>
    );
  }

  // PublicPageView에 필요한 props 구성
  // config는 Context의 실시간 상태를 사용
  return (
    <PublicPageView
      chatbotId={currentChatbot.id}
      chatbotName={currentChatbot.name}
      tenantId={currentChatbot.tenantId}
      config={pageConfig}
      widgetConfig={null} // 위젯 설정은 별도 관리
    />
  );
}
```

---

### 3. CenterPreview 업데이트

**파일**: `app/(console)/console/components/center-preview.tsx`

```typescript
'use client';

import { useCurrentChatbot } from '../hooks/use-console-state';
import { DeviceFrame } from './device-frame';
import { PreviewContent } from './preview-content';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';

/**
 * 중앙 프리뷰 영역
 *
 * 디자인 결정:
 * - 좌측에 새 챗봇 추가 버튼
 * - 중앙에 디바이스 프레임
 * - 좌우에 네비게이션 화살표 (Phase 4에서 GSAP 연동)
 */
export function CenterPreview() {
  const { currentChatbot, chatbots, navigateChatbot, currentChatbotIndex } =
    useCurrentChatbot();

  const hasPrev = currentChatbotIndex > 0;
  const hasNext = currentChatbotIndex < chatbots.length - 1;

  return (
    <main className="flex flex-1 items-center justify-center bg-muted/30 p-8">
      <div className="flex items-center gap-6">
        {/* 새 챗봇 추가 버튼 */}
        <Button
          variant="outline"
          size="icon"
          className="h-12 w-12 rounded-full"
          title="새 챗봇 추가"
        >
          <Plus className="h-5 w-5" />
        </Button>

        {/* 이전 화살표 */}
        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10 rounded-full"
          onClick={() => navigateChatbot('prev')}
          disabled={!hasPrev}
        >
          <ChevronLeft className="h-6 w-6" />
        </Button>

        {/* 디바이스 프레임 + 프리뷰 */}
        <div className="relative">
          {/* 챗봇 이름 라벨 */}
          {currentChatbot && (
            <div className="absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap">
              <span className="text-sm font-medium text-foreground">
                {currentChatbot.name}
              </span>
              {currentChatbot.slug && (
                <span className="ml-2 text-xs text-muted-foreground">
                  /{currentChatbot.slug}
                </span>
              )}
            </div>
          )}

          <DeviceFrame>
            <PreviewContent />
          </DeviceFrame>

          {/* 인디케이터 (페이지네이션 점) */}
          {chatbots.length > 1 && (
            <div className="absolute -bottom-8 left-1/2 flex -translate-x-1/2 gap-2">
              {chatbots.map((_, index) => (
                <div
                  key={index}
                  className={`h-2 w-2 rounded-full transition-colors ${
                    index === currentChatbotIndex
                      ? 'bg-primary'
                      : 'bg-muted-foreground/30'
                  }`}
                />
              ))}
            </div>
          )}
        </div>

        {/* 다음 화살표 */}
        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10 rounded-full"
          onClick={() => navigateChatbot('next')}
          disabled={!hasNext}
        >
          <ChevronRight className="h-6 w-6" />
        </Button>
      </div>
    </main>
  );
}
```

---

### 4. PublicPageView 수정 (프리뷰 모드 지원)

기존 `PublicPageView`는 실제 페이지용이므로, 프리뷰 모드에서도 정상 동작하도록 약간의 조정이 필요할 수 있습니다.

**고려사항**:
- 채팅 기능은 프리뷰에서도 동작해야 하는가?
- → MVP에서는 UI만 보여주고, 실제 채팅은 비활성화 권장

**파일**: `app/[slug]/public-page-view.tsx` (선택적 수정)

```typescript
// 기존 PublicPageView에 isPreview prop 추가 (선택사항)
interface PublicPageViewProps {
  chatbotId: string;
  chatbotName: string;
  tenantId: string;
  config: PublicPageConfig;
  widgetConfig?: Record<string, unknown> | null;
  isPreview?: boolean; // 프리뷰 모드 여부
}

// ChatbotBlock에 isPreview 전달하여
// 프리뷰 모드에서는 실제 API 호출 대신 더미 메시지 표시 가능
```

> **결정**: MVP에서는 기존 PublicPageView를 그대로 사용합니다. 채팅 기능도 프리뷰에서 동작하도록 허용합니다. 필요시 후속으로 프리뷰 전용 모드 추가.

---

## 스타일 가이드

### 디바이스 프레임 스펙

| 속성 | 값 | 설명 |
|------|-----|------|
| 너비 | 375px | iPhone SE 기준 |
| 높이 | 667px | iPhone SE 기준 |
| 외부 패딩 | 12px | 프레임 두께 |
| 외부 radius | 40px | 디바이스 둥글기 |
| 내부 radius | 28px | 스크린 둥글기 |
| 프레임 색상 | gray-900 | 다크 프레임 |

### 시맨틱 컬러 토큰 가이드

#### 디바이스 프레임 (예외적 하드코딩 허용)

디바이스 프레임은 **물리적 기기를 시뮬레이션**하는 특수 컴포넌트로, 테마 변경과 무관하게 일관된 외관을 유지해야 합니다.

```typescript
// 디바이스 프레임 전용 색상 (테마 불변)
const DEVICE_COLORS = {
  frame: '#1f2937',      // 프레임 외곽 (gray-800 상당)
  notch: '#1f2937',      // 노치 영역
  homeIndicator: '#4b5563', // 하단 홈 인디케이터 (gray-600 상당)
} as const;
```

#### 일반 UI 요소 (시맨틱 토큰 필수)

디바이스 프레임을 제외한 모든 UI 요소는 시맨틱 토큰을 사용합니다.

| 하드코딩 금지 | 시맨틱 토큰 |
|--------------|------------|
| `bg-white` | `bg-card` 또는 `bg-background` |
| `bg-gray-100` | `bg-muted` |
| `text-gray-900` | `text-foreground` |
| `text-gray-500` | `text-muted-foreground` |
| `border-gray-200` | `border-border` |

#### 프리뷰 내부 콘텐츠

내부 콘텐츠(PublicPageView)는 사용자가 설정한 테마 색상을 따릅니다. CSS 변수를 통해 동적으로 적용됩니다.

```typescript
// PreviewContent 내부에서 테마 적용
<div
  style={{
    '--preview-primary': pageConfig.theme.primaryColor,
    '--preview-bg': pageConfig.theme.backgroundColor,
    '--preview-text': pageConfig.theme.textColor,
  } as React.CSSProperties}
>
  <PublicPageView config={pageConfig} />
</div>
```

---

## 완료 체크리스트

### 필수
- [ ] `device-frame.tsx` 생성
- [ ] `preview-content.tsx` 생성
- [ ] `center-preview.tsx` 업데이트

### 검증
- [ ] 디바이스 프레임 정상 렌더링
- [ ] PublicPageView 내부 표시
- [ ] Context의 pageConfig 변경 시 프리뷰 즉시 반영
- [ ] 이전/다음 네비게이션 버튼 동작
- [ ] 페이지네이션 인디케이터 표시

---

## 다음 Phase 연결점

### Phase 3 (Settings Panel)에서 연동
- RightSettings에서 설정 변경 시 → Context 업데이트 → 프리뷰 자동 반영

### Phase 4 (Carousel)에서 확장
- 네비게이션 버튼 클릭 시 GSAP 애니메이션 추가
- 디바이스 프레임 슬라이드 효과

---

## 기술 노트

### iframe vs 직접 렌더링 상세 비교

Console Editor의 프리뷰 시스템은 **직접 렌더링** 방식을 채택합니다.

#### 비교 분석

| 기준 | iframe 방식 | 직접 렌더링 방식 (선택) |
|------|-------------|------------------------|
| **Context 연동** | postMessage 필요 | 직접 props 전달 ✓ |
| **실시간 반영** | 지연 발생 가능 | 즉시 반영 ✓ |
| **스타일 격리** | 완전 격리 ✓ | CSS 변수로 격리 |
| **번들 크기** | 중복 로드 | 컴포넌트 재사용 ✓ |
| **디버깅** | DevTools 분리 | 통합 디버깅 ✓ |
| **접근성** | 별도 처리 필요 | 자동 상속 ✓ |

#### 직접 렌더링이 가능한 이유

1. **CSS 변수 기반 테마 시스템**
   ```typescript
   // PublicPageView는 CSS 변수를 통해 테마를 적용
   // 부모 컴포넌트(DeviceFrame)와 스타일 충돌 없음
   :root {
     --page-primary: oklch(0.7 0.15 250);
     --page-background: oklch(0.98 0 0);
   }
   ```

2. **Scoped 스타일 적용**
   ```typescript
   // DeviceFrame 내부는 독립적인 스타일 컨텍스트
   <div className="device-screen">
     <div style={pageThemeStyles}>
       <PublicPageView /> {/* 격리된 테마 적용 */}
     </div>
   </div>
   ```

3. **컴포넌트 재사용**
   - 실제 배포되는 `PublicPageView`와 동일한 컴포넌트 사용
   - 프리뷰와 실제 결과물의 일관성 보장

#### 직접 렌더링 아키텍처

```
┌─────────────────────────────────────────────────────────┐
│                    ConsoleContext                        │
│  (pageConfig, currentChatbot, saveStatus 등)            │
└────────────────────────┬────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────┐
│                    PreviewContent                        │
│  - Context에서 config 구독                               │
│  - CSS 변수로 테마 주입                                   │
└────────────────────────┬────────────────────────────────┘
                         │ props 전달
                         ▼
┌─────────────────────────────────────────────────────────┐
│                   PublicPageView                         │
│  - 실제 배포용 컴포넌트 그대로 사용                        │
│  - HeaderBlock + ChatbotBlock + Footer                   │
└─────────────────────────────────────────────────────────┘
```

#### 프리뷰 모드 vs 실제 모드

```typescript
interface PreviewModeConfig {
  // 프리뷰에서 비활성화할 기능
  disableAnalytics: true;     // GA 등 분석 도구
  disableExternalLinks: true; // 외부 링크 새 탭 열기
  mockChatResponses: false;   // MVP: 실제 채팅 허용

  // 프리뷰 전용 UI
  showGridOverlay: false;     // 개발자용 그리드
  highlightChanges: false;    // 변경 영역 하이라이트 (후속)
}
```

### 성능 최적화

#### 리렌더링 방지 전략

```typescript
// 1. Context 슬라이스 분리
const { pageConfig } = usePageConfig();        // pageConfig만 구독
const { currentChatbot } = useCurrentChatbot(); // chatbot만 구독

// 2. 메모이제이션
const memoizedConfig = useMemo(() => ({
  ...pageConfig,
  // 자주 변경되지 않는 값 캐싱
}), [pageConfig.header, pageConfig.theme]);

// 3. 프리뷰 디바운싱 (빠른 입력 시)
const debouncedConfig = useDebouncedValue(pageConfig, 100);
```

#### 렌더링 최적화 체크리스트

- [ ] `React.memo`로 불필요한 리렌더링 방지
- [ ] Context selector 패턴으로 세밀한 구독
- [ ] 테마 변경은 CSS 변수로 처리 (리렌더링 최소화)
- [ ] 대용량 콘텐츠는 가상화 고려
