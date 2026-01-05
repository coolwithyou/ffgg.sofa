'use client';

/**
 * 프로필 테마 선택 카드
 *
 * 각 프로필 테마의 미리보기와 정보를 표시합니다.
 * - 클래식: 기본 프로필
 * - 솔리드 컬러: 단색 배경
 * - 히어로 이미지: 배경 이미지
 */

import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';
import type { ProfileThemeMeta } from '@/lib/public-page/header-templates';

interface ProfileThemeCardProps {
  /** 테마 키 */
  themeKey: string;
  /** 테마 메타데이터 */
  meta: ProfileThemeMeta;
  /** 선택 여부 */
  selected: boolean;
  /** 선택 핸들러 */
  onSelect: () => void;
}

export function ProfileThemeCard({
  themeKey,
  meta,
  selected,
  onSelect,
}: ProfileThemeCardProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'relative flex flex-col items-start gap-1.5 rounded-lg border p-3 text-left transition-all',
        'hover:border-primary/50 hover:bg-muted/50',
        selected
          ? 'border-primary bg-primary/5 ring-1 ring-primary'
          : 'border-border bg-card'
      )}
    >
      {/* 선택 표시 */}
      {selected && (
        <div className="absolute right-2 top-2 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Check className="h-2.5 w-2.5" />
        </div>
      )}

      {/* 테마 이름 */}
      <div className="text-sm font-medium text-foreground">{meta.name}</div>

      {/* 설명 */}
      <p className="text-xs text-muted-foreground line-clamp-2">
        {meta.description}
      </p>
    </button>
  );
}
