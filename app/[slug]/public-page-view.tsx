'use client';

/**
 * 공개 페이지 클라이언트 뷰
 *
 * Linktree 스타일 독립 페이지 레이아웃
 * - blocks 배열 기반 렌더링 (WYSIWYG)
 * - 편집 모드에서는 동일한 UI에 편집 컨트롤 오버레이
 * - 보기 모드에서는 순수 콘텐츠만 표시
 *
 * 주의: 편집 모드에서는 외부에서 DndContext (BlockEditorProvider)로 감싸야 합니다.
 * SortableContext만 내부에서 제공하여 블록 정렬을 지원합니다.
 */

import { useMemo } from 'react';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import type { PublicPageConfig } from '@/lib/public-page/types';
import {
  type Block,
  createHeaderBlock,
  createChatbotBlock,
} from '@/lib/public-page/block-types';
import { BlockRenderer } from './components/block-renderer';
import { EditableBlockWrapper } from './components/editable-block-wrapper';
import { DropIndicator } from './components/drop-indicator';
import { useBlockEditorContextSafe } from '@/app/(console)/console/page/components/block-editor/dnd-context';

interface PublicPageViewProps {
  chatbotId: string;
  chatbotName: string;
  tenantId: string;
  config: PublicPageConfig;
  widgetConfig?: Record<string, unknown> | null;
  /** 편집 모드 여부 */
  isEditing?: boolean;
  /** 선택된 블록 ID */
  selectedBlockId?: string | null;
  /** 블록 선택 콜백 */
  onSelectBlock?: (id: string | null) => void;
  /** 블록 가시성 토글 콜백 */
  onToggleVisibility?: (id: string) => void;
  /** 블록 삭제 콜백 */
  onDeleteBlock?: (id: string) => void;
  /** 블록 순서 변경 콜백 */
  onReorderBlocks?: (activeId: string, overId: string) => void;
  /** 블록 위로 이동 콜백 */
  onMoveBlockUp?: (id: string) => void;
  /** 블록 아래로 이동 콜백 */
  onMoveBlockDown?: (id: string) => void;
}

