'use client';

import { useState, useCallback } from 'react';
import { useCurrentChatbot, usePageConfig } from '../hooks/use-console-state';
import { useBlocks } from '../hooks/use-blocks';
import { PublicPageView } from '@/app/[slug]/public-page-view';
import { BlockSettingsDialog } from '../page/components/block-editor/block-settings-dialog';

/**
 * 프리뷰 콘텐츠
 *
 * WYSIWYG 편집 모드로 PublicPageView를 렌더링합니다.
 * - 실시간 변경사항이 반영됨
 * - 편집 컨트롤(드래그, 삭제, 가시성 토글) 활성화
 * - 블록 선택 및 순서 변경 지원
 * - 블록 설정 다이얼로그 (더블클릭 또는 설정 버튼으로 열기)
 */
export function PreviewContent() {
  const { currentChatbot } = useCurrentChatbot();
  const { pageConfig } = usePageConfig();
  const {
    selectedBlockId,
    selectBlock,
    toggleBlockVisibility,
    removeBlock,
    reorderBlocks,
    moveBlockUp,
    moveBlockDown,
  } = useBlocks();

  // 블록 설정 다이얼로그 상태
  const [settingsDialogBlockId, setSettingsDialogBlockId] = useState<string | null>(null);

  // 블록 설정 다이얼로그 열기
  const openBlockSettings = useCallback((id: string) => {
    setSettingsDialogBlockId(id);
  }, []);

  // 블록 설정 다이얼로그 닫기
  const closeBlockSettings = useCallback(() => {
    setSettingsDialogBlockId(null);
  }, []);

  // 블록 선택 핸들러 (다이얼로그 열린 상태에서 다른 블록 선택 시 자동 전환)
  const handleSelectBlock = useCallback(
    (id: string | null) => {
      selectBlock(id);
      // 다이얼로그가 열려있고 다른 블록 선택 시 해당 블록으로 전환
      if (settingsDialogBlockId && id && id !== settingsDialogBlockId) {
        setSettingsDialogBlockId(id);
      }
    },
    [selectBlock, settingsDialogBlockId]
  );

  if (!currentChatbot) {
    return (
      <div className="flex h-full items-center justify-center bg-muted">
        <p className="text-sm text-muted-foreground">챗봇을 선택해주세요</p>
      </div>
    );
  }

  // PublicPageView에 필요한 props 구성
  // isEditing=true로 편집 모드 활성화
  return (
    <>
      <PublicPageView
        chatbotId={currentChatbot.id}
        chatbotName={currentChatbot.name}
        tenantId={currentChatbot.tenantId}
        config={pageConfig}
        widgetConfig={null}
        // 편집 모드 props
        isEditing={true}
        selectedBlockId={selectedBlockId}
        onSelectBlock={handleSelectBlock}
        onToggleVisibility={toggleBlockVisibility}
        onDeleteBlock={removeBlock}
        onReorderBlocks={reorderBlocks}
        onMoveBlockUp={moveBlockUp}
        onMoveBlockDown={moveBlockDown}
        onOpenBlockSettings={openBlockSettings}
      />

      {/* 블록 설정 다이얼로그 */}
      <BlockSettingsDialog
        blockId={settingsDialogBlockId}
        isOpen={!!settingsDialogBlockId}
        onClose={closeBlockSettings}
      />
    </>
  );
}
