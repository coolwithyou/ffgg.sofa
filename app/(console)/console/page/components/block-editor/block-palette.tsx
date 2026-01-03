'use client';

/**
 * 블록 팔레트 컴포넌트
 *
 * 사용 가능한 블록 목록을 표시합니다.
 * - 카테고리별 그룹핑
 * - 드래그 또는 클릭으로 블록 추가
 * - maxInstances 제한 표시
 */

import { useMemo } from 'react';
import { PaletteItem } from './palette-item';
import {
  BLOCK_METAS,
  BlockCategory,
  canAddBlock,
  type Block,
  type BlockTypeValue,
} from '@/lib/public-page/block-types';

/**
 * 카테고리 표시 정보
 */
const CATEGORY_LABELS: Record<string, { label: string; description: string }> = {
  [BlockCategory.ESSENTIAL]: {
    label: '필수 블록',
    description: '페이지의 기본 요소',
  },
  [BlockCategory.CONTENT]: {
    label: '콘텐츠 블록',
    description: '추가 콘텐츠 요소',
  },
};

interface BlockPaletteProps {
  /** 현재 캔버스의 블록 목록 */
  blocks: Block[];
  /** 블록 추가 핸들러 (클릭으로 추가 시) */
  onAddBlock: (type: BlockTypeValue) => void;
}

export function BlockPalette({ blocks, onAddBlock }: BlockPaletteProps) {
  // 카테고리별로 블록 메타 그룹핑
  const groupedMetas = useMemo(() => {
    const groups: Record<string, typeof BLOCK_METAS[BlockTypeValue][]> = {};

    Object.values(BLOCK_METAS).forEach((meta) => {
      if (!groups[meta.category]) {
        groups[meta.category] = [];
      }
      groups[meta.category].push(meta);
    });

    return groups;
  }, []);

  return (
    <div className="space-y-6">
      {Object.entries(groupedMetas).map(([category, metas]) => {
        const categoryInfo = CATEGORY_LABELS[category];

        return (
          <div key={category} className="space-y-3">
            {/* 카테고리 헤더 */}
            <div>
              <h3 className="text-sm font-medium text-foreground">
                {categoryInfo?.label ?? category}
              </h3>
              {categoryInfo?.description && (
                <p className="text-xs text-muted-foreground">
                  {categoryInfo.description}
                </p>
              )}
            </div>

            {/* 블록 목록 */}
            <div className="space-y-2">
              {metas.map((meta) => {
                const isDisabled = !canAddBlock(blocks, meta.type);

                return (
                  <PaletteItem
                    key={meta.type}
                    meta={meta}
                    disabled={isDisabled}
                    onAdd={() => onAddBlock(meta.type)}
                  />
                );
              })}
            </div>
          </div>
        );
      })}

      {/* 안내 메시지 */}
      <div className="rounded-lg border border-dashed border-border p-4 text-center">
        <p className="text-xs text-muted-foreground">
          블록을 드래그하거나 + 버튼을 클릭하여
          <br />
          프리뷰에 추가하세요
        </p>
      </div>
    </div>
  );
}
