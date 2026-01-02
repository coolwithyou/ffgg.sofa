# Phase 4: GSAP Carousel - 챗봇 전환 애니메이션

> GSAP를 활용하여 챗봇 간 전환 시 부드러운 슬라이드 애니메이션을 구현합니다.

## 개요

### 목표
- GSAP 라이브러리 설치 및 설정
- 챗봇 전환 시 슬라이드 애니메이션
- 터치/스와이프 제스처 지원 (선택사항)

### 의존성
- **Phase 1**: ConsoleContext, navigateChatbot 액션
- **Phase 2**: CenterPreview, DeviceFrame

### MVP 포함 여부
- MVP에 포함 (핵심 UX 요소)

---

## 전체 맥락에서의 역할

```
┌─────────────────────────────────────────────────────────────────┐
│                   Phase 4: GSAP Carousel                         │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                 chatbot-carousel.tsx                       │  │
│  │                                                            │  │
│  │   ← 버튼 클릭                                               │  │
│  │        ↓                                                   │  │
│  │   navigateChatbot('prev')                                  │  │
│  │        ↓                                                   │  │
│  │   currentChatbotIndex 변경                                  │  │
│  │        ↓                                                   │  │
│  │   useEffect 감지                                           │  │
│  │        ↓                                                   │  │
│  │   gsap.to(container, { x: -newIndex * slideWidth })        │  │
│  │        ↓                                                   │  │
│  │   ┌─────┬─────┬─────┐                                      │  │
│  │   │ 🤖1 │ 🤖2 │ 🤖3 │  ← 슬라이드 이동                      │  │
│  │   └─────┴─────┴─────┘                                      │  │
│  │                                                            │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 구현 상세

### 1. GSAP 설치

```bash
pnpm add gsap
```

**참고**: GSAP는 클라이언트 사이드에서만 동작합니다. `'use client'` 지시문이 있는 컴포넌트에서 사용해야 합니다.

---

### 2. ChatbotCarousel 컴포넌트

**파일**: `app/(console)/console/components/chatbot-carousel.tsx`

```typescript
'use client';

import { useRef, useEffect, useCallback } from 'react';
import { gsap } from 'gsap';
import { useCurrentChatbot, usePageConfig } from '../hooks/use-console-state';
import { DeviceFrame } from './device-frame';
import { PreviewContent } from './preview-content';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';

// 슬라이드 설정
const SLIDE_CONFIG = {
  width: 375 + 48, // DeviceFrame 너비 + 간격
  duration: 0.5,
  ease: 'power2.out',
};