export function PublicPageView({
  chatbotId,
  chatbotName,
  tenantId,
  config,
  widgetConfig,
  isEditing = false,
  selectedBlockId,
  onSelectBlock,
  onToggleVisibility,
  onDeleteBlock,
  onReorderBlocks,
  onMoveBlockUp,
  onMoveBlockDown,
}: PublicPageViewProps) {
  const { header, theme, chatbot } = config;

  // 테마 CSS 변수 설정
  const themeStyles = {
    '--pp-bg-color': theme.backgroundColor,
    '--pp-primary-color': theme.primaryColor,
    '--pp-text-color': theme.textColor,
    '--pp-font-family': theme.fontFamily || 'system-ui, -apple-system, sans-serif',
  } as React.CSSProperties;

  // 헤더 타이틀 (설정값 없으면 챗봇 이름 사용)
  const headerTitle = header.title || chatbotName;

  // 위젯 설정에서 웰컴 메시지와 플레이스홀더 추출
  const welcomeMessage =
    (widgetConfig?.welcomeMessage as string) ||
    `안녕하세요! ${headerTitle}입니다. 무엇을 도와드릴까요?`;
  const placeholder =
    (widgetConfig?.placeholder as string) || '메시지를 입력하세요...';

  /**
   * 블록 배열 생성
   * - config.blocks가 있으면 사용
   * - 없으면 기존 header/chatbot 설정에서 기본 블록 생성 (하위 호환성)
   */
  const blocks = useMemo<Block[]>(() => {
    if (config.blocks && config.blocks.length > 0) {
      return [...config.blocks].sort((a, b) => a.order - b.order);
    }

    // 하위 호환성: blocks 배열이 없으면 기본 블록 생성
    const defaultBlocks: Block[] = [
      createHeaderBlock('default-header', 0),
      createChatbotBlock('default-chatbot', 1),
    ];
    return defaultBlocks;
  }, [config.blocks]);

  // 배경 클릭 시 선택 해제
  const handleBackgroundClick = () => {
    if (isEditing) {
      onSelectBlock?.(null);
    }
  };

  // 블록 렌더링 공통 props
  const blockRendererProps = {
    config,
    chatbotId,
    tenantId,
    chatbotName,
    welcomeMessage,
    placeholder,
    isEditing,
  };

  // 드래그 컨텍스트 (편집 모드에서만 사용)
  const dragContext = useBlockEditorContextSafe();
  const activeItem = dragContext?.activeItem;
  const overBlockId = dragContext?.overBlockId;

  // 팔레트에서 드래그 중인지 확인
  const isDraggingFromPalette = activeItem?.source === 'palette' && activeItem.blockType;

  /**
   * 블록 콘텐츠 렌더링
   * - 편집 모드: EditableBlockWrapper로 감싸기 (외부 BlockEditorProvider 필요)
   * - 보기 모드: BlockRenderer만 렌더링
   */
  const renderBlocks = () => {
    // 보기 모드: 순수 블록만 렌더링
    if (!isEditing) {
      return blocks.map((block) => (
        <BlockRenderer key={block.id} block={block} {...blockRendererProps} />
      ));
    }

    // 편집 모드: SortableContext와 편집 래퍼 적용
    // 주의: 외부에서 DndContext (BlockEditorProvider)로 감싸야 정상 작동
    return (
      <SortableContext
        items={blocks.map((b) => b.id)}
        strategy={verticalListSortingStrategy}
      >
        {/* 편집 모드: 블록 간 간격은 일반 뷰와 동일하게 유지 (툴바는 호버 시 오버레이로 표시) */}
        <div className="space-y-4">
          {blocks.map((block, index) => {
            // 현재 블록이 드래그 오버 중인 블록인지 확인
            const showDropIndicator = isDraggingFromPalette && overBlockId === block.id;

            return (
              <div key={block.id}>
                {/* 드롭 인디케이터 (이 블록 위치에 삽입될 때 표시) */}
                {showDropIndicator && activeItem?.blockType && (
                  <div className="mb-4">
                    <DropIndicator blockType={activeItem.blockType} />
                  </div>
                )}

                <EditableBlockWrapper
                  block={block}
                  isSelected={selectedBlockId === block.id}
                  isFirst={index === 0}
                  isLast={index === blocks.length - 1}
                  onSelect={() => onSelectBlock?.(block.id)}
                  onToggleVisibility={() => onToggleVisibility?.(block.id)}
                  onDelete={() => onDeleteBlock?.(block.id)}
                  onMoveUp={() => onMoveBlockUp?.(block.id)}
                  onMoveDown={() => onMoveBlockDown?.(block.id)}
                >
                  <BlockRenderer block={block} {...blockRendererProps} />
                </EditableBlockWrapper>
              </div>
            );
          })}

          {/* 블록이 없거나 캔버스 끝에 드래그 중일 때 인디케이터 표시 */}
          {isDraggingFromPalette && !overBlockId && activeItem?.blockType && (
            <DropIndicator blockType={activeItem.blockType} />
          )}
        </div>
      </SortableContext>
    );
  };

  return (
    <main
      className="min-h-screen"
      style={{
        ...themeStyles,
        backgroundColor: 'var(--pp-bg-color)',
        color: 'var(--pp-text-color)',
        fontFamily: 'var(--pp-font-family)',
      }}
      onClick={handleBackgroundClick}
    >
      <div className="mx-auto max-w-2xl px-4 py-8">
        {/* 편집 모드에서는 상단 여백 확보 (툴바 표시용) */}
        <div className={isEditing ? 'pt-12' : ''}>
          {renderBlocks()}
        </div>

        {/* 푸터 (브랜드 표시) */}
        {header.showBrandName && (
          <footer className="pt-8 text-center">
            <p className="text-sm opacity-50">Powered by SOFA</p>
          </footer>
        )}
      </div>
    </main>
  );
}
