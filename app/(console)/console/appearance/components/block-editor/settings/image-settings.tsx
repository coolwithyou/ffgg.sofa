'use client';

/**
 * 이미지 블록 설정 컴포넌트
 *
 * ImageBlock의 설정을 편집합니다:
 * - 이미지 URL: 표시할 이미지 주소
 * - 대체 텍스트: 접근성을 위한 alt 텍스트
 * - 캡션: 이미지 아래 표시할 설명
 * - 종횡비: 1:1, 4:3, 16:9, auto
 * - 링크 URL: 클릭 시 이동할 주소
 */

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { ImageBlock, ImageBlockAspectRatio } from '@/lib/public-page/block-types';
import type { BlockSettingsProps } from './index';

const ASPECT_RATIO_OPTIONS: { value: ImageBlockAspectRatio; label: string }[] = [
  { value: '1:1', label: '정사각형 (1:1)' },
  { value: '4:3', label: '가로형 (4:3)' },
  { value: '16:9', label: '와이드 (16:9)' },
  { value: 'auto', label: '원본 비율' },
];

export function ImageBlockSettings({
  block,
  onUpdate,
}: BlockSettingsProps<ImageBlock>) {
  const { config } = block;

  /**
   * config 내 특정 필드 업데이트
   */
  const updateConfig = (updates: Partial<ImageBlock['config']>) => {
    onUpdate({
      config: { ...config, ...updates },
    } as Partial<ImageBlock>);
  };

  return (
    <div className="space-y-4">
      {/* 이미지 URL */}
      <div className="space-y-2">
        <Label htmlFor="image-src">이미지 URL</Label>
        <Input
          id="image-src"
          type="url"
          placeholder="https://example.com/image.jpg"
          value={config.src}
          onChange={(e) => updateConfig({ src: e.target.value })}
        />
      </div>

      {/* 대체 텍스트 */}
      <div className="space-y-2">
        <Label htmlFor="image-alt">대체 텍스트</Label>
        <Input
          id="image-alt"
          placeholder="이미지 설명"
          value={config.alt}
          onChange={(e) => updateConfig({ alt: e.target.value })}
        />
        <p className="text-xs text-muted-foreground">
          시각장애인을 위한 이미지 설명입니다.
        </p>
      </div>

      {/* 캡션 */}
      <div className="space-y-2">
        <Label htmlFor="image-caption">캡션 (선택)</Label>
        <Textarea
          id="image-caption"
          placeholder="이미지 아래 표시할 설명"
          value={config.caption ?? ''}
          onChange={(e) => updateConfig({ caption: e.target.value })}
          rows={2}
        />
      </div>

      {/* 종횡비 */}
      <div className="space-y-2">
        <Label htmlFor="image-aspect-ratio">종횡비</Label>
        <Select
          value={config.aspectRatio}
          onValueChange={(value: ImageBlockAspectRatio) =>
            updateConfig({ aspectRatio: value })
          }
        >
          <SelectTrigger id="image-aspect-ratio">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ASPECT_RATIO_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* 링크 URL */}
      <div className="space-y-2">
        <Label htmlFor="image-link-url">링크 URL (선택)</Label>
        <Input
          id="image-link-url"
          type="url"
          placeholder="https://example.com"
          value={config.linkUrl ?? ''}
          onChange={(e) => updateConfig({ linkUrl: e.target.value })}
        />
        <p className="text-xs text-muted-foreground">
          이미지 클릭 시 이동할 주소입니다.
        </p>
      </div>
    </div>
  );
}
