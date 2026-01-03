'use client';

/**
 * 대화 시작 프롬프트 블록 컴포넌트
 *
 * 대화 시작을 위한 프롬프트를 제안합니다.
 * - 카드/버블/미니멀 스타일 지원
 * - 랜덤 표시 옵션
 */

import { useEffect, useState, useMemo } from 'react';
import { Sparkles, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ConversationStarterStyle } from '@/lib/public-page/block-types';

interface ConversationStarterBlockProps {
  prompts: string[];
  randomize: boolean;
  style: ConversationStarterStyle;
  onPromptClick?: (prompt: string) => void;
}

export function ConversationStarterBlock({
  prompts,
  randomize,
  style,
  onPromptClick,
}: ConversationStarterBlockProps) {
  // 랜덤 순서 적용
  const [displayPrompts, setDisplayPrompts] = useState<string[]>([]);

  useEffect(() => {
    if (randomize) {
      const shuffled = [...prompts].sort(() => Math.random() - 0.5);
      setDisplayPrompts(shuffled);
    } else {
      setDisplayPrompts(prompts);
    }
  }, [prompts, randomize]);

  // 프롬프트가 없으면 플레이스홀더 표시
  if (prompts.length === 0) {
    return (
      <div className="flex min-h-[80px] items-center justify-center rounded-xl border border-border bg-card p-4">
        <span className="text-muted-foreground">프롬프트를 추가하세요</span>
      </div>
    );
  }

  // 프롬프트 클릭 핸들러
  const handleClick = (prompt: string) => {
    if (onPromptClick) {
      onPromptClick(prompt);
    } else {
      // TODO: 챗봇에 프롬프트 전송
      console.log('Start conversation with:', prompt);
    }
  };

  // 카드 스타일
  if (style === 'card') {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 px-1">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium text-muted-foreground">
            이런 질문으로 시작해보세요
          </span>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {displayPrompts.map((prompt, index) => (
            <button
              key={index}
              onClick={() => handleClick(prompt)}
              className={cn(
                'flex items-start gap-3 rounded-xl border border-border bg-card p-4',
                'text-left transition-all duration-200 hover:border-primary/50 hover:bg-primary/5'
              )}
            >
              <span className="flex-1 text-sm text-foreground">
                {prompt || `프롬프트 ${index + 1}`}
              </span>
              <ArrowRight className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground" />
            </button>
          ))}
        </div>
      </div>
    );
  }

  // 버블 스타일
  if (style === 'bubble') {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 px-1">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium text-muted-foreground">
            추천 질문
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {displayPrompts.map((prompt, index) => (
            <button
              key={index}
              onClick={() => handleClick(prompt)}
              className={cn(
                'rounded-full bg-primary/10 px-4 py-2 text-sm font-medium text-primary',
                'transition-all duration-200 hover:bg-primary/20'
              )}
            >
              {prompt || `프롬프트 ${index + 1}`}
            </button>
          ))}
        </div>
      </div>
    );
  }

  // 미니멀 스타일
  return (
    <div className="space-y-2">
      {displayPrompts.map((prompt, index) => (
        <button
          key={index}
          onClick={() => handleClick(prompt)}
          className={cn(
            'flex w-full items-center gap-2 text-left text-sm text-muted-foreground',
            'transition-colors hover:text-primary'
          )}
        >
          <span className="text-primary">→</span>
          <span>{prompt || `프롬프트 ${index + 1}`}</span>
        </button>
      ))}
    </div>
  );
}
