'use client';

/**
 * 편집 가능한 블록 래퍼
 *
 * 블록을 감싸서 편집 기능을 제공합니다:
 * - 드래그 핸들 (순서 변경)
 * - 가시성 토글
 * - 삭제 버튼
 * - 선택 상태 하이라이트
 */

import { type ReactNode } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Eye, EyeOff, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BLOCK_METAS, type Block } from '@/lib/public-page/block-types';

interface EditableBlockWrapperProps {
  block: Block;
  children: ReactNode;
  isSelected?: boolean;
  onSelect?: () => void;
  onToggleVisibility?: () => void;
  onDelete?: () => void;
}

export function EditableBlockWrapper({
  block,
  children,
  isSelected,
  onSelect,
  onToggleVisibility,
  onDelete,
}: EditableBlockWrapperProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: block.id,
    data: {
      source: 'canvas',
      block,
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const meta = BLOCK_METAS[block.type];

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'group relative',
        isDragging && 'z-50 opacity-50',
        isSelected && 'ring-2 ring-primary ring-offset-2 ring-offset-background rounded-xl'
      )}
      onClick={(e) => {
        e.stopPropagation();
        onSelect?.();
      }}
    >
      {/* 편집 컨트롤 오버레이 */}
      <div
        className={cn(
          'absolute -left-10 top-1/2 -translate-y-1/2 flex flex-col gap-1',
          'opacity-0 group-hover:opacity-100 transition-opacity',
          isSelected && 'opacity-100'
        )}
      >
        {/* 드래그 핸들 */}
        <button
          {...attributes}
          {...listeners}
          className="flex h-8 w-8 cursor-grab items-center justify-center rounded-md bg-card border border-border text-muted-foreground hover:bg-muted hover:text-foreground active:cursor-grabbing"
          title="드래그하여 순서 변경"
        >
          <GripVertical className="h-4 w-4" />
        </button>

        {/* 가시성 토글 */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleVisibility?.();
          }}
          className={cn(
            'flex h-8 w-8 items-center justify-center rounded-md bg-card border border-border hover:bg-muted',
            block.visible ? 'text-muted-foreground hover:text-foreground' : 'text-muted-foreground/50'
          )}
          title={block.visible ? '숨기기' : '보이기'}
        >
          {block.visible ? (
            <Eye className="h-4 w-4" />
          ) : (
            <EyeOff className="h-4 w-4" />
          )}
        </button>

        {/* 삭제 버튼 */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete?.();
          }}
          className="flex h-8 w-8 items-center justify-center rounded-md bg-card border border-border text-muted-foreground hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30"
          title="삭제"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {/* 블록 타입 라벨 (호버 시) */}
      <div
        className={cn(
          'absolute -top-6 left-0 text-xs font-medium text-muted-foreground',
          'opacity-0 group-hover:opacity-100 transition-opacity',
          isSelected && 'opacity-100'
        )}
      >
        {meta.name}
      </div>

      {/* 실제 블록 콘텐츠 */}
      <div className={cn(!block.visible && 'opacity-30')}>
        {children}
      </div>
    </div>
  );
}

/**
 * 드래그 오버레이용 래퍼
 */
export function EditableBlockOverlay({ block }: { block: Block }) {
  const meta = BLOCK_METAS[block.type];

  return (
    <div className="rounded-xl border-2 border-primary bg-card p-4 shadow-2xl">
      <div className="flex items-center gap-2">
        <GripVertical className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">{meta.name}</span>
      </div>
    </div>
  );
}
