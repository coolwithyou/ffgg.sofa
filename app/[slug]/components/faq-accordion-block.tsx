'use client';

/**
 * FAQ 아코디언 블록 컴포넌트
 *
 * 자주 묻는 질문을 아코디언 형태로 표시합니다.
 * - 여러 항목 동시 열기 옵션
 * - 기본 열림 항목 설정
 */

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { FaqItem } from '@/lib/public-page/block-types';

interface FaqAccordionBlockProps {
  items: FaqItem[];
  allowMultiple: boolean;
  defaultOpen?: number;
}

export function FaqAccordionBlock({
  items,
  allowMultiple,
  defaultOpen,
}: FaqAccordionBlockProps) {
  // 열린 항목 인덱스들을 추적
  const [openItems, setOpenItems] = useState<Set<number>>(() => {
    if (defaultOpen !== undefined && defaultOpen >= 0 && defaultOpen < items.length) {
      return new Set([defaultOpen]);
    }
    return new Set();
  });

  // 항목 토글
  const toggleItem = (index: number) => {
    setOpenItems((prev) => {
      const newSet = new Set(prev);

      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        if (!allowMultiple) {
          newSet.clear();
        }
        newSet.add(index);
      }

      return newSet;
    });
  };

  // 항목이 없으면 플레이스홀더 표시
  if (items.length === 0) {
    return (
      <div className="flex min-h-[100px] items-center justify-center rounded-xl border border-border bg-card p-4">
        <span className="text-muted-foreground">FAQ 항목을 추가하세요</span>
      </div>
    );
  }

  return (
    <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
      {items.map((item, index) => {
        const isOpen = openItems.has(index);

        return (
          <div key={index} className="bg-card">
            {/* 질문 헤더 */}
            <button
              onClick={() => toggleItem(index)}
              className="flex w-full items-center justify-between gap-4 p-4 text-left transition-colors hover:bg-muted"
              aria-expanded={isOpen}
            >
              <span className="font-medium text-foreground">
                {item.question || `질문 ${index + 1}`}
              </span>
              <ChevronDown
                className={cn(
                  'h-5 w-5 flex-shrink-0 text-muted-foreground transition-transform duration-200',
                  isOpen && 'rotate-180'
                )}
              />
            </button>

            {/* 답변 콘텐츠 */}
            <div
              className={cn(
                'overflow-hidden transition-all duration-200',
                isOpen ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0'
              )}
            >
              <div className="border-t border-border bg-muted/30 p-4">
                <p className="whitespace-pre-wrap text-muted-foreground">
                  {item.answer || '답변을 입력하세요'}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
