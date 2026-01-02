'use client';

/**
 * 블록 에디터 DnD Context
 *
 * @dnd-kit을 사용한 드래그앤드롭 컨텍스트를 제공합니다.
 * - PointerSensor: 마우스/터치 드래그
 * - KeyboardSensor: 키보드 드래그 (접근성)
 * - DragOverlay: 드래그 중 미리보기
 */

import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from '@dnd-kit/core';
import {
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import type { Block, BlockTypeValue } from '@/lib/public-page/block-types';

/**
 * 드래그 소스 타입
 */
export type DragSource = 'palette' | 'canvas';

/**
 * 드래그 중인 아이템 정보
 */
export interface ActiveDragItem {
  /** 드래그 소스 */
  source: DragSource;
  /** 블록 타입 (팔레트에서 드래그 시) */
  blockType?: BlockTypeValue;
  /** 블록 데이터 (캔버스에서 드래그 시) */
  block?: Block;
}

/**
 * 블록 에디터 컨텍스트 값
 */
interface BlockEditorContextValue {
  /** 현재 드래그 중인 아이템 */
  activeItem: ActiveDragItem | null;
  /** 드롭 영역 위에 있는지 여부 */
  isOverCanvas: boolean;
}

const BlockEditorContext = createContext<BlockEditorContextValue | null>(null);

/**
 * 블록 에디터 컨텍스트 훅
 */
export function useBlockEditorContext(): BlockEditorContextValue {
  const context = useContext(BlockEditorContext);
  if (!context) {
    throw new Error(
      'useBlockEditorContext must be used within BlockEditorProvider'
    );
  }
  return context;
}

/**
 * 블록 에디터 Provider Props
 */
interface BlockEditorProviderProps {
  children: ReactNode;
  /** 드래그 종료 핸들러 */
  onDragEnd: (event: DragEndEvent) => void;
  /** DragOverlay에 렌더링할 컴포넌트 */
  renderDragOverlay?: (activeItem: ActiveDragItem) => ReactNode;
}

/**
 * 블록 에디터 DnD Provider
 */
export function BlockEditorProvider({
  children,
  onDragEnd,
  renderDragOverlay,
}: BlockEditorProviderProps) {
  const [activeItem, setActiveItem] = useState<ActiveDragItem | null>(null);
  const [isOverCanvas, setIsOverCanvas] = useState(false);

  // 센서 설정
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5, // 5px 이동 후 드래그 시작
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // 드래그 시작
  const handleDragStart = useCallback((event: DragStartEvent) => {
    const { active } = event;
    const data = active.data.current;

    if (data?.source === 'palette') {
      setActiveItem({
        source: 'palette',
        blockType: data.blockType as BlockTypeValue,
      });
    } else if (data?.source === 'canvas') {
      setActiveItem({
        source: 'canvas',
        block: data.block as Block,
      });
    }
  }, []);

  // 드래그 오버
  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { over } = event;
    setIsOverCanvas(over?.id === 'canvas-droppable' || over?.data.current?.sortable !== undefined);
  }, []);

  // 드래그 종료
  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveItem(null);
      setIsOverCanvas(false);
      onDragEnd(event);
    },
    [onDragEnd]
  );

  // 드래그 취소
  const handleDragCancel = useCallback(() => {
    setActiveItem(null);
    setIsOverCanvas(false);
  }, []);

  return (
    <BlockEditorContext.Provider value={{ activeItem, isOverCanvas }}>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        {children}

        {/* 드래그 오버레이 */}
        <DragOverlay dropAnimation={null}>
          {activeItem && renderDragOverlay ? (
            renderDragOverlay(activeItem)
          ) : null}
        </DragOverlay>
      </DndContext>
    </BlockEditorContext.Provider>
  );
}
