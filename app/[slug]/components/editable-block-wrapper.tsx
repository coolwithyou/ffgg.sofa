'use client';

/**
 * 편집 가능한 블록 래퍼
 *
 * 블록을 감싸서 편집 기능을 제공합니다:
 * - 상단 툴바 (호버/선택 시 표시)
 * - 드래그 핸들 (순서 변경)
 * - 위/아래 이동 버튼
 * - 가시성 토글
 * - 삭제 버튼
 * - 선택 상태 하이라이트
 */

import { type ReactNode, useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Eye, EyeOff, Trash2, ChevronUp, ChevronDown, Settings2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BLOCK_METAS, type Block } from '@/lib/public-page/block-types';

/**
 * 높이가 낮아 선택하기 어려운 블록 타입들
 * 호버/선택 시 히트 영역을 확장하여 UX 개선
 */
const LOW_HEIGHT_BLOCK_TYPES = ['divider'] as const;

/**
 * 툴바 위치 옵션
 * - top: 블록 상단 바깥 (기본값)
 * - bottom-inside: 블록 내부 하단 (프로필 헤더처럼 최상단 블록용)
 */
type ToolbarPosition = 'top' | 'bottom-inside';

interface EditableBlockWrapperProps {
  block: Block;
  children: ReactNode;
  isSelected?: boolean;
  /** 첫 번째 블록 여부 */
  isFirst?: boolean;
  /** 마지막 블록 여부 */
  isLast?: boolean;
  onSelect?: () => void;
  onToggleVisibility?: () => void;
  onDelete?: () => void;
  /** 위로 이동 콜백 */
  onMoveUp?: () => void;
  /** 아래로 이동 콜백 */
  onMoveDown?: () => void;
  /** 설정 다이얼로그 열기 콜백 */
  onOpenSettings?: () => void;
  /** 툴바 위치 (기본값: 'top') */
  toolbarPosition?: ToolbarPosition;
}

export function EditableBlockWrapper({
  block,
  children,
  isSelected,
  isFirst,
  isLast,
  onSelect,
  onToggleVisibility,
  onDelete,
  onMoveUp,
  onMoveDown,
  onOpenSettings,
  toolbarPosition = 'top',
}: EditableBlockWrapperProps) {
  const [isHovered, setIsHovered] = useState(false);

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

  // 낮은 높이 블록인지 확인 (구분선 등)
  const isLowHeightBlock = LOW_HEIGHT_BLOCK_TYPES.includes(
    block.type as (typeof LOW_HEIGHT_BLOCK_TYPES)[number]
  );
  // 낮은 높이 블록은 항상 히트 영역 확장 (호버/선택 시 더 강조)
  const isLowHeightBlockActive = isLowHeightBlock && (isHovered || isSelected);

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
      onDoubleClick={(e) => {
        e.stopPropagation();
        onOpenSettings?.();
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* 편집 툴바 */}
      <div
        className={cn(
          'absolute z-10',
          'flex items-center justify-between gap-2',
          'opacity-0 group-hover:opacity-100 transition-opacity duration-150',
          'pointer-events-none', // 빈 공간은 클릭 통과
          isSelected && 'opacity-100',
          // 툴바 위치: top (기본) vs bottom-inside
          toolbarPosition === 'top' && '-top-10 left-0 right-0',
          toolbarPosition === 'bottom-inside' && 'bottom-4 left-4 right-4'
        )}
      >
        {/* 좌측: 순서 컨트롤 (이동 기능이 있는 경우에만 표시) */}
        <div className="pointer-events-auto flex items-center gap-0.5 rounded-lg bg-card border border-border shadow-sm p-0.5">
          {/* 위로 이동 버튼 (onMoveUp이 있을 때만 표시) */}
          {onMoveUp && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onMoveUp();
              }}
              disabled={isFirst}
              className={cn(
                'flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors',
                isFirst && 'opacity-30 cursor-not-allowed hover:bg-transparent hover:text-muted-foreground'
              )}
              title="위로 이동"
            >
              <ChevronUp className="h-4 w-4" />
            </button>
          )}

          {/* 드래그 핸들 (이동 기능이 있을 때만 표시) */}
          {(onMoveUp || onMoveDown) && (
            <button
              {...attributes}
              {...listeners}
              className="flex h-7 w-7 cursor-grab items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground active:cursor-grabbing transition-colors"
              title="드래그하여 순서 변경"
            >
              <GripVertical className="h-4 w-4" />
            </button>
          )}

          {/* 아래로 이동 버튼 (onMoveDown이 있을 때만 표시) */}
          {onMoveDown && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onMoveDown();
              }}
              disabled={isLast}
              className={cn(
                'flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors',
                isLast && 'opacity-30 cursor-not-allowed hover:bg-transparent hover:text-muted-foreground'
              )}
              title="아래로 이동"
            >
              <ChevronDown className="h-4 w-4" />
            </button>
          )}

          {/* 구분선 (이동 버튼이 있을 때만 표시) */}
          {(onMoveUp || onMoveDown) && (
            <div className="h-5 w-px bg-border mx-1" />
          )}

          {/* 블록 타입 라벨 */}
          <span className="px-2 text-xs font-medium text-muted-foreground">
            {meta.name}
          </span>
        </div>

        {/* 우측: 액션 버튼 */}
        <div className="pointer-events-auto flex items-center gap-0.5 rounded-lg bg-card border border-border shadow-sm p-0.5">
          {/* 설정 버튼 */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onOpenSettings?.();
            }}
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            title="설정"
          >
            <Settings2 className="h-4 w-4" />
          </button>

          {/* 가시성 토글 */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleVisibility?.();
            }}
            className={cn(
              'flex h-7 w-7 items-center justify-center rounded-md hover:bg-muted transition-colors',
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

          {/* 삭제 버튼 (onDelete가 있을 때만 표시) */}
          {onDelete && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
              title="삭제"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* 실제 블록 콘텐츠 */}
      <div
        className={cn(
          !block.visible && 'opacity-30',
          // 낮은 높이 블록(구분선 등)은 항상 히트 영역 확장 (py-4로 클릭 영역 확보, -my-2로 위아래 간격 유지)
          isLowHeightBlock && 'py-4 -my-2 rounded-lg border-2 border-dashed',
          // 기본 상태: 미묘한 테두리
          isLowHeightBlock && !isLowHeightBlockActive && 'border-border/50',
          // 호버/선택 상태: 강조된 테두리와 배경
          isLowHeightBlockActive && 'border-primary/40 bg-primary/5'
        )}
      >
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
