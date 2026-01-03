'use client';

/**
 * 텍스트 블록 설정 컴포넌트
 *
 * TextBlock의 설정을 편집합니다:
 * - 내용: 표시할 텍스트
 * - 정렬: left, center, right
 * - 크기: sm, md, lg
 */

import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { AlignLeft, AlignCenter, AlignRight } from 'lucide-react';
import type { TextBlock, TextBlockAlign, TextBlockSize } from '@/lib/public-page/block-types';
import type { BlockSettingsProps } from './index';

const SIZE_OPTIONS: { value: TextBlockSize; label: string }[] = [
  { value: 'sm', label: '작게' },
  { value: 'md', label: '보통' },
  { value: 'lg', label: '크게' },
];

export function TextBlockSettings({
  block,
  onUpdate,
}: BlockSettingsProps<TextBlock>) {
  const { config } = block;

  /**
   * config 내 특정 필드 업데이트
   */
  const updateConfig = (updates: Partial<TextBlock['config']>) => {
    onUpdate({
      config: { ...config, ...updates },
    } as Partial<TextBlock>);
  };

  return (
    <div className="space-y-4">
      {/* 내용 */}
      <div className="space-y-2">
        <Label htmlFor="text-content">내용</Label>
        <Textarea
          id="text-content"
          placeholder="텍스트를 입력하세요"
          value={config.content}
          onChange={(e) => updateConfig({ content: e.target.value })}
          rows={4}
        />
        <p className="text-xs text-muted-foreground">
          여러 줄 입력이 가능합니다.
        </p>
      </div>

      {/* 정렬 */}
      <div className="space-y-2">
        <Label>정렬</Label>
        <ToggleGroup
          type="single"
          value={config.align}
          onValueChange={(value: TextBlockAlign) => {
            if (value) updateConfig({ align: value });
          }}
          className="justify-start"
        >
          <ToggleGroupItem value="left" aria-label="왼쪽 정렬">
            <AlignLeft className="h-4 w-4" />
          </ToggleGroupItem>
          <ToggleGroupItem value="center" aria-label="가운데 정렬">
            <AlignCenter className="h-4 w-4" />
          </ToggleGroupItem>
          <ToggleGroupItem value="right" aria-label="오른쪽 정렬">
            <AlignRight className="h-4 w-4" />
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      {/* 크기 */}
      <div className="space-y-2">
        <Label htmlFor="text-size">크기</Label>
        <Select
          value={config.size}
          onValueChange={(value: TextBlockSize) =>
            updateConfig({ size: value })
          }
        >
          <SelectTrigger id="text-size">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SIZE_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
