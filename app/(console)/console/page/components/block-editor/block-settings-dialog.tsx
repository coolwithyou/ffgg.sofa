'use client';

/**
 * 블록 설정 다이얼로그
 *
 * 블록을 더블클릭하거나 설정 버튼을 클릭하면 열리는 다이얼로그입니다.
 * 기존 BlockSettingsPanel의 설정 컴포넌트를 재사용합니다.
 *
 * @example
 * ```tsx
 * <BlockSettingsDialog
 *   blockId={settingsDialogBlockId}
 *   isOpen={!!settingsDialogBlockId}
 *   onClose={closeBlockSettings}
 * />
 * ```
 */

import { useEffect, useMemo, Suspense } from 'react';
import { FloatingPanel } from '@/components/ui/floating-panel';
import { useBlocks } from '../../../hooks/use-blocks';
import { BLOCK_METAS, type Block } from '@/lib/public-page/block-types';
import { BLOCK_SETTINGS_COMPONENTS } from './settings';
import { Settings2 } from 'lucide-react';

interface BlockSettingsDialogProps {
  /** 설정할 블록의 ID (stale closure 방지를 위해 ID만 받음) */
  blockId: string | null;
  /** 다이얼로그 열림 상태 */
  isOpen: boolean;
  /** 다이얼로그 닫기 핸들러 */
  onClose: () => void;
}

/**
 * 설정 로딩 폴백 컴포넌트
 */
function SettingsLoadingFallback() {
  return (
    <div className="flex items-center justify-center py-8">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );
}

/**
 * 설정 컴포넌트가 없을 때의 폴백
 */
function NoSettingsAvailable({ blockType }: { blockType: string }) {
  const meta = BLOCK_METAS[blockType as keyof typeof BLOCK_METAS];

  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <Settings2 className="h-10 w-10 text-muted-foreground/50 mb-3" />
      <p className="text-sm font-medium text-foreground">
        {meta?.name ?? '알 수 없는 블록'} 설정
      </p>
      <p className="text-xs text-muted-foreground mt-1">
        이 블록에는 추가 설정이 없습니다.
      </p>
    </div>
  );
}

/**
 * 블록 설정 다이얼로그 컴포넌트
 *
 * 핵심 설계:
 * - blockId만 받고, 내부에서 useBlocks()로 최신 블록 조회
 * - onUpdate는 내부에서 useBlocks().updateBlock 직접 호출
 * - 블록 삭제 감지: useEffect로 블록 존재 여부 체크, 없으면 자동 닫기
 */
export function BlockSettingsDialog({
  blockId,
  isOpen,
  onClose,
}: BlockSettingsDialogProps) {
  const { blocks, updateBlock } = useBlocks();

  // 최신 블록 조회
  const block = useMemo(() => {
    if (!blockId) return null;
    return blocks.find((b) => b.id === blockId) ?? null;
  }, [blocks, blockId]);

  // 블록 메타 정보
  const meta = block ? BLOCK_METAS[block.type] : null;

  // 설정 컴포넌트
  const SettingsComponent = block ? BLOCK_SETTINGS_COMPONENTS[block.type] : null;

  // 블록이 삭제되면 자동으로 닫기
  useEffect(() => {
    if (blockId && !block && isOpen) {
      onClose();
    }
  }, [blockId, block, isOpen, onClose]);

  // 블록 업데이트 핸들러
  const handleUpdate = (updates: Partial<Block>) => {
    if (!block) return;

    // Functional update를 사용하여 stale closure 문제 방지
    // 비동기 작업(이미지 업로드 등) 후에도 최신 블록 상태를 기반으로 업데이트
    updateBlock(block.id, (currentBlock) => {
      // config가 있는 블록(HeaderBlock 등)의 경우 config를 병합
      if ('config' in updates && 'config' in currentBlock) {
        return {
          ...updates,
          config: {
            ...(currentBlock as { config: Record<string, unknown> }).config,
            ...(updates as { config: Record<string, unknown> }).config,
          },
        } as Partial<Block>;
      }
      return updates;
    });
  };

  // 블록이 없으면 렌더링하지 않음
  if (!block) {
    return null;
  }

  // 헤더 블록은 설정 항목이 많아 더 넓은 너비 사용
  const isHeaderBlock = block.type === 'header';
  const panelWidth = isHeaderBlock ? 480 : 400;

  return (
    <FloatingPanel
      isOpen={isOpen}
      onClose={onClose}
      title={`${meta?.name ?? '블록'} 설정`}
      width={panelWidth}
      maxHeight="70vh"
      storageKey="block-settings-panel"
    >
      {SettingsComponent ? (
        <Suspense fallback={<SettingsLoadingFallback />}>
          <SettingsComponent block={block} onUpdate={handleUpdate} />
        </Suspense>
      ) : (
        <NoSettingsAvailable blockType={block.type} />
      )}
    </FloatingPanel>
  );
}