export function ChatbotCarousel() {
  const containerRef = useRef<HTMLDivElement>(null);
  const isAnimatingRef = useRef(false);

  const { chatbots, currentChatbotIndex, navigateChatbot, selectChatbot } =
    useCurrentChatbot();

  // 애니메이션 실행
  const animateToIndex = useCallback((index: number) => {
    if (!containerRef.current || isAnimatingRef.current) return;

    isAnimatingRef.current = true;

    gsap.to(containerRef.current, {
      x: -index * SLIDE_CONFIG.width,
      duration: SLIDE_CONFIG.duration,
      ease: SLIDE_CONFIG.ease,
      onComplete: () => {
        isAnimatingRef.current = false;
      },
    });
  }, []);

  // 인덱스 변경 시 애니메이션
  useEffect(() => {
    animateToIndex(currentChatbotIndex);
  }, [currentChatbotIndex, animateToIndex]);

  // 이전 챗봇
  const handlePrev = useCallback(() => {
    if (currentChatbotIndex > 0 && !isAnimatingRef.current) {
      navigateChatbot('prev');
    }
  }, [currentChatbotIndex, navigateChatbot]);

  // 다음 챗봇
  const handleNext = useCallback(() => {
    if (currentChatbotIndex < chatbots.length - 1 && !isAnimatingRef.current) {
      navigateChatbot('next');
    }
  }, [currentChatbotIndex, chatbots.length, navigateChatbot]);

  // 키보드 네비게이션
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        handlePrev();
      } else if (e.key === 'ArrowRight') {
        handleNext();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handlePrev, handleNext]);

  const hasPrev = currentChatbotIndex > 0;
  const hasNext = currentChatbotIndex < chatbots.length - 1;

  return (
    <div className="flex items-center gap-6">
      {/* 새 챗봇 추가 버튼 */}
      <Button
        variant="outline"
        size="icon"
        className="h-12 w-12 flex-shrink-0 rounded-full"
        title="새 챗봇 추가"
      >
        <Plus className="h-5 w-5" />
      </Button>

      {/* 이전 버튼 */}
      <Button
        variant="ghost"
        size="icon"
        className="h-10 w-10 flex-shrink-0 rounded-full"
        onClick={handlePrev}
        disabled={!hasPrev}
      >
        <ChevronLeft className="h-6 w-6" />
      </Button>

      {/* 캐러셀 뷰포트 */}
      <div
        className="relative overflow-hidden"
        style={{ width: SLIDE_CONFIG.width - 48 }}
      >
        {/* 현재 챗봇 라벨 */}
        {chatbots[currentChatbotIndex] && (
          <div className="absolute -top-8 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap">
            <span className="text-sm font-medium text-foreground">
              {chatbots[currentChatbotIndex].name}
            </span>
            {chatbots[currentChatbotIndex].slug && (
              <span className="ml-2 text-xs text-muted-foreground">
                /{chatbots[currentChatbotIndex].slug}
              </span>
            )}
          </div>
        )}

        {/* 슬라이드 컨테이너 */}
        <div
          ref={containerRef}
          className="flex"
          style={{ gap: 48, transform: 'translateX(0)' }}
        >
          {chatbots.map((bot, index) => (
            <div
              key={bot.id}
              className="flex-shrink-0"
              style={{ width: 375 }}
            >
              <CarouselSlide
                chatbotId={bot.id}
                isActive={index === currentChatbotIndex}
              />
            </div>
          ))}
        </div>

        {/* 인디케이터 */}
        {chatbots.length > 1 && (
          <div className="absolute -bottom-8 left-1/2 flex -translate-x-1/2 gap-2">
            {chatbots.map((_, index) => (
              <button
                key={index}
                type="button"
                onClick={() => selectChatbot(index)}
                className={`h-2 w-2 rounded-full transition-colors ${
                  index === currentChatbotIndex
                    ? 'bg-primary'
                    : 'bg-muted-foreground/30 hover:bg-muted-foreground/50'
                }`}
                aria-label={`챗봇 ${index + 1}로 이동`}
              />
            ))}
          </div>
        )}
      </div>

      {/* 다음 버튼 */}
      <Button
        variant="ghost"
        size="icon"
        className="h-10 w-10 flex-shrink-0 rounded-full"
        onClick={handleNext}
        disabled={!hasNext}
      >
        <ChevronRight className="h-6 w-6" />
      </Button>
    </div>
  );
}

// 개별 슬라이드 컴포넌트 (메모이제이션)
interface CarouselSlideProps {
  chatbotId: string;
  isActive: boolean;
}

function CarouselSlide({ chatbotId, isActive }: CarouselSlideProps) {
  return (
    <DeviceFrame
      className={`transition-opacity duration-300 ${
        isActive ? 'opacity-100' : 'opacity-50'
      }`}
    >
      {isActive ? (
        <PreviewContent />
      ) : (
        // 비활성 슬라이드는 간단한 플레이스홀더
        <div className="flex h-full items-center justify-center bg-muted">
          <p className="text-sm text-muted-foreground">선택하여 편집</p>
        </div>
      )}
    </DeviceFrame>
  );
}
```

---

### 3. CenterPreview 업데이트 (캐러셀 통합)

**파일**: `app/(console)/console/components/center-preview.tsx`

```typescript
'use client';

import { useCurrentChatbot } from '../hooks/use-console-state';
import { ChatbotCarousel } from './chatbot-carousel';

/**
 * 중앙 프리뷰 영역
 *
 * Phase 4에서 ChatbotCarousel로 대체
 */
