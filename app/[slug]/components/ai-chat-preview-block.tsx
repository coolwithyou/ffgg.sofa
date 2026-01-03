'use client';

/**
 * AI 채팅 미리보기 블록 컴포넌트
 *
 * 챗봇 대화 예시를 미리보기로 표시합니다.
 * - 사용자/어시스턴트 메시지 구분
 * - 타이핑 애니메이션 효과 (선택)
 */

import { useEffect, useState } from 'react';
import { Bot, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AiChatMessage } from '@/lib/public-page/block-types';

interface AiChatPreviewBlockProps {
  conversations: AiChatMessage[];
  showTypingAnimation: boolean;
}

export function AiChatPreviewBlock({
  conversations,
  showTypingAnimation,
}: AiChatPreviewBlockProps) {
  // 타이핑 애니메이션을 위한 표시된 메시지 인덱스
  const [visibleCount, setVisibleCount] = useState(
    showTypingAnimation ? 0 : conversations.length
  );
  const [isTyping, setIsTyping] = useState(false);

  // 타이핑 애니메이션 효과
  useEffect(() => {
    if (!showTypingAnimation || visibleCount >= conversations.length) {
      return;
    }

    // 다음 메시지 표시 전 타이핑 인디케이터
    const typingTimeout = setTimeout(() => {
      setIsTyping(true);
    }, 500);

    // 메시지 표시
    const messageTimeout = setTimeout(() => {
      setIsTyping(false);
      setVisibleCount((prev) => prev + 1);
    }, 1500);

    return () => {
      clearTimeout(typingTimeout);
      clearTimeout(messageTimeout);
    };
  }, [showTypingAnimation, visibleCount, conversations.length]);

  // 대화가 없으면 플레이스홀더 표시
  if (conversations.length === 0) {
    return (
      <div className="flex min-h-[100px] items-center justify-center rounded-xl border border-border bg-card p-4">
        <span className="text-muted-foreground">대화 예시를 추가하세요</span>
      </div>
    );
  }

  const visibleMessages = conversations.slice(0, visibleCount);

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      {/* 헤더 */}
      <div className="flex items-center gap-2 border-b border-border bg-muted/30 px-4 py-3">
        <Bot className="h-5 w-5 text-primary" />
        <span className="font-medium text-foreground">AI 채팅 미리보기</span>
      </div>

      {/* 대화 내용 */}
      <div className="space-y-3 p-4">
        {visibleMessages.map((message, index) => (
          <div
            key={index}
            className={cn(
              'flex gap-3',
              message.role === 'user' ? 'justify-end' : 'justify-start'
            )}
          >
            {/* 어시스턴트 아이콘 */}
            {message.role === 'assistant' && (
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary/10">
                <Bot className="h-4 w-4 text-primary" />
              </div>
            )}

            {/* 메시지 버블 */}
            <div
              className={cn(
                'max-w-[80%] rounded-2xl px-4 py-2',
                message.role === 'user'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-foreground'
              )}
            >
              <p className="text-sm whitespace-pre-wrap">{message.content}</p>
            </div>

            {/* 사용자 아이콘 */}
            {message.role === 'user' && (
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-muted">
                <User className="h-4 w-4 text-muted-foreground" />
              </div>
            )}
          </div>
        ))}

        {/* 타이핑 인디케이터 */}
        {isTyping && (
          <div className="flex gap-3">
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary/10">
              <Bot className="h-4 w-4 text-primary" />
            </div>
            <div className="flex items-center gap-1 rounded-2xl bg-muted px-4 py-3">
              <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/50 [animation-delay:0ms]" />
              <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/50 [animation-delay:150ms]" />
              <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/50 [animation-delay:300ms]" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
