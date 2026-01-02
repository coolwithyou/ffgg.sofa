'use client';

/**
 * 블록 에디터 메인 컴포넌트
 *
 * DnD Context, 팔레트, 캔버스를 통합하여
 * 블록 기반 페이지 편집 기능을 제공합니다.
 */

import { useCallback } from 'react';
import { type DragEndEvent } from '@dnd-kit/core';
import { BlockEditorProvider, type ActiveDragItem } from './dnd-context';
import { BlockPalette } from './block-palette';
import { BlockCanvas } from './block-canvas';
import { PaletteItemOverlay } from './palette-item';
import { SortableBlockOverlay } from './sortable-block';
import { useBlocks } from '../../../hooks/use-blocks';
import {
  BLOCK_METAS,
  canAddBlock,
  BlockType,
  type BlockTypeValue,
} from '@/lib/public-page/block-types';

/**
 * 블록 에디터 Props
 */
interface BlockEditorProps {
  /** 팔레트만 표시할지 여부 (사이드바용) */
  paletteOnly?: boolean;
}

/**
 * 블록 에디터
 */
export function BlockEditor({ paletteOnly = false }: BlockEditorProps) {
  const {
    blocks,
    selectedBlockId,
    addBlock,
    removeBlock,
    toggleBlockVisibility,
    reorderBlocks,
    selectBlock,
  } = useBlocks();

  /**
   * 드래그 종료 핸들러
   */
  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over) return;

      const activeData = active.data.current;

      // 팔레트에서 캔버스로 드래그
      if (activeData?.source === 'palette') {
        const blockType = activeData.blockType as BlockTypeValue;

        // 캔버스 영역에 드롭되었는지 확인
        const isDroppedOnCanvas =
          over.id === 'canvas-droppable' ||
          over.data.current?.sortable !== undefined;

        if (isDroppedOnCanvas && canAddBlock(blocks, blockType)) {
          addBlock(blockType);
        }
        return;
      }

      // 캔버스 내에서 순서 변경
      if (activeData?.source === 'canvas') {
        const activeId = active.id as string;
        const overId = over.id as string;

        if (activeId !== overId && overId !== 'canvas-droppable') {
          reorderBlocks(activeId, overId);
        }
      }
    },
    [blocks, addBlock, reorderBlocks]
  );

  /**
   * 드래그 오버레이 렌더링
   */
  const renderDragOverlay = useCallback((activeItem: ActiveDragItem) => {
    if (activeItem.source === 'palette' && activeItem.blockType) {
      const meta = BLOCK_METAS[activeItem.blockType];
      return <PaletteItemOverlay meta={meta} />;
    }

    if (activeItem.source === 'canvas' && activeItem.block) {
      return <SortableBlockOverlay block={activeItem.block} />;
    }

    return null;
  }, []);

  /**
   * 첫 블록 추가 (플레이스홀더)
   */
  const handleAddFirstBlock = useCallback(() => {
    addBlock(BlockType.PLACEHOLDER);
  }, [addBlock]);

  // 팔레트만 표시 (사이드바용)
  if (paletteOnly) {
    return (
      <BlockEditorProvider
        onDragEnd={handleDragEnd}
        renderDragOverlay={renderDragOverlay}
      >
        <BlockPalette blocks={blocks} onAddBlock={addBlock} />
      </BlockEditorProvider>
    );
  }

  // 전체 에디터 (캔버스 + 팔레트)
  return (
    <BlockEditorProvider
      onDragEnd={handleDragEnd}
      renderDragOverlay={renderDragOverlay}
    >
      <div className="flex h-full">
        {/* 캔버스 영역 */}
        <div className="flex-1 p-4 overflow-auto">
          <BlockCanvas
            blocks={blocks}
            selectedBlockId={selectedBlockId}
            onSelectBlock={selectBlock}
            onToggleVisibility={toggleBlockVisibility}
            onDeleteBlock={removeBlock}
            onAddFirstBlock={handleAddFirstBlock}
          />
        </div>

        {/* 팔레트 사이드바 */}
        <div className="w-80 shrink-0 border-l border-border p-4 overflow-auto">
          <h2 className="text-sm font-semibold text-foreground mb-4">
            블록 추가
          </h2>
          <BlockPalette blocks={blocks} onAddBlock={addBlock} />
        </div>
      </div>
    </BlockEditorProvider>
  );
}

// re-export for convenience
export { BlockEditorProvider } from './dnd-context';
export { BlockPalette } from './block-palette';
export { BlockCanvas } from './block-canvas';