export function CenterPreview() {
  const { chatbots } = useCurrentChatbot();

  if (chatbots.length === 0) {
    return (
      <main className="flex flex-1 items-center justify-center bg-muted/30">
        <div className="text-center">
          <p className="text-lg font-medium text-foreground">
            아직 챗봇이 없습니다
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            새 챗봇을 추가하여 시작하세요
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center bg-muted/30 p-8">
      <ChatbotCarousel />
    </main>
  );
}
```

---

### 4. 터치/스와이프 제스처 (선택사항)

터치 제스처를 추가하려면 다음과 같이 확장할 수 있습니다:

**파일**: `app/(console)/console/hooks/use-swipe.tsx`

```typescript
'use client';

import { useRef, useCallback, useEffect } from 'react';

interface SwipeConfig {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  threshold?: number;
}

export function useSwipe(ref: React.RefObject<HTMLElement>, config: SwipeConfig) {
  const startX = useRef(0);
  const { onSwipeLeft, onSwipeRight, threshold = 50 } = config;

  const handleTouchStart = useCallback((e: TouchEvent) => {
    startX.current = e.touches[0].clientX;
  }, []);

  const handleTouchEnd = useCallback(
    (e: TouchEvent) => {
      const endX = e.changedTouches[0].clientX;
      const diff = startX.current - endX;

      if (Math.abs(diff) > threshold) {
        if (diff > 0) {
          onSwipeLeft?.();
        } else {
          onSwipeRight?.();
        }
      }
    },
    [onSwipeLeft, onSwipeRight, threshold]
  );

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    element.addEventListener('touchstart', handleTouchStart, { passive: true });
    element.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchend', handleTouchEnd);
    };
  }, [ref, handleTouchStart, handleTouchEnd]);
}
```

**ChatbotCarousel에 적용**:

```typescript
// ChatbotCarousel 내부에 추가
const viewportRef = useRef<HTMLDivElement>(null);

useSwipe(viewportRef, {
  onSwipeLeft: handleNext,
  onSwipeRight: handlePrev,
});

// 뷰포트 div에 ref 추가
<div ref={viewportRef} className="relative overflow-hidden" ...>
```

---

## 애니메이션 설정 가이드

### GSAP 이징 옵션

| 이징 | 느낌 | 권장 용도 |
|------|------|----------|
| `power2.out` | 부드럽게 감속 | **기본 권장** |
| `power3.out` | 더 극적인 감속 | 강조 시 |
| `elastic.out` | 탄성 바운스 | 재미있는 UX |
| `back.out` | 약간 오버슈트 | 주의 환기 시 |

### 애니메이션 속도

| 속도 | 값 | 느낌 |
|------|-----|------|
| 빠름 | 0.3s | 스냅 느낌, 빈번한 전환 시 |
| **보통** | **0.5s** | **자연스러움, 권장** |
| 느림 | 0.8s | 드라마틱, 가끔 전환 시 |

---

## 완료 체크리스트

### 필수
- [ ] `pnpm add gsap` 설치
- [ ] `chatbot-carousel.tsx` 생성
- [ ] `center-preview.tsx` 업데이트
- [ ] 슬라이드 애니메이션 동작 확인

### 선택사항
- [ ] `use-swipe.tsx` 훅 생성
- [ ] 터치/스와이프 제스처 지원

### 검증
- [ ] 좌/우 버튼 클릭 시 애니메이션 동작
- [ ] 인디케이터 클릭으로 직접 이동
- [ ] 키보드 좌/우 화살표 지원
- [ ] 애니메이션 중 중복 클릭 방지
- [ ] 첫/마지막 슬라이드에서 버튼 비활성화

---

## 다음 Phase 연결점

### Phase 5 (Auto-Save)에서 고려사항
- 챗봇 전환 시 현재 챗봇의 변경사항 자동 저장
- 새 챗봇 선택 시 해당 챗봇의 설정 로드

---

## 성능 최적화

### 비활성 슬라이드 최적화
- 현재 활성 슬라이드만 `PreviewContent` 렌더링
- 비활성 슬라이드는 플레이스홀더로 대체
- 메모리 및 렌더링 비용 절감

### GSAP 최적화
- `will-change: transform` CSS 속성 자동 적용
- GPU 가속 활용
- 60fps 부드러운 애니메이션

```css
/* DeviceFrame에 추가 권장 */
.device-frame {
  will-change: transform;
  transform: translateZ(0); /* GPU 레이어 생성 */
}
```

---

## 키보드 네비게이션 가이드

### 전체 키보드 단축키 맵

| 키 | 액션 | 컨텍스트 |
|----|------|---------|
| `←` / `ArrowLeft` | 이전 챗봇으로 이동 | 캐러셀 영역 |
| `→` / `ArrowRight` | 다음 챗봇으로 이동 | 캐러셀 영역 |
| `Home` | 첫 번째 챗봇으로 이동 | 캐러셀 영역 |
| `End` | 마지막 챗봇으로 이동 | 캐러셀 영역 |
| `Tab` | 다음 인터랙티브 요소로 포커스 | 전역 |
| `Shift + Tab` | 이전 인터랙티브 요소로 포커스 | 전역 |
| `Enter` / `Space` | 포커스된 버튼 활성화 | 버튼 포커스 시 |
| `1-9` | 해당 번호 챗봇으로 직접 이동 | 캐러셀 영역 |
| `Escape` | 모달/설정 패널 닫기 | 모달 열린 상태 |

---

### 키보드 네비게이션 훅

**파일**: `app/(console)/console/hooks/use-carousel-keyboard.ts`

```typescript
'use client';

