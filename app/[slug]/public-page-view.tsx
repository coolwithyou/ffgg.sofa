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
  type HeaderBlock as HeaderBlockType,
  BlockType,
} from '@/lib/public-page/block-types';
import { getBackgroundStyles } from '@/lib/public-page/background-utils';
import { BlockRenderer } from './components/block-renderer';
import { EditableBlockWrapper } from './components/editable-block-wrapper';
import { DropIndicator } from './components/drop-indicator';
import { useBlockEditorContextSafe } from '@/app/(console)/console/page/components/block-editor/dnd-context';

/**
 * 그림자 강도(0-100)를 CSS box-shadow 값으로 변환
 */
function getCardShadow(intensity: number = 20): string {
  if (intensity === 0) return 'none';
  const opacity = (intensity / 100) * 0.25;
  const blur = 4 + (intensity / 100) * 20;
  const spread = blur / 4;
  return `0 ${spread}px ${blur}px rgba(0, 0, 0, ${opacity})`;
}

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
  /** 블록 설정 다이얼로그 열기 콜백 */
  onOpenBlockSettings?: (id: string) => void;
  /** min-h-screen 비활성화 (외부에서 높이 관리 시) */
  disableMinHeight?: boolean;
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
  onOpenBlockSettings,
  disableMinHeight = false,
}: PublicPageViewProps) {
  const { header, theme, chatbot } = config;

  // 테마 CSS 변수 설정
  // --card: ProfileGradientZone이 카드 배경색 그라데이션에 사용
  const themeStyles = {
    '--pp-bg-color': theme.backgroundColor,
    '--pp-primary-color': theme.primaryColor,
    '--pp-text-color': theme.textColor,
    '--pp-font-family': theme.fontFamily || 'system-ui, -apple-system, sans-serif',
    '--card': theme.cardBackgroundColor ?? '#ffffff',
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
   * 블록 배열 생성 및 헤더 블록 분리
   * - config.blocks를 order 기준으로 정렬
   * - 헤더 블록은 별도로 추출하여 고정 요소로 렌더링
   *
   * NOTE: 기본 블록 생성은 useBlocks 훅에서 처리합니다.
   * 이 컴포넌트는 전달받은 blocks를 렌더링만 담당합니다.
   */
  const { headerBlock, contentBlocks } = useMemo(() => {
    // blocks 정렬 (기본 블록 생성은 useBlocks에서 처리)
    const allBlocks = [...(config.blocks ?? [])].sort((a, b) => a.order - b.order);

    // 헤더 블록 추출 (고정 요소로 분리)
    const header = allBlocks.find(
      (block) => block.type === BlockType.HEADER
    ) as HeaderBlockType | undefined;

    // 나머지 블록 (헤더 제외)
    const content = allBlocks.filter((block) => block.type !== BlockType.HEADER);

    return { headerBlock: header, contentBlocks: content };
  }, [config.blocks]);

  // 기존 blocks 참조 유지 (편집 모드용)
  const blocks = contentBlocks;

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
                  onOpenSettings={() => onOpenBlockSettings?.(block.id)}
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

  // 배경 스타일
  // 편집 모드: 투명 배경 (부모 CenterPreview에서 배경 적용)
  // 보기 모드: backgroundType에 따른 배경 스타일 적용
  const backgroundStyles: React.CSSProperties = {
    ...themeStyles,
    color: 'var(--pp-text-color)',
    fontFamily: 'var(--pp-font-family)',
    // 편집 모드: 투명 배경, 보기 모드: 테마 배경
    ...(isEditing
      ? { backgroundColor: 'transparent' }
      : getBackgroundStyles(theme)),
  };

  // 카드 border-radius
  const cardBorderRadius = theme.cardBorderRadius ?? 16;

  // 카드 컨테이너 스타일
  // - 프로필 카드가 카드 상단에 꽉 차도록 상단/좌우 패딩 0
  // - 콘텐츠 영역에서 별도로 패딩 적용
  const cardContainerStyles: React.CSSProperties = {
    backgroundColor: theme.cardBackgroundColor ?? '#ffffff',
    boxShadow: getCardShadow(theme.cardShadow ?? 20),
    marginTop: `${theme.cardMarginY ?? 32}px`,
    marginBottom: `${theme.cardMarginY ?? 32}px`,
    paddingLeft: '0',
    paddingRight: '0',
    paddingTop: '0',
    paddingBottom: '0',
    borderRadius: `${cardBorderRadius}px`,
    // 편집 모드: overflow visible로 설정해야 블록 툴바(-top-10)가 보임
    // 보기 모드: overflow hidden으로 프로필 카드가 border-radius를 따르도록
    overflow: isEditing ? 'visible' : 'hidden',
  };

  // 콘텐츠 영역 패딩 (프로필 카드 제외한 나머지 블록들)
  const contentPaddingX = theme.cardPaddingX ?? 16;

  // 편집 모드: 부모 컨테이너 채우기 (min-h-full)
  // 보기 모드: 전체 화면 채우기 (min-h-screen)
  // disableMinHeight: 외부 래퍼가 높이를 관리할 때 (미리보기 모드 등)
  const mainClassName = isEditing
    ? 'min-h-full'
    : disableMinHeight
      ? 'flex-1'
      : 'min-h-screen';

  return (
    <main
      className={mainClassName}
      style={backgroundStyles}
      onClick={handleBackgroundClick}
    >
      <div className="mx-auto max-w-2xl px-4">
        {/* 카드 컨테이너 */}
        <div style={cardContainerStyles}>
          {/* 프로필 카드 - 고정 요소로 카드 최상단에 렌더링 */}
          {/* 헤더 영역 wrapper: overflow:hidden + 상단 border-radius로 모서리 처리 */}
          {/* 편집 모드에서도 카드의 border-radius가 적용되도록 별도 wrapper 사용 */}
          {headerBlock && (
            <div
              style={{
                overflow: 'hidden',
                borderTopLeftRadius: `${cardBorderRadius}px`,
                borderTopRightRadius: `${cardBorderRadius}px`,
              }}
            >
              {isEditing ? (
                // 편집 모드: EditableBlockWrapper로 감싸서 설정 버튼 제공
                // 단, 헤더 블록은 고정 위치이므로 이동/삭제 비활성화
                <EditableBlockWrapper
                  block={headerBlock}
                  isSelected={selectedBlockId === headerBlock.id}
                  isFirst={true}
                  isLast={true} // 이동 버튼 비활성화
                  onSelect={() => onSelectBlock?.(headerBlock.id)}
                  onToggleVisibility={() => onToggleVisibility?.(headerBlock.id)}
                  // onDelete 미전달로 삭제 버튼 비활성화
                  // onMoveUp, onMoveDown 미전달로 이동 버튼 비활성화
                  onOpenSettings={() => onOpenBlockSettings?.(headerBlock.id)}
                  toolbarPosition="top-inside"
                >
                  <BlockRenderer
                    block={headerBlock}
                    {...blockRendererProps}
                  />
                </EditableBlockWrapper>
              ) : (
                // 보기 모드: 순수 렌더링
                <BlockRenderer
                  block={headerBlock}
                  {...blockRendererProps}
                />
              )}
            </div>
          )}

          {/* 콘텐츠 블록들 - 프로필 카드와 달리 좌우 패딩 적용 */}
          <div
            className={isEditing ? 'pt-12' : 'pt-6'}
            style={{
              paddingLeft: `${contentPaddingX}px`,
              paddingRight: `${contentPaddingX}px`,
              paddingBottom: '32px',
            }}
          >
            {renderBlocks()}

            {/* 푸터 (브랜드 표시) */}
            {header.showBrandName && (
              <footer className="pt-8 text-center">
                <p className="text-sm opacity-50">Powered by SOFA</p>
              </footer>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
