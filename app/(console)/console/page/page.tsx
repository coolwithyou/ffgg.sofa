'use client';

import { useCallback } from 'react';
import { type DragEndEvent } from '@dnd-kit/core';
import { CenterPreview } from '../components/center-preview';
import { RightSettings } from '../components/right-settings';
import { useConsole } from '../hooks/use-console-state';
import { useBlocks } from '../hooks/use-blocks';
import {
  BlockEditorProvider,
  type ActiveDragItem,
} from './components/block-editor/dnd-context';
import { PaletteItemOverlay } from './components/block-editor/palette-item';
import { SortableBlockOverlay } from './components/block-editor/sortable-block';
import {
  BLOCK_METAS,
  canAddBlock,
  type BlockTypeValue,
} from '@/lib/public-page/block-types';

/**
 * 페이지 디자인 에디터
 *
 * 퍼블릭 페이지의 블록 기반 디자인 편집기
 * 2-컬럼 레이아웃:
 * - 좌측: 디바이스 프레임 프리뷰 + 블록 캔버스
 * - 우측: 설정 패널 (블록 팔레트 탭 포함)
 *
 * BlockEditorProvider로 전체를 감싸서
 * 팔레트 → 캔버스 간 드래그앤드롭을 지원합니다.
 */
export default function PageDesignPage() {
  const { isLoading } = useConsole();
  const { blocks, addBlock, reorderBlocks } = useBlocks();

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
          // 특정 블록 위에 드롭된 경우 해당 위치에 삽입
          const insertBeforeId =
            over.data.current?.sortable !== undefined
              ? (over.id as string)
              : undefined;
          addBlock(blockType, insertBeforeId);
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

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <BlockEditorProvider
      onDragEnd={handleDragEnd}
      renderDragOverlay={renderDragOverlay}
    >
      <div className="flex h-full overflow-hidden">
        {/* 중앙: 프리뷰 + 블록 캔버스 */}
        <CenterPreview />

        {/* 우측: 설정 패널 (블록 탭 포함) */}
        <RightSettings />
      </div>
    </BlockEditorProvider>
  );
}
