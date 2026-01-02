'use client';

/**
 * 블록 캔버스 컴포넌트
 *
 * 드롭 가능한 캔버스 영역입니다.
 * - SortableContext로 블록 순서 변경 지원
 * - 빈 상태 UI
 * - 드래그 중 하이라이트
 */

import { useDroppable } from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { cn } from '@/lib/utils';
import { EmptyState } from './empty-state';
import { SortableBlock } from './sortable-block';
import { useBlockEditorContext } from './dnd-context';
import type { Block } from '@/lib/public-page/block-types';

interface BlockCanvasProps {
  /** 블록 목록 */
  blocks: Block[];
  /** 선택된 블록 ID */
  selectedBlockId?: string | null;
  /** 블록 선택 핸들러 */
  onSelectBlock?: (id: string) => void;
  /** 블록 가시성 토글 핸들러 */
  onToggleVisibility?: (id: string) => void;
  /** 블록 삭제 핸들러 */
  onDeleteBlock?: (id: string) => void;
  /** 첫 블록 추가 클릭 핸들러 */
  onAddFirstBlock?: () => void;
}

export function BlockCanvas({
  blocks,
  selectedBlockId,
  onSelectBlock,
  onToggleVisibility,
  onDeleteBlock,
  onAddFirstBlock,
}: BlockCanvasProps) {
  const { isOver, setNodeRef } = useDroppable({
    id: 'canvas-droppable',
  });

  const { activeItem } = useBlockEditorContext();

  // 팔레트에서 드래그 중이고 캔버스 위에 있을 때
  const showDropHighlight = activeItem?.source === 'palette' && isOver;

  // 블록 ID 배열 (SortableContext용)
  const blockIds = blocks.map((block) => block.id);

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'min-h-[200px] rounded-xl transition-colors p-4',
        showDropHighlight && 'bg-primary/5 ring-2 ring-primary ring-inset'
      )}
    >
      {blocks.length === 0 ? (
        <EmptyState isOver={showDropHighlight} onAddClick={onAddFirstBlock} />
      ) : (
        <SortableContext items={blockIds} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {blocks.map((block) => (
              <SortableBlock
                key={block.id}
                block={block}
                isSelected={selectedBlockId === block.id}
                onSelect={() => onSelectBlock?.(block.id)}
                onToggleVisibility={() => onToggleVisibility?.(block.id)}
                onDelete={() => onDeleteBlock?.(block.id)}
              />
            ))}
          </div>
        </SortableContext>
      )}
    </div>
  );
}
