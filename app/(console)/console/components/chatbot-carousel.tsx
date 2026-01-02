'use client';

import { useRef, useEffect, useCallback } from 'react';
import { gsap } from 'gsap';
import { useCurrentChatbot } from '../hooks/use-console-state';
import { useCarouselKeyboard } from '../hooks/use-carousel-keyboard';
import { DeviceFrame } from './device-frame';
import { PreviewContent } from './preview-content';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';

/**
 * 슬라이드 설정
 * - width: DeviceFrame 너비(375) + 간격(48)
 * - duration: 애니메이션 지속 시간 (0.5s - 자연스러운 느낌)
 * - ease: power2.out - 부드러운 감속
 */
const SLIDE_CONFIG = {
  width: 375 + 48,
  duration: 0.5,
  ease: 'power2.out',
};

/**
 * 챗봇 캐러셀 컴포넌트
 *
 * GSAP를 활용한 부드러운 슬라이드 애니메이션:
 * - 좌/우 버튼으로 네비게이션
 * - 인디케이터 클릭으로 직접 이동
 * - 키보드 화살표 지원
 * - prefers-reduced-motion 존중
 */
export function ChatbotCarousel() {
  const containerRef = useRef<HTMLDivElement>(null);
  const isAnimatingRef = useRef(false);

  const { chatbots, currentChatbotIndex, navigateChatbot, selectChatbot } =
    useCurrentChatbot();

  // 키보드 네비게이션 훅 적용
  useCarouselKeyboard({
    currentIndex: currentChatbotIndex,
    totalItems: chatbots.length,
    onNavigate: navigateChatbot,
    onSelectIndex: selectChatbot,
  });

  // 애니메이션 실행
  const animateToIndex = useCallback((index: number) => {
    if (!containerRef.current || isAnimatingRef.current) return;

    // 사용자의 reduced motion 설정 확인
    const prefersReducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches;

    isAnimatingRef.current = true;

    gsap.to(containerRef.current, {
      x: -index * SLIDE_CONFIG.width,
      duration: prefersReducedMotion ? 0 : SLIDE_CONFIG.duration,
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

  const hasPrev = currentChatbotIndex > 0;
  const hasNext = currentChatbotIndex < chatbots.length - 1;
  const currentBot = chatbots[currentChatbotIndex];

  return (
    <div
      role="region"
      aria-label="챗봇 캐러셀"
      aria-roledescription="carousel"
      className="flex items-center gap-6"
    >
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
        className="h-10 w-10 flex-shrink-0 rounded-full focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        onClick={handlePrev}
        disabled={!hasPrev}
        aria-label="이전 챗봇"
      >
        <ChevronLeft className="h-6 w-6" />
      </Button>

      {/* 캐러셀 뷰포트 */}
      <div
        className="relative overflow-hidden"
        style={{ width: SLIDE_CONFIG.width - 48 }}
      >
        {/* 현재 챗봇 라벨 */}
        {currentBot && (
          <div className="absolute -top-8 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap">
            <span className="text-sm font-medium text-foreground">
              {currentBot.name}
            </span>
            {currentBot.slug && (
              <span className="ml-2 text-xs text-muted-foreground">
                /{currentBot.slug}
              </span>
            )}
          </div>
        )}

        {/* 슬라이드 컨테이너 */}
        <div
          ref={containerRef}
          className="flex"
          style={{ gap: 48, transform: 'translateX(0)' }}
          role="group"
          aria-label={`${currentChatbotIndex + 1}/${chatbots.length} 슬라이드`}
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
                className={`h-2 w-2 rounded-full transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                  index === currentChatbotIndex
                    ? 'scale-125 bg-primary'
                    : 'bg-muted-foreground/30 hover:bg-muted-foreground/50'
                }`}
              />
            ))}
          </div>
        )}
      </div>

      {/* 다음 버튼 */}
      <Button
        variant="ghost"
        size="icon"
        className="h-10 w-10 flex-shrink-0 rounded-full focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        onClick={handleNext}
        disabled={!hasNext}
        aria-label="다음 챗봇"
      >
        <ChevronRight className="h-6 w-6" />
      </Button>

      {/* 스크린 리더용 안내 */}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {currentBot?.name} 선택됨. {currentChatbotIndex + 1}/{chatbots.length}{' '}
        슬라이드. 좌우 화살표로 이동할 수 있습니다.
      </div>
    </div>
  );
}

/**
 * 개별 슬라이드 컴포넌트
 *
 * 최적화:
 * - 활성 슬라이드만 PreviewContent 렌더링
 * - 비활성 슬라이드는 플레이스홀더로 메모리 절약
 */
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
        <div className="flex h-full items-center justify-center bg-muted">
          <p className="text-sm text-muted-foreground">선택하여 편집</p>
        </div>
      )}
    </DeviceFrame>
  );
}
