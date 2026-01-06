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

import { useCallback, useEffect, useRef } from 'react';
import { nanoid } from 'nanoid';
import { useConsole } from './use-console-state';
import {
  createBlock,
  createHeaderBlock,
  createChatbotBlock,
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

  // 기본 블록 생성 중 여부 추적 (무한 루프 방지)
  const isCreatingDefaultBlocksRef = useRef(false);

  // 현재 블록 목록
  const blocks = pageConfig.blocks ?? [];

  /**
   * 기본 블록 초기화
   *
   * pageConfig.blocks가 비어있으면 헤더와 챗봇 블록을 자동 생성합니다.
   * - 첫 페이지 로드 시 서버에서 blocks가 빈 배열로 올 수 있음
   * - 설정 초기화(reset) 시에도 blocks가 빈 배열로 변경됨
   * - isCreatingDefaultBlocksRef로 생성 중 상태를 추적하여 무한 루프 방지
   *
   * 동작 흐름:
   * 1. blocks가 비어있고, 현재 생성 중이 아니면 기본 블록 생성 시작
   * 2. isCreatingDefaultBlocksRef = true로 설정
   * 3. updatePageConfig로 기본 블록 추가
   * 4. useEffect 재실행 시 blocks.length > 0이므로 isCreatingDefaultBlocksRef = false로 리셋
   */
  useEffect(() => {
    const currentBlocks = pageConfig.blocks ?? [];

    if (currentBlocks.length === 0) {
      // 이미 생성 중이면 스킵 (무한 루프 방지)
      if (isCreatingDefaultBlocksRef.current) return;

      isCreatingDefaultBlocksRef.current = true;

      const defaultBlocks: Block[] = [
        createHeaderBlock(nanoid(), 0),
        createChatbotBlock(nanoid(), 1),
      ];

      updatePageConfig((prev) => ({
        ...prev,
        blocks: normalizeBlockOrder(defaultBlocks),
      }));
    } else {
      // blocks가 있으면 생성 플래그 리셋 (다음 reset 대비)
      isCreatingDefaultBlocksRef.current = false;
    }
  }, [pageConfig.blocks, updatePageConfig]);

  /**
   * 블록 목록 업데이트 (자동 정규화)
   *
   * 함수형 업데이터를 지원하여 stale closure 문제를 방지합니다.
   * 항상 최신 pageConfig.blocks를 기반으로 업데이트합니다.
   */
  const setBlocks = useCallback(
    (updater: Block[] | ((prevBlocks: Block[]) => Block[])) => {
      updatePageConfig((prev) => {
        const prevBlocks = prev.blocks ?? [];
        const newBlocks = typeof updater === 'function' ? updater(prevBlocks) : updater;
        const normalized = normalizeBlockOrder(newBlocks);
        return { ...prev, blocks: normalized };
      });
    },
    [updatePageConfig]
  );

  /**
   * 블록 추가
   * @param type 블록 타입
   * @param insertBeforeId 이 블록 앞에 삽입 (없으면 끝에 추가)
   *
   * 함수형 업데이터를 사용하여 항상 최신 blocks 상태를 기반으로 추가합니다.
   */
  const addBlock = useCallback(
    (type: BlockTypeValue, insertBeforeId?: string) => {
      const id = nanoid();

      setBlocks((prevBlocks) => {
        if (insertBeforeId) {
          // 특정 블록 앞에 삽입
          const insertIndex = prevBlocks.findIndex((b) => b.id === insertBeforeId);
          if (insertIndex !== -1) {
            const newBlock = createBlock(type, id, insertIndex);
            const newBlocks = [...prevBlocks];
            newBlocks.splice(insertIndex, 0, newBlock);
            return newBlocks;
          }
        }

        // 끝에 추가
        const order = prevBlocks.length;
        const newBlock = createBlock(type, id, order);
        return [...prevBlocks, newBlock];
      });

      selectBlock(id);
    },
    [setBlocks, selectBlock]
  );

  /**
   * 블록 삭제
   */
  const removeBlock = useCallback(
    (id: string) => {
      setBlocks((prevBlocks) => prevBlocks.filter((block) => block.id !== id));

      // 선택된 블록이 삭제되면 선택 해제
      if (selectedBlockId === id) {
        selectBlock(null);
      }
    },
    [selectedBlockId, setBlocks, selectBlock]
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
      setBlocks((prevBlocks) =>
        prevBlocks.map((block): Block => {
          if (block.id === id) {
            // 함수형 업데이트인 경우 현재 블록을 전달하여 최신 상태 사용
            const resolvedUpdates =
              typeof updates === 'function' ? updates(block) : updates;
            // 타입 보존을 위해 명시적 타입 단언
            return { ...block, ...resolvedUpdates } as Block;
          }
          return block;
        })
      );
    },
    [setBlocks]
  );

  /**
   * 블록 가시성 토글
   */
  const toggleBlockVisibility = useCallback(
    (id: string) => {
      setBlocks((prevBlocks) =>
        prevBlocks.map((block): Block => {
          if (block.id === id) {
            return { ...block, visible: !block.visible } as Block;
          }
          return block;
        })
      );
    },
    [setBlocks]
  );

  /**
   * 블록 순서 변경
   */
  const reorderBlocks = useCallback(
    (activeId: string, overId: string) => {
      if (activeId === overId) return;

      setBlocks((prevBlocks) => {
        const activeIndex = prevBlocks.findIndex((b) => b.id === activeId);
        const overIndex = prevBlocks.findIndex((b) => b.id === overId);

        if (activeIndex === -1 || overIndex === -1) return prevBlocks;

        // 배열 재정렬
        const newBlocks = [...prevBlocks];
        const [removed] = newBlocks.splice(activeIndex, 1);
        newBlocks.splice(overIndex, 0, removed);

        return newBlocks;
      });
    },
    [setBlocks]
  );

  /**
   * 블록 위로 이동
   */
  const moveBlockUp = useCallback(
    (id: string) => {
      setBlocks((prevBlocks) => {
        const index = prevBlocks.findIndex((b) => b.id === id);
        if (index <= 0) return prevBlocks; // 이미 맨 위이거나 찾을 수 없음

        const newBlocks = [...prevBlocks];
        const [removed] = newBlocks.splice(index, 1);
        newBlocks.splice(index - 1, 0, removed);

        return newBlocks;
      });
    },
    [setBlocks]
  );

  /**
   * 블록 아래로 이동
   */
  const moveBlockDown = useCallback(
    (id: string) => {
      setBlocks((prevBlocks) => {
        const index = prevBlocks.findIndex((b) => b.id === id);
        if (index === -1 || index >= prevBlocks.length - 1) return prevBlocks; // 이미 맨 아래이거나 찾을 수 없음

        const newBlocks = [...prevBlocks];
        const [removed] = newBlocks.splice(index, 1);
        newBlocks.splice(index + 1, 0, removed);

        return newBlocks;
      });
    },
    [setBlocks]
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
