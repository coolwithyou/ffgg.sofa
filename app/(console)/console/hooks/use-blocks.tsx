'use client';

/**
 * 블록 조작 훅
 *
 * 블록 추가, 삭제, 수정, 재정렬 기능을 제공합니다.
 * pageConfig.blocks를 통해 자동 저장됩니다.
 *
 * selectedBlockId와 selectBlock은 ConsoleContext에서 관리되어
 * 여러 컴포넌트 간 상태 공유가 가능합니다.
 */

import { useCallback } from 'react';
import { nanoid } from 'nanoid';
import { useConsole } from './use-console-state';
import {
  createBlock,
  normalizeBlockOrder,
  type Block,
  type BlockTypeValue,
} from '@/lib/public-page/block-types';

/**
 * 블록 업데이트 함수 타입
 * - Partial<Block> 직접 전달: 단순 병합
 * - 함수 전달: 현재 블록 상태를 기반으로 업데이트 (stale closure 방지)
 */
type BlockUpdater = Partial<Block> | ((currentBlock: Block) => Partial<Block>);

/**
 * 블록 조작 훅 반환 타입
 */
interface UseBlocksReturn {
  /** 블록 목록 */
  blocks: Block[];
  /** 선택된 블록 ID */
  selectedBlockId: string | null;
  /** 블록 추가 (insertBeforeId가 있으면 해당 블록 앞에 삽입, 없으면 끝에 추가) */
  addBlock: (type: BlockTypeValue, insertBeforeId?: string) => void;
  /** 블록 삭제 */
  removeBlock: (id: string) => void;
  /** 블록 업데이트 (함수형 업데이트 지원) */
  updateBlock: (id: string, updates: BlockUpdater) => void;
  /** 블록 가시성 토글 */
  toggleBlockVisibility: (id: string) => void;
  /** 블록 순서 변경 */
  reorderBlocks: (activeId: string, overId: string) => void;
  /** 블록 위로 이동 */
  moveBlockUp: (id: string) => void;
  /** 블록 아래로 이동 */
  moveBlockDown: (id: string) => void;
  /** 블록 선택 */
  selectBlock: (id: string | null) => void;
}

/**
 * 블록 조작 훅
 */
export function useBlocks(): UseBlocksReturn {
  const { pageConfig, updatePageConfig, selectedBlockId, selectBlock } = useConsole();

  // 현재 블록 목록
  const blocks = pageConfig.blocks ?? [];

  /**
   * 블록 목록 업데이트 (자동 정규화)
   */
  const setBlocks = useCallback(
    (newBlocks: Block[]) => {
      const normalized = normalizeBlockOrder(newBlocks);
      updatePageConfig({ blocks: normalized });
    },
    [updatePageConfig]
  );

  /**
   * 블록 추가
   * @param type 블록 타입
   * @param insertBeforeId 이 블록 앞에 삽입 (없으면 끝에 추가)
   */
  const addBlock = useCallback(
    (type: BlockTypeValue, insertBeforeId?: string) => {
      const id = nanoid();

      if (insertBeforeId) {
        // 특정 블록 앞에 삽입
        const insertIndex = blocks.findIndex((b) => b.id === insertBeforeId);
        if (insertIndex !== -1) {
          const newBlock = createBlock(type, id, insertIndex);
          const newBlocks = [...blocks];
          newBlocks.splice(insertIndex, 0, newBlock);
          setBlocks(newBlocks);
          selectBlock(id);
          return;
        }
      }

      // 끝에 추가
      const order = blocks.length;
      const newBlock = createBlock(type, id, order);
      setBlocks([...blocks, newBlock]);
      selectBlock(id);
    },
    [blocks, setBlocks, selectBlock]
  );

  /**
   * 블록 삭제
   */
  const removeBlock = useCallback(
    (id: string) => {
      const filtered = blocks.filter((block) => block.id !== id);
      setBlocks(filtered);

      // 선택된 블록이 삭제되면 선택 해제
      if (selectedBlockId === id) {
        selectBlock(null);
      }
    },
    [blocks, selectedBlockId, setBlocks, selectBlock]
  );

  /**
   * 블록 업데이트
   *
   * 함수형 업데이트를 지원하여 stale closure 문제를 방지합니다.
   * - Partial<Block> 전달: 단순 병합
   * - (currentBlock) => Partial<Block> 함수 전달: 현재 상태 기반 업데이트
   */
  const updateBlock = useCallback(
    (id: string, updates: BlockUpdater) => {
      const updated = blocks.map((block): Block => {
        if (block.id === id) {
          // 함수형 업데이트인 경우 현재 블록을 전달하여 최신 상태 사용
          const resolvedUpdates = typeof updates === 'function' ? updates(block) : updates;
          // 타입 보존을 위해 명시적 타입 단언
          return { ...block, ...resolvedUpdates } as Block;
        }
        return block;
      });
      setBlocks(updated);
    },
    [blocks, setBlocks]
  );

  /**
   * 블록 가시성 토글
   */
  const toggleBlockVisibility = useCallback(
    (id: string) => {
      const updated = blocks.map((block): Block => {
        if (block.id === id) {
          return { ...block, visible: !block.visible } as Block;
        }
        return block;
      });
      setBlocks(updated);
    },
    [blocks, setBlocks]
  );

  /**
   * 블록 순서 변경
   */
  const reorderBlocks = useCallback(
    (activeId: string, overId: string) => {
      if (activeId === overId) return;

      const activeIndex = blocks.findIndex((b) => b.id === activeId);
      const overIndex = blocks.findIndex((b) => b.id === overId);

      if (activeIndex === -1 || overIndex === -1) return;

      // 배열 재정렬
      const newBlocks = [...blocks];
      const [removed] = newBlocks.splice(activeIndex, 1);
      newBlocks.splice(overIndex, 0, removed);

      setBlocks(newBlocks);
    },
    [blocks, setBlocks]
  );

  /**
   * 블록 위로 이동
   */
  const moveBlockUp = useCallback(
    (id: string) => {
      const index = blocks.findIndex((b) => b.id === id);
      if (index <= 0) return; // 이미 맨 위이거나 찾을 수 없음

      const newBlocks = [...blocks];
      const [removed] = newBlocks.splice(index, 1);
      newBlocks.splice(index - 1, 0, removed);

      setBlocks(newBlocks);
    },
    [blocks, setBlocks]
  );

  /**
   * 블록 아래로 이동
   */
  const moveBlockDown = useCallback(
    (id: string) => {
      const index = blocks.findIndex((b) => b.id === id);
      if (index === -1 || index >= blocks.length - 1) return; // 이미 맨 아래이거나 찾을 수 없음

      const newBlocks = [...blocks];
      const [removed] = newBlocks.splice(index, 1);
      newBlocks.splice(index + 1, 0, removed);

      setBlocks(newBlocks);
    },
    [blocks, setBlocks]
  );

  return {
    blocks,
    selectedBlockId,
    addBlock,
    removeBlock,
    updateBlock,
    toggleBlockVisibility,
    reorderBlocks,
    moveBlockUp,
    moveBlockDown,
    selectBlock,
  };
}
