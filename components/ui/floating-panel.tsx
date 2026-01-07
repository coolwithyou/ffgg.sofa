'use client';

/**
 * 플로팅 패널 컴포넌트
 *
 * 포토샵/피그마 스타일의 드래그 가능한 패널입니다.
 * 배경 오버레이 없이 캔버스와 자유롭게 상호작용할 수 있습니다.
 *
 * 특징:
 * - 헤더 드래그로 위치 이동
 * - localStorage에 위치 저장 (마지막 위치 기억)
 * - ESC 키로 닫기
 * - 뷰포트 경계 내로 제한
 * - 배경 오버레이 없음
 *
 * @example
 * ```tsx
 * <FloatingPanel
 *   isOpen={isOpen}
 *   onClose={() => setIsOpen(false)}
 *   title="블록 설정"
 *   width={400}
 *   maxHeight="70vh"
 * >
 *   <SettingsContent />
 * </FloatingPanel>
 * ```
 */

import { ReactNode, useEffect, useRef, useState } from 'react';
import { X, GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDraggablePanel, type PanelPosition } from '@/hooks/use-draggable-panel';

interface FloatingPanelProps {
  /** 패널 열림 상태 */
  isOpen: boolean;
  /** 닫기 핸들러 */
  onClose: () => void;
  /** 패널 제목 */
  title: string;
  /** 패널 내용 */
  children: ReactNode;
  /** 초기 위치 (저장된 위치가 없을 때) */
  defaultPosition?: PanelPosition;
  /** 패널 너비 (px) */
  width?: number;
  /** 패널 최대 높이 */
  maxHeight?: string;
  /** localStorage 저장 키 */
  storageKey?: string;
  /** 추가 className */
  className?: string;
}

export function FloatingPanel({
  isOpen,
  onClose,
  title,
  children,
  defaultPosition,
  width = 400,
  maxHeight = '70vh',
  storageKey = 'floating-panel-position',
  className,
}: FloatingPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  // 최초 마운트 여부 추적 (드래그 종료 시 애니메이션 재실행 방지)
  const hasAnimated = useRef(false);

  // 드래그 로직
  const { position, isDragging, dragHandleProps } = useDraggablePanel({
    storageKey,
    defaultPosition,
    panelSize: { width, height: 500 }, // 대략적인 높이 (경계 계산용)
  });

  // ESC 키로 닫기
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // 패널 외부 클릭 감지 (선택적 - 현재는 비활성화)
  // 캔버스와 자유롭게 상호작용하려면 외부 클릭으로 닫지 않는 것이 좋음

  if (!isOpen) return null;

  // 최초 마운트 시에만 애니메이션 적용
  const shouldAnimate = !hasAnimated.current;
  if (shouldAnimate) {
    hasAnimated.current = true;
  }

  // 헤더 높이 (py-3 = 12px * 2 + 내용물)
  const headerHeight = 52;

  return (
    <div
      ref={panelRef}
      className={cn(
        'fixed z-30 flex flex-col rounded-lg border border-border bg-card shadow-xl',
        // 최초 마운트 시에만 애니메이션 적용 (드래그 종료 시 깜빡임 방지)
        shouldAnimate && 'animate-in fade-in zoom-in-95 duration-200',
        isDragging && 'shadow-2xl',
        className
      )}
      style={{
        left: position.x,
        top: position.y,
        width,
        maxHeight,
      }}
      role="dialog"
      aria-modal="false" // 모달이 아님 (캔버스 클릭 가능)
      aria-labelledby="floating-panel-title"
    >
      {/* 드래그 가능한 헤더 */}
      <div
        className={cn(
          'flex shrink-0 items-center justify-between border-b border-border px-4 py-3',
          'rounded-t-lg bg-muted/30',
          'select-none' // 드래그 시 텍스트 선택 방지
        )}
      >
        {/* 드래그 핸들 영역 (제목 포함) */}
        <div
          className="flex flex-1 items-center gap-2"
          {...dragHandleProps}
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
          <h3
            id="floating-panel-title"
            className="font-medium text-foreground"
          >
            {title}
          </h3>
        </div>
        {/* 닫기 버튼 (드래그 영역에서 제외) */}
        <button
          onClick={onClose}
          className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          aria-label="닫기"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* 스크롤 가능한 콘텐츠 */}
      <div
        className="flex-1 overflow-y-auto p-4"
        style={{
          maxHeight: `calc(${maxHeight} - ${headerHeight}px)`,
        }}
      >
        {children}
      </div>
    </div>
  );
}
