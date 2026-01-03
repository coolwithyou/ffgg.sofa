'use client';

import { useCurrentChatbot, usePageConfig } from '../hooks/use-console-state';
import { useBlocks } from '../hooks/use-blocks';
import { PublicPageView } from '@/app/[slug]/public-page-view';

/**
 * 프리뷰 콘텐츠
 *
 * WYSIWYG 편집 모드로 PublicPageView를 렌더링합니다.
 * - 실시간 변경사항이 반영됨
 * - 편집 컨트롤(드래그, 삭제, 가시성 토글) 활성화
 * - 블록 선택 및 순서 변경 지원
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
    <PublicPageView
      chatbotId={currentChatbot.id}
      chatbotName={currentChatbot.name}
      tenantId={currentChatbot.tenantId}
      config={pageConfig}
      widgetConfig={null}
      // 편집 모드 props
      isEditing={true}
      selectedBlockId={selectedBlockId}
      onSelectBlock={selectBlock}
      onToggleVisibility={toggleBlockVisibility}
      onDeleteBlock={removeBlock}
      onReorderBlocks={reorderBlocks}
      onMoveBlockUp={moveBlockUp}
      onMoveBlockDown={moveBlockDown}
    />
  );
}
