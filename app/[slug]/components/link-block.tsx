'use client';

/**
 * 링크 블록 컴포넌트
 *
 * 외부/내부 링크를 버튼 형태로 표시합니다.
 * - 썸네일, 제목, 설명 지원
 * - 3가지 스타일: default, featured, outline
 * - 새 탭 열기 옵션
 */

import Image from 'next/image';
import { ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { LinkBlockStyle } from '@/lib/public-page/block-types';

interface LinkBlockProps {
  url: string;
  title: string;
  description?: string;
  thumbnail?: string;
  style: LinkBlockStyle;
  openInNewTab: boolean;
  primaryColor?: string;
}

/**
 * 스타일별 클래스 매핑
 */
const STYLE_CLASSES: Record<LinkBlockStyle, string> = {
  default:
    'bg-card border border-border hover:border-primary/50 hover:bg-muted/50',
  featured: 'bg-primary text-primary-foreground hover:bg-primary/90',
  outline:
    'bg-transparent border-2 border-primary text-primary hover:bg-primary/10',
};

export function LinkBlock({
  url,
  title,
  description,
  thumbnail,
  style,
  openInNewTab,
  primaryColor,
}: LinkBlockProps) {
  // URL이 없으면 비활성 상태로 표시
  const isDisabled = !url || url.trim() === '';

  // 링크 속성
  const linkProps = openInNewTab
    ? { target: '_blank', rel: 'noopener noreferrer' }
    : {};

  return (
    <a
      href={isDisabled ? undefined : url}
      {...linkProps}
      className={cn(
        'flex w-full items-center gap-4 rounded-xl p-4 transition-all',
        STYLE_CLASSES[style],
        isDisabled && 'pointer-events-none opacity-50',
        thumbnail ? 'min-h-[80px]' : 'min-h-[56px]'
      )}
      style={
        primaryColor && style === 'featured'
          ? { backgroundColor: primaryColor }
          : primaryColor && style === 'outline'
            ? { borderColor: primaryColor, color: primaryColor }
            : undefined
      }
      aria-disabled={isDisabled}
    >
      {/* 썸네일 */}
      {thumbnail && (
        <div className="relative h-12 w-12 flex-shrink-0 overflow-hidden rounded-lg">
          <Image
            src={thumbnail}
            alt=""
            fill
            className="object-cover"
            sizes="48px"
          />
        </div>
      )}

      {/* 콘텐츠 */}
      <div className="flex flex-1 flex-col gap-0.5 overflow-hidden">
        <span
          className={cn(
            'truncate font-medium',
            style === 'featured'
              ? 'text-primary-foreground'
              : 'text-foreground',
            style === 'outline' && 'text-primary'
          )}
          style={
            style === 'outline' && primaryColor ? { color: primaryColor } : undefined
          }
        >
          {title || '링크 제목'}
        </span>
        {description && (
          <span
            className={cn(
              'truncate text-sm',
              style === 'featured'
                ? 'text-primary-foreground/80'
                : 'text-muted-foreground'
            )}
          >
            {description}
          </span>
        )}
      </div>

      {/* 새 탭 아이콘 */}
      {openInNewTab && !isDisabled && (
        <ExternalLink
          className={cn(
            'h-4 w-4 flex-shrink-0',
            style === 'featured'
              ? 'text-primary-foreground/70'
              : 'text-muted-foreground'
          )}
        />
      )}
    </a>
  );
}
