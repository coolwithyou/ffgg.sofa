'use client';

/**
 * 블록 설정 패널
 *
 * 선택된 블록의 설정 UI를 표시합니다.
 * 블록 타입에 따라 적절한 설정 컴포넌트를 동적으로 렌더링합니다.
 *
 * @example
 * ```tsx
 * <BlockSettingsPanel
 *   selectedBlock={block}
 *   onUpdate={(updates) => updateBlock(block.id, updates)}
 *   onClose={() => selectBlock(null)}
 * />
 * ```
 */

import { Suspense } from 'react';
import { X, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { BLOCK_METAS, type Block } from '@/lib/public-page/block-types';
import { BLOCK_SETTINGS_COMPONENTS } from './settings';

interface BlockSettingsPanelProps {
  /** 선택된 블록 */
  selectedBlock: Block | null;
  /** 블록 업데이트 핸들러 */
  onUpdate: (updates: Partial<Block>) => void;
  /** 패널 닫기 핸들러 */
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
 * 블록 설정 패널 컴포넌트
 */
export function BlockSettingsPanel({
  selectedBlock,
  onUpdate,
  onClose,
}: BlockSettingsPanelProps) {
  // 선택된 블록이 없으면 빈 상태 표시
  if (!selectedBlock) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Settings2 className="h-12 w-12 text-muted-foreground/30 mb-4" />
        <p className="text-sm font-medium text-muted-foreground">
          블록을 선택하세요
        </p>
        <p className="text-xs text-muted-foreground/70 mt-1">
          캔버스에서 블록을 클릭하면 여기에 설정이 표시됩니다
        </p>
      </div>
    );
  }

  const meta = BLOCK_METAS[selectedBlock.type];
  const SettingsComponent = BLOCK_SETTINGS_COMPONENTS[selectedBlock.type];

  return (
    <div className="flex flex-col">
      {/* 헤더 */}
      <div className="flex items-center justify-between border-b border-border pb-3 mb-4">
        <div className="flex items-center gap-2">
          <Settings2 className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-medium text-foreground">
            {meta?.name ?? '블록'} 설정
          </h3>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={onClose}
        >
          <X className="h-4 w-4" />
          <span className="sr-only">설정 닫기</span>
        </Button>
      </div>

      {/* 설정 컴포넌트 */}
      {SettingsComponent ? (
        <Suspense fallback={<SettingsLoadingFallback />}>
          <SettingsComponent block={selectedBlock} onUpdate={onUpdate} />
        </Suspense>
      ) : (
        <NoSettingsAvailable blockType={selectedBlock.type} />
      )}
    </div>
  );
}
