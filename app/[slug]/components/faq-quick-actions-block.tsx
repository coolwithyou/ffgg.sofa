'use client';

/**
 * FAQ 빠른 액션 블록 컴포넌트
 *
 * 자주 묻는 질문을 버튼으로 표시합니다.
 * - 클릭 시 챗봇에 질문 자동 입력
 * - 버튼/칩/리스트 레이아웃 지원
 */

import { MessageCircle, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { FaqQuickActionItem, FaqQuickActionsLayout } from '@/lib/public-page/block-types';

interface FaqQuickActionsBlockProps {
  questions: FaqQuickActionItem[];
  layout: FaqQuickActionsLayout;
  onQuestionClick?: (question: string) => void;
}

export function FaqQuickActionsBlock({
  questions,
  layout,
  onQuestionClick,
}: FaqQuickActionsBlockProps) {
  // 질문이 없으면 플레이스홀더 표시
  if (questions.length === 0) {
    return (
      <div className="flex min-h-[80px] items-center justify-center rounded-xl border border-border bg-card p-4">
        <span className="text-muted-foreground">질문을 추가하세요</span>
      </div>
    );
  }

  // 질문 클릭 핸들러
  const handleClick = (question: string) => {
    if (onQuestionClick) {
      onQuestionClick(question);
    } else {
      // TODO: 챗봇에 질문 전송
      console.log('Send question to chatbot:', question);
    }
  };

  // 버튼 레이아웃
  if (layout === 'buttons') {
    return (
      <div className="space-y-2">
        {questions.map((item, index) => (
          <button
            key={index}
            onClick={() => handleClick(item.text)}
            className={cn(
              'flex w-full items-center justify-between gap-3 rounded-xl border border-border bg-card p-4',
              'transition-all duration-200 hover:border-primary/50 hover:bg-primary/5'
            )}
          >
            <div className="flex items-center gap-3">
              <MessageCircle className="h-5 w-5 text-primary" />
              <span className="text-left font-medium text-foreground">
                {item.text || `질문 ${index + 1}`}
              </span>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </button>
        ))}
      </div>
    );
  }

  // 칩 레이아웃
  if (layout === 'chips') {
    return (
      <div className="flex flex-wrap gap-2">
        {questions.map((item, index) => (
          <button
            key={index}
            onClick={() => handleClick(item.text)}
            className={cn(
              'inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2',
              'transition-all duration-200 hover:border-primary hover:bg-primary/10'
            )}
          >
            <MessageCircle className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium text-foreground">
              {item.text || `질문 ${index + 1}`}
            </span>
          </button>
        ))}
      </div>
    );
  }

  // 리스트 레이아웃
  return (
    <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
      {questions.map((item, index) => (
        <button
          key={index}
          onClick={() => handleClick(item.text)}
          className={cn(
            'flex w-full items-center justify-between gap-3 px-4 py-3',
            'transition-colors hover:bg-muted'
          )}
        >
          <span className="text-left text-foreground">
            {item.text || `질문 ${index + 1}`}
          </span>
          <ChevronRight className="h-5 w-5 flex-shrink-0 text-muted-foreground" />
        </button>
      ))}
    </div>
  );
}
