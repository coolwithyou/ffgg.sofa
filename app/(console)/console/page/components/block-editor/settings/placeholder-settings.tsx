'use client';

/**
 * 플레이스홀더 블록 설정 컴포넌트
 *
 * PlaceholderBlock의 설정을 편집합니다:
 * - 라벨: 블록에 표시할 텍스트
 *
 * 테스트/개발 용도의 블록입니다.
 */

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { PlaceholderBlock } from '@/lib/public-page/block-types';
import type { BlockSettingsProps } from './index';

export function PlaceholderBlockSettings({
  block,
  onUpdate,
}: BlockSettingsProps<PlaceholderBlock>) {
  const { config } = block;

  /**
   * config 내 특정 필드 업데이트
   */
  const updateConfig = (updates: Partial<PlaceholderBlock['config']>) => {
    onUpdate({
      config: { ...config, ...updates },
    } as Partial<PlaceholderBlock>);
  };

  return (
    <div className="space-y-4">
      {/* 라벨 */}
      <div className="space-y-2">
        <Label htmlFor="placeholder-label">라벨</Label>
        <Input
          id="placeholder-label"
          placeholder="블록에 표시할 텍스트"
          value={config.label}
          onChange={(e) => updateConfig({ label: e.target.value })}
        />
        <p className="text-xs text-muted-foreground">
          테스트용 블록에 표시될 텍스트입니다.
        </p>
      </div>
    </div>
  );
}