import { useEffect, useCallback } from 'react';

interface UseCarouselKeyboardOptions {
  currentIndex: number;
  totalItems: number;
  onNavigate: (direction: 'prev' | 'next') => void;
  onSelectIndex: (index: number) => void;
  isEnabled?: boolean;
}

/**
 * 캐러셀 키보드 네비게이션 훅
 *
 * 지원 키:
 * - 좌/우 화살표: 이전/다음
 * - Home/End: 처음/마지막
 * - 1-9: 직접 인덱스 이동
 */
export function useCarouselKeyboard({
  currentIndex,
  totalItems,
  onNavigate,
  onSelectIndex,
  isEnabled = true,
}: UseCarouselKeyboardOptions) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // 입력 필드에서는 비활성화
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          if (currentIndex > 0) {
            onNavigate('prev');
          }
          break;

        case 'ArrowRight':
          e.preventDefault();
          if (currentIndex < totalItems - 1) {
            onNavigate('next');
          }
          break;

        case 'Home':
          e.preventDefault();
          onSelectIndex(0);
          break;

        case 'End':
          e.preventDefault();
          onSelectIndex(totalItems - 1);
          break;

        // 숫자 키로 직접 이동 (1-9)
        default:
          if (/^[1-9]$/.test(e.key)) {
            const targetIndex = parseInt(e.key, 10) - 1;
            if (targetIndex < totalItems) {
              e.preventDefault();
              onSelectIndex(targetIndex);
            }
          }
          break;
      }
    },
    [currentIndex, totalItems, onNavigate, onSelectIndex]
  );

  useEffect(() => {
    if (!isEnabled) return;

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown, isEnabled]);
}
```

---

### 포커스 관리

```typescript
'use client';

import { useRef, useEffect } from 'react';

/**
 * 포커스 트랩 훅
 * 모달, 사이드 패널 등에서 포커스가 영역 내에 머물도록 함
 */
export function useFocusTrap(isActive: boolean) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isActive || !containerRef.current) return;

    const container = containerRef.current;
    const focusableElements = container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const firstElement = focusableElements[0] as HTMLElement;
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey && document.activeElement === firstElement) {
        e.preventDefault();
        lastElement?.focus();
      } else if (!e.shiftKey && document.activeElement === lastElement) {
        e.preventDefault();
        firstElement?.focus();
      }
    };

    container.addEventListener('keydown', handleTab);

    // 초기 포커스 설정
    firstElement?.focus();

    return () => container.removeEventListener('keydown', handleTab);
  }, [isActive]);

  return containerRef;
}
```

---

### ChatbotCarousel에 키보드 네비게이션 적용

```typescript
// chatbot-carousel.tsx 업데이트

import { useCarouselKeyboard } from '../hooks/use-carousel-keyboard';

