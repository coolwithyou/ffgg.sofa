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
