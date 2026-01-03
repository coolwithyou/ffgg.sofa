'use client';

/**
 * 정렬 가능한 블록 컴포넌트
 *
 * 캔버스 내에서 드래그로 순서를 변경할 수 있는 블록입니다.
 * - 드래그 핸들
 * - 가시성 토글
 * - 삭제 버튼
 */

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '@/lib/utils';
import {
  GripVertical,
  Eye,
  EyeOff,
  Trash2,
  LayoutTemplate,
  MessageSquare,
  Square,
  Link,
  Type,
  Minus,
  Share2,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  BLOCK_METAS,
  BlockType,
  type Block,
  type LinkBlock,
  type TextBlock,
  type DividerBlock,
  type SocialIconsBlock,
} from '@/lib/public-page/block-types';

/**
 * 아이콘 매핑
 * BLOCK_METAS의 icon 문자열과 일치해야 합니다.
 */
const ICON_MAP: Record<string, LucideIcon> = {
  LayoutTemplate,
  MessageSquare,
  Square,
  // Phase 1 블록 아이콘
  Link,
  Type,
  Minus,
  Share2,
};

interface SortableBlockProps {
  block: Block;
  isSelected?: boolean;
  onSelect?: () => void;
  onToggleVisibility?: () => void;
  onDelete?: () => void;
}

export function SortableBlock({
  block,
  isSelected = false,
  onSelect,
  onToggleVisibility,
  onDelete,
}: SortableBlockProps) {
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

  const meta = BLOCK_METAS[block.type];
  const Icon = ICON_MAP[meta?.icon] ?? Square;

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  // 블록 내용 렌더링
  const renderBlockContent = () => {
    switch (block.type) {
      case BlockType.HEADER:
        return (
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">
              {block.config.title || '제목 없음'}
            </p>
            <p className="text-xs text-muted-foreground line-clamp-1">
              {block.config.description || '설명 없음'}
            </p>
          </div>
        );

      case BlockType.CHATBOT:
        return (
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">AI 챗봇 위젯</p>
            <p className="text-xs text-muted-foreground">
              높이: {block.config.minHeight}px ~ {block.config.maxHeight}px
            </p>
          </div>
        );

      case BlockType.PLACEHOLDER:
        return (
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">
              {block.config.label}
            </p>
            <p className="text-xs text-muted-foreground">테스트용 블록</p>
          </div>
        );

      // Phase 1 블록
      case BlockType.LINK: {
        const linkBlock = block as LinkBlock;
        return (
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">
              {linkBlock.config.title || '새 링크'}
            </p>
            <p className="text-xs text-muted-foreground line-clamp-1">
              {linkBlock.config.url || 'URL을 입력하세요'}
            </p>
          </div>
        );
      }

      case BlockType.TEXT: {
        const textBlock = block as TextBlock;
        return (
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">텍스트</p>
            <p className="text-xs text-muted-foreground line-clamp-1">
              {textBlock.config.content || '텍스트를 입력하세요'}
            </p>
          </div>
        );
      }

      case BlockType.DIVIDER: {
        const dividerBlock = block as DividerBlock;
        const styleLabel = {
          line: '실선',
          dashed: '점선',
          dotted: '도트',
          space: '여백',
        }[dividerBlock.config.style];
        return (
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">구분선</p>
            <p className="text-xs text-muted-foreground">
              스타일: {styleLabel}
            </p>
          </div>
        );
      }

      case BlockType.SOCIAL_ICONS: {
        const socialBlock = block as SocialIconsBlock;
        const iconCount = socialBlock.config.icons.length;
        return (
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">소셜 아이콘</p>
            <p className="text-xs text-muted-foreground">
              {iconCount > 0 ? `${iconCount}개의 아이콘` : '아이콘을 추가하세요'}
            </p>
          </div>
        );
      }

      default:
        return (
          <p className="text-sm text-muted-foreground">알 수 없는 블록 타입</p>
        );
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'group relative flex items-center gap-3 rounded-lg border bg-card p-3 transition-all',
        isDragging && 'z-50 shadow-lg opacity-90',
        isSelected && 'border-primary ring-1 ring-primary',
        !isSelected && 'border-border hover:border-muted-foreground/50',
        !block.visible && 'opacity-50'
      )}
      onClick={onSelect}
    >
      {/* 드래그 핸들 */}
      <button
        type="button"
        {...attributes}
        {...listeners}
        className={cn(
          'flex h-8 w-8 shrink-0 cursor-grab items-center justify-center rounded-md transition-colors',
          'text-muted-foreground hover:bg-muted hover:text-foreground',
          'active:cursor-grabbing focus:outline-none focus-visible:ring-2 focus-visible:ring-primary'
        )}
      >
        <GripVertical className="h-4 w-4" />
        <span className="sr-only">드래그하여 순서 변경</span>
      </button>

      {/* 블록 아이콘 */}
      <div
        className={cn(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-md',
          block.visible ? 'bg-primary/10' : 'bg-muted'
        )}
      >
        <Icon
          className={cn(
            'h-5 w-5',
            block.visible ? 'text-primary' : 'text-muted-foreground'
          )}
        />
      </div>

      {/* 블록 내용 */}
      <div className="flex-1 min-w-0">{renderBlockContent()}</div>

      {/* 액션 버튼 */}
      <div className="flex shrink-0 items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {/* 가시성 토글 */}
        {onToggleVisibility && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={(e) => {
              e.stopPropagation();
              onToggleVisibility();
            }}
          >
            {block.visible ? (
              <Eye className="h-4 w-4" />
            ) : (
              <EyeOff className="h-4 w-4" />
            )}
            <span className="sr-only">
              {block.visible ? '블록 숨기기' : '블록 보이기'}
            </span>
          </Button>
        )}

        {/* 삭제 버튼 */}
        {onDelete && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
          >
            <Trash2 className="h-4 w-4" />
            <span className="sr-only">블록 삭제</span>
          </Button>
        )}
      </div>
    </div>
  );
}

/**
 * 드래그 오버레이용 블록
 */
export function SortableBlockOverlay({ block }: { block: Block }) {
  const meta = BLOCK_METAS[block.type];
  const Icon = ICON_MAP[meta?.icon] ?? Square;

  return (
    <div className="flex items-center gap-3 rounded-lg border border-primary bg-card p-3 shadow-lg">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground">
        <GripVertical className="h-4 w-4" />
      </div>
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10">
        <Icon className="h-5 w-5 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">{meta?.name}</p>
      </div>
    </div>
  );
}
