'use client';

import { useCurrentChatbot } from '../hooks/use-console-state';
import { ChatbotCarousel } from './chatbot-carousel';

/**
 * 중앙 프리뷰 영역
 *
 * Phase 4에서 ChatbotCarousel로 업데이트:
 * - GSAP 기반 슬라이드 애니메이션
 * - 키보드 네비게이션 지원 (좌/우 화살표, 1-9 숫자키)
 * - 접근성 고려 (ARIA 속성, prefers-reduced-motion)
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
