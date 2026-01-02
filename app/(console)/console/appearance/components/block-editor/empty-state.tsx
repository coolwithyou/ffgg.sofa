'use client';

/**
 * 빈 캔버스 상태 컴포넌트
 *
 * 블록이 없을 때 표시되는 안내 UI입니다.
 */

import { Layers, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface EmptyStateProps {
  /** 드롭 영역 위에 있는지 여부 */
  isOver?: boolean;
  /** 블록 추가 클릭 핸들러 */
  onAddClick?: () => void;
}

export function EmptyState({ isOver = false, onAddClick }: EmptyStateProps) {
  return (
    <div
      className={`
        flex flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed p-8 text-center transition-colors
        ${isOver ? 'border-primary bg-primary/5' : 'border-border bg-muted/30'}
      `}
    >
      <div
        className={`
          flex h-16 w-16 items-center justify-center rounded-full transition-colors
          ${isOver ? 'bg-primary/20' : 'bg-muted'}
        `}
      >
        <Layers
          className={`
            h-8 w-8 transition-colors
            ${isOver ? 'text-primary' : 'text-muted-foreground'}
          `}
        />
      </div>

      <div className="space-y-1">
        <h3 className="text-base font-medium text-foreground">
          {isOver ? '여기에 놓으세요' : '블록을 추가해보세요'}
        </h3>
        <p className="text-sm text-muted-foreground">
          {isOver
            ? '드래그 중인 블록을 이 영역에 놓으면 추가됩니다'
            : '우측 패널에서 블록을 드래그하거나 아래 버튼을 클릭하세요'}
        </p>
      </div>

      {!isOver && onAddClick && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onAddClick}
          className="gap-2"
        >
          <Plus className="h-4 w-4" />
          첫 번째 블록 추가
        </Button>
      )}
    </div>
  );
}