export function ChatbotCarousel() {
  const { chatbots, currentChatbotIndex, navigateChatbot, selectChatbot } =
    useCurrentChatbot();

  // 키보드 네비게이션 훅 적용
  useCarouselKeyboard({
    currentIndex: currentChatbotIndex,
    totalItems: chatbots.length,
    onNavigate: navigateChatbot,
    onSelectIndex: selectChatbot,
  });

  return (
    <div
      role="region"
      aria-label="챗봇 캐러셀"
      aria-roledescription="carousel"
      className="flex items-center gap-6"
    >
      {/* 슬라이드 컨테이너 */}
      <div
        role="group"
        aria-label={`${currentChatbotIndex + 1}/${chatbots.length} 슬라이드`}
      >
        {/* ... 슬라이드 내용 */}
      </div>

      {/* 스크린 리더용 안내 */}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {chatbots[currentChatbotIndex]?.name} 선택됨.
        {currentChatbotIndex + 1}/{chatbots.length} 슬라이드.
        좌우 화살표로 이동할 수 있습니다.
      </div>
    </div>
  );
}
```

---

### 포커스 표시 스타일

```typescript
// 포커스 링 스타일 (tailwind.config.ts에 추가 또는 직접 사용)

// 캐러셀 버튼 포커스 스타일
const carouselButtonStyles = `
  focus-visible:outline-none
  focus-visible:ring-2
  focus-visible:ring-primary
  focus-visible:ring-offset-2
  focus-visible:ring-offset-background
`;

// 인디케이터 버튼 포커스 스타일
const indicatorStyles = `
  focus-visible:outline-none
  focus-visible:ring-2
  focus-visible:ring-primary
  focus-visible:scale-150
`;
```

---

### 인디케이터 키보드 지원 강화

```tsx
{/* 인디케이터 (숫자 키 힌트 포함) */}
{chatbots.length > 1 && (
  <div
    role="tablist"
    aria-label="챗봇 선택"
    className="absolute -bottom-8 left-1/2 flex -translate-x-1/2 gap-2"
  >
    {chatbots.map((bot, index) => (
      <button
        key={bot.id}
        type="button"
        role="tab"
        aria-selected={index === currentChatbotIndex}
        aria-label={`${bot.name} (${index + 1}번 키로 이동)`}
        onClick={() => selectChatbot(index)}
        className={`
          h-2 w-2 rounded-full transition-all
          ${index === currentChatbotIndex
            ? 'bg-primary scale-125'
            : 'bg-muted-foreground/30 hover:bg-muted-foreground/50'
          }
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary
        `}
      />
    ))}
  </div>
)}
```

---

## 접근성 고려사항

### ARIA 속성 가이드

| 속성 | 용도 | 적용 위치 |
|------|------|----------|
| `role="region"` | 랜드마크 영역 정의 | 캐러셀 컨테이너 |
| `aria-roledescription="carousel"` | 캐러셀 명시 | 캐러셀 컨테이너 |
| `role="tablist"` / `role="tab"` | 인디케이터 탭 패턴 | 인디케이터 영역 |
| `aria-live="polite"` | 동적 변경 알림 | 상태 안내 영역 |
| `aria-label` | 요소 설명 | 모든 인터랙티브 요소 |

### 스크린 리더 테스트 체크리스트

- [ ] VoiceOver (macOS): `Cmd + F5`로 활성화 후 테스트
- [ ] NVDA (Windows): 무료 스크린 리더로 테스트
- [ ] 포커스 순서가 논리적인지 확인
- [ ] 슬라이드 전환 시 안내 메시지 읽히는지 확인
- [ ] 모든 버튼에 라벨이 있는지 확인

### Reduced Motion 지원

```typescript
// GSAP 애니메이션에 prefers-reduced-motion 적용

const animateToIndex = useCallback((index: number) => {
  if (!containerRef.current || isAnimatingRef.current) return;

  // 사용자의 reduced motion 설정 확인
  const prefersReducedMotion = window.matchMedia(
    '(prefers-reduced-motion: reduce)'
  ).matches;

  isAnimatingRef.current = true;

  gsap.to(containerRef.current, {
    x: -index * SLIDE_CONFIG.width,
    duration: prefersReducedMotion ? 0 : SLIDE_CONFIG.duration, // 즉시 이동
    ease: SLIDE_CONFIG.ease,
    onComplete: () => {
      isAnimatingRef.current = false;
    },
  });
}, []);
```
