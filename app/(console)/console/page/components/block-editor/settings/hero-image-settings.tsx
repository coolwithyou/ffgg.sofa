'use client';

/**
 * 히어로 이미지 테마 설정
 *
 * 히어로 이미지 테마 전용 설정을 편집합니다.
 * - 배경 이미지 URL
 * - 오버레이 투명도 (0-100)
 * - 최소 높이
 */

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { HeaderBlock } from '@/lib/public-page/block-types';
import { ImageUploadField } from './image-upload-field';

interface HeroImageSettingsProps {
  /** 현재 헤더 블록 설정 */
  config: HeaderBlock['config'];
  /** 설정 업데이트 핸들러 */
  onUpdate: (updates: Partial<HeaderBlock['config']>) => void;
}

const HEIGHT_OPTIONS = [
  { value: '200px', label: '작음 (200px)' },
  { value: '300px', label: '중간 (300px)' },
  { value: '400px', label: '큼 (400px)' },
  { value: '50vh', label: '화면 절반 (50vh)' },
  { value: '70vh', label: '화면 대부분 (70vh)' },
];

export function HeroImageSettings({
  config,
  onUpdate,
}: HeroImageSettingsProps) {
  const overlayOpacity = config.heroOverlayOpacity ?? 40;
  const minHeight = config.heroMinHeight ?? '300px';

  return (
    <div className="space-y-4 rounded-lg border border-border bg-muted/30 p-4">
      <div className="text-sm font-medium text-foreground">
        히어로 이미지 설정
      </div>

      {/* 배경 이미지 */}
      <ImageUploadField
        id="hero-image"
        label="배경 이미지"
        value={config.heroImageUrl || ''}
        onChange={(url) => onUpdate({ heroImageUrl: url || undefined })}
        placeholder="https://example.com/hero.jpg"
        maxSize={1920}
        previewHeight={120}
      />
      <p className="text-xs text-muted-foreground">
        이미지가 없으면 프라이머리 컬러 그라디언트가 표시됩니다.
      </p>

      {/* 오버레이 투명도 */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="overlay-opacity" className="text-xs">
            오버레이 투명도
          </Label>
          <span className="text-xs text-muted-foreground">
            {overlayOpacity}%
          </span>
        </div>
        <Slider
          id="overlay-opacity"
          min={0}
          max={80}
          step={5}
          value={[overlayOpacity]}
          onValueChange={(value) => onUpdate({ heroOverlayOpacity: value[0] })}
          className="w-full"
        />
        <p className="text-xs text-muted-foreground">
          텍스트 가독성을 위해 배경에 어두운 오버레이를 적용합니다.
        </p>
      </div>

      {/* 최소 높이 */}
      <div className="space-y-1.5">
        <Label htmlFor="min-height" className="text-xs">
          최소 높이
        </Label>
        <Select
          value={minHeight}
          onValueChange={(value) => onUpdate({ heroMinHeight: value })}
        >
          <SelectTrigger id="min-height" className="h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {HEIGHT_OPTIONS.map((option) => (
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
