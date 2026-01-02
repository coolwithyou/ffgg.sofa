'use client';

/**
 * 블록 조작 훅
 *
 * 블록 추가, 삭제, 수정, 재정렬 기능을 제공합니다.
 * pageConfig.blocks를 통해 자동 저장됩니다.
 */

import { useCallback, useState } from 'react';
import { nanoid } from 'nanoid';
import { useConsole } from './use-console-state';
import {
  createBlock,
  normalizeBlockOrder,
  type Block,
  type BlockTypeValue,
} from '@/lib/public-page/block-types';

/**
 * 블록 조작 훅 반환 타입
 */
interface UseBlocksReturn {
  /** 블록 목록 */
  blocks: Block[];
  /** 선택된 블록 ID */
  selectedBlockId: string | null;
  /** 블록 추가 */
  addBlock: (type: BlockTypeValue) => void;
  /** 블록 삭제 */
  removeBlock: (id: string) => void;
  /** 블록 업데이트 */
  updateBlock: (id: string, updates: Partial<Block>) => void;
  /** 블록 가시성 토글 */
  toggleBlockVisibility: (id: string) => void;
  /** 블록 순서 변경 */
  reorderBlocks: (activeId: string, overId: string) => void;
  /** 블록 선택 */
  selectBlock: (id: string | null) => void;
}

/**
 * 블록 조작 훅
 */
export function useBlocks(): UseBlocksReturn {
  const { pageConfig, updatePageConfig } = useConsole();
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);

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
   */
  const addBlock = useCallback(
    (type: BlockTypeValue) => {
      const id = nanoid();
      const order = blocks.length;
      const newBlock = createBlock(type, id, order);

      setBlocks([...blocks, newBlock]);
      setSelectedBlockId(id);
    },
    [blocks, setBlocks]
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
        setSelectedBlockId(null);
      }
    },
    [blocks, selectedBlockId, setBlocks]
  );

  /**
   * 블록 업데이트
   */
  const updateBlock = useCallback(
    (id: string, updates: Partial<Block>) => {
      const updated = blocks.map((block) =>
        block.id === id ? { ...block, ...updates } : block
      );
      setBlocks(updated);
    },
    [blocks, setBlocks]
  );

  /**
   * 블록 가시성 토글
   */
  const toggleBlockVisibility = useCallback(
    (id: string) => {
      const updated = blocks.map((block) =>
        block.id === id ? { ...block, visible: !block.visible } : block
      );
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
   * 블록 선택
   */
  const selectBlock = useCallback((id: string | null) => {
    setSelectedBlockId(id);
  }, []);

  return {
    blocks,
    selectedBlockId,
    addBlock,
    removeBlock,
    updateBlock,
    toggleBlockVisibility,
    reorderBlocks,
    selectBlock,
  };
}
