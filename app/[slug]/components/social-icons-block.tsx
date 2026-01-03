'use client';

/**
 * 소셜 아이콘 블록 컴포넌트
 *
 * 소셜 미디어 링크를 아이콘으로 표시합니다.
 * - 지원 플랫폼: Instagram, Twitter, Facebook, YouTube, TikTok, LinkedIn, GitHub, Website
 * - 크기: sm, md, lg
 * - 스타일: default, filled, outline
 */

import {
  Instagram,
  Twitter,
  Facebook,
  Youtube,
  Linkedin,
  Github,
  Globe,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type {
  SocialIconItem,
  SocialIconType,
  SocialIconsBlockSize,
  SocialIconsBlockStyle,
} from '@/lib/public-page/block-types';

// TikTok 아이콘 (lucide에 없으므로 커스텀)
function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z" />
    </svg>
  );
}

/**
 * 아이콘 타입별 컴포넌트 매핑
 */
const ICON_COMPONENTS: Record<SocialIconType, LucideIcon | typeof TikTokIcon> = {
  instagram: Instagram,
  twitter: Twitter,
  facebook: Facebook,
  youtube: Youtube,
  tiktok: TikTokIcon,
  linkedin: Linkedin,
  github: Github,
  website: Globe,
};

/**
 * 아이콘 타입별 라벨
 */
const ICON_LABELS: Record<SocialIconType, string> = {
  instagram: 'Instagram',
  twitter: 'Twitter',
  facebook: 'Facebook',
  youtube: 'YouTube',
  tiktok: 'TikTok',
  linkedin: 'LinkedIn',
  github: 'GitHub',
  website: 'Website',
};

/**
 * 크기별 클래스 매핑
 */
const SIZE_CLASSES: Record<SocialIconsBlockSize, { container: string; icon: string }> = {
  sm: { container: 'h-8 w-8', icon: 'h-4 w-4' },
  md: { container: 'h-10 w-10', icon: 'h-5 w-5' },
  lg: { container: 'h-12 w-12', icon: 'h-6 w-6' },
};

/**
 * 스타일별 클래스 매핑
 */
const STYLE_CLASSES: Record<SocialIconsBlockStyle, string> = {
  default: 'text-foreground hover:text-primary',
  filled: 'bg-primary text-primary-foreground hover:bg-primary/90',
  outline: 'border border-border text-foreground hover:border-primary hover:text-primary',
};

interface SocialIconsBlockProps {
  icons: SocialIconItem[];
  size: SocialIconsBlockSize;
  style: SocialIconsBlockStyle;
  primaryColor?: string;
}

export function SocialIconsBlock({
  icons,
  size,
  style,
  primaryColor,
}: SocialIconsBlockProps) {
  // 아이콘이 없으면 빈 상태 표시
  if (!icons || icons.length === 0) {
    return (
      <div className="flex w-full items-center justify-center py-4 text-sm text-muted-foreground">
        소셜 아이콘을 추가하세요
      </div>
    );
  }

  return (
    <div className="flex w-full flex-wrap items-center justify-center gap-3 py-2">
      {icons.map((icon, index) => {
        const IconComponent = ICON_COMPONENTS[icon.type];
        const label = ICON_LABELS[icon.type];
        const sizeClass = SIZE_CLASSES[size];
        const isDisabled = !icon.url || icon.url.trim() === '';

        return (
          <a
            key={`${icon.type}-${index}`}
            href={isDisabled ? undefined : icon.url}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              'flex items-center justify-center rounded-full transition-all',
              sizeClass.container,
              STYLE_CLASSES[style],
              isDisabled && 'pointer-events-none opacity-50'
            )}
            style={
              primaryColor && style === 'filled'
                ? { backgroundColor: primaryColor }
                : undefined
            }
            aria-label={label}
            aria-disabled={isDisabled}
          >
            <IconComponent className={sizeClass.icon} />
          </a>
        );
      })}
    </div>
  );
}
