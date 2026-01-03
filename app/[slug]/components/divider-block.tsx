'use client';

/**
 * 디바이더 블록 컴포넌트
 *
 * 콘텐츠를 구분하는 시각적 요소입니다.
 * - 스타일: line, dashed, dotted, space
 * - 간격: sm, md, lg
 */

import { cn } from '@/lib/utils';
import type {
  DividerBlockStyle,
  DividerBlockSpacing,
} from '@/lib/public-page/block-types';

interface DividerBlockProps {
  style: DividerBlockStyle;
  spacing: DividerBlockSpacing;
}

/**
 * 스타일별 클래스 매핑
 */
const STYLE_CLASSES: Record<DividerBlockStyle, string> = {
  line: 'border-t border-border',
  dashed: 'border-t border-dashed border-border',
  dotted: 'border-t border-dotted border-border',
  space: 'border-none', // 빈 공간만
};

/**
 * 간격별 클래스 매핑 (상하 여백)
 */
const SPACING_CLASSES: Record<DividerBlockSpacing, string> = {
  sm: 'my-2',
  md: 'my-4',
  lg: 'my-8',
};

export function DividerBlock({ style, spacing }: DividerBlockProps) {
  return (
    <div
      className={cn(
        'w-full',
        SPACING_CLASSES[spacing],
        // space 스타일일 때는 최소 높이 제공
        style === 'space' && 'min-h-[1px]'
      )}
    >
      <hr
        className={cn('w-full', STYLE_CLASSES[style])}
        aria-hidden={style === 'space'}
      />
    </div>
  );
}
