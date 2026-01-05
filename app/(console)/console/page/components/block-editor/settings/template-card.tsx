'use client';

/**
 * 헤더 템플릿 선택 카드
 *
 * 각 헤더 템플릿의 미리보기와 정보를 표시합니다.
 */

import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';
import type { HeaderTemplateMeta } from '@/lib/public-page/header-templates';

interface TemplateCardProps {
  /** 템플릿 키 */
  templateKey: string;
  /** 템플릿 메타데이터 */
  meta: HeaderTemplateMeta;
  /** 선택 여부 */
  selected: boolean;
  /** 선택 핸들러 */
  onSelect: () => void;
}

export function TemplateCard({
  templateKey,
  meta,
  selected,
  onSelect,
}: TemplateCardProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'relative flex flex-col items-start gap-2 rounded-lg border p-3 text-left transition-all',
        'hover:border-primary/50 hover:bg-muted/50',
        selected
          ? 'border-primary bg-primary/5 ring-1 ring-primary'
          : 'border-border bg-card'
      )}
    >
      {/* 선택 표시 */}
      {selected && (
        <div className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Check className="h-3 w-3" />
        </div>
      )}

      {/* 템플릿 이름 */}
      <div className="font-medium text-foreground">{meta.name}</div>

      {/* 설명 */}
      <p className="text-xs text-muted-foreground">{meta.description}</p>

      {/* 주요 특징 태그 */}
      <div className="flex flex-wrap gap-1">
        {meta.features.slice(0, 2).map((feature, index) => (
          <span
            key={index}
            className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground"
          >
            {feature}
          </span>
        ))}
      </div>
    </button>
  );
}
