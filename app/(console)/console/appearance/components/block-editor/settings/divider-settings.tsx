'use client';

/**
 * 디바이더 블록 설정 컴포넌트
 *
 * DividerBlock의 설정을 편집합니다:
 * - 스타일: line, dashed, dotted, space
 * - 간격: sm, md, lg
 */

import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { DividerBlock, DividerBlockStyle, DividerBlockSpacing } from '@/lib/public-page/block-types';
import type { BlockSettingsProps } from './index';

const STYLE_OPTIONS: { value: DividerBlockStyle; label: string }[] = [
  { value: 'line', label: '실선' },
  { value: 'dashed', label: '파선' },
  { value: 'dotted', label: '점선' },
  { value: 'space', label: '빈 공간' },
];

const SPACING_OPTIONS: { value: DividerBlockSpacing; label: string }[] = [
  { value: 'sm', label: '좁게' },
  { value: 'md', label: '보통' },
  { value: 'lg', label: '넓게' },
];

export function DividerBlockSettings({
  block,
  onUpdate,
}: BlockSettingsProps<DividerBlock>) {
  const { config } = block;

  /**
   * config 내 특정 필드 업데이트
   */
  const updateConfig = (updates: Partial<DividerBlock['config']>) => {
    onUpdate({
      config: { ...config, ...updates },
    } as Partial<DividerBlock>);
  };

  return (
    <div className="space-y-4">
      {/* 스타일 */}
      <div className="space-y-2">
        <Label htmlFor="divider-style">스타일</Label>
        <Select
          value={config.style}
          onValueChange={(value: DividerBlockStyle) =>
            updateConfig({ style: value })
          }
        >
          <SelectTrigger id="divider-style">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STYLE_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          {config.style === 'space'
            ? '빈 공간으로 콘텐츠를 구분합니다.'
            : '선 스타일을 선택합니다.'}
        </p>
      </div>

      {/* 간격 */}
      <div className="space-y-2">
        <Label htmlFor="divider-spacing">간격</Label>
        <Select
          value={config.spacing}
          onValueChange={(value: DividerBlockSpacing) =>
            updateConfig({ spacing: value })
          }
        >
          <SelectTrigger id="divider-spacing">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SPACING_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          구분선 위아래의 여백 크기입니다.
        </p>
      </div>
    </div>
  );
}
