'use client';

/**
 * 텍스트 블록 컴포넌트
 *
 * 텍스트 콘텐츠를 표시합니다.
 * - 정렬: left, center, right
 * - 크기: sm, md, lg
 */

import { cn } from '@/lib/utils';
import type { TextBlockAlign, TextBlockSize } from '@/lib/public-page/block-types';

interface TextBlockProps {
  content: string;
  align: TextBlockAlign;
  size: TextBlockSize;
}

/**
 * 정렬별 클래스 매핑
 */
const ALIGN_CLASSES: Record<TextBlockAlign, string> = {
  left: 'text-left',
  center: 'text-center',
  right: 'text-right',
};

/**
 * 크기별 클래스 매핑
 */
const SIZE_CLASSES: Record<TextBlockSize, string> = {
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-lg',
};

export function TextBlock({ content, align, size }: TextBlockProps) {
  // 빈 콘텐츠 처리
  if (!content || content.trim() === '') {
    return (
      <div
        className={cn(
          'w-full px-4 py-3 text-muted-foreground/50 italic',
          ALIGN_CLASSES[align],
          SIZE_CLASSES[size]
        )}
      >
        텍스트를 입력하세요
      </div>
    );
  }

  // 줄바꿈을 <br>로 변환하여 표시
  const lines = content.split('\n');

  return (
    <div
      className={cn(
        'w-full whitespace-pre-wrap break-words px-4 py-3 text-foreground',
        ALIGN_CLASSES[align],
        SIZE_CLASSES[size]
      )}
    >
      {lines.map((line, index) => (
        <span key={index}>
          {line}
          {index < lines.length - 1 && <br />}
        </span>
      ))}
    </div>
  );
}
