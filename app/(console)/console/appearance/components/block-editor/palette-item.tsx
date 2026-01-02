'use client';

/**
 * 팔레트 아이템 컴포넌트
 *
 * 블록 팔레트에서 드래그 가능한 개별 블록 아이템입니다.
 * - 드래그 또는 클릭으로 캔버스에 추가 가능
 * - maxInstances 제한 시 비활성화 표시
 */

import { useDraggable } from '@dnd-kit/core';
import { cn } from '@/lib/utils';
import {
  LayoutTemplate,
  MessageSquare,
  Square,
  Plus,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { BlockMeta, BlockTypeValue } from '@/lib/public-page/block-types';

/**
 * 아이콘 이름 -> 컴포넌트 매핑
 */
const ICON_MAP: Record<string, LucideIcon> = {
  LayoutTemplate,
  MessageSquare,
  Square,
};

interface PaletteItemProps {
  meta: BlockMeta;
  disabled?: boolean;
  onAdd?: () => void;
}

export function PaletteItem({ meta, disabled = false, onAdd }: PaletteItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    isDragging,
    transform,
  } = useDraggable({
    id: `palette-${meta.type}`,
    data: {
      source: 'palette',
      blockType: meta.type,
    },
    disabled,
  });

  const Icon = ICON_MAP[meta.icon] ?? Square;

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={cn(
        'group relative flex items-center gap-3 rounded-lg border border-border bg-card p-3 transition-all',
        isDragging && 'opacity-50',
        disabled
          ? 'cursor-not-allowed opacity-50'
          : 'cursor-grab hover:border-primary/50 hover:bg-muted/50 active:cursor-grabbing'
      )}
    >
      {/* 아이콘 */}
      <div
        className={cn(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-md',
          disabled ? 'bg-muted' : 'bg-primary/10'
        )}
      >
        <Icon
          className={cn(
            'h-5 w-5',
            disabled ? 'text-muted-foreground' : 'text-primary'
          )}
        />
      </div>

      {/* 텍스트 */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">
          {meta.name}
        </p>
        <p className="text-xs text-muted-foreground truncate">
          {meta.description}
        </p>
      </div>

      {/* 추가 버튼 (호버 시 표시) */}
      {!disabled && onAdd && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => {
            e.stopPropagation();
            onAdd();
          }}
        >
          <Plus className="h-4 w-4" />
          <span className="sr-only">블록 추가</span>
        </Button>
      )}

      {/* 비활성화 메시지 */}
      {disabled && meta.maxInstances > 0 && (
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          최대 {meta.maxInstances}개
        </span>
      )}
    </div>
  );
}

/**
 * 드래그 오버레이용 팔레트 아이템
 */
export function PaletteItemOverlay({ meta }: { meta: BlockMeta }) {
  const Icon = ICON_MAP[meta.icon] ?? Square;

  return (
    <div className="flex items-center gap-3 rounded-lg border border-primary bg-card p-3 shadow-lg">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10">
        <Icon className="h-5 w-5 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">{meta.name}</p>
        <p className="text-xs text-muted-foreground">{meta.description}</p>
      </div>
    </div>
  );
}
