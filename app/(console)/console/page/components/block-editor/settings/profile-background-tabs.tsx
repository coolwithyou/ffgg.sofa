'use client';

/**
 * 프로필 배경 탭 컴포넌트
 *
 * 프로필 헤더의 배경을 설정하는 탭 UI입니다:
 * - 배경색 탭: 투명(클래식) 또는 단색 배경(솔리드 컬러)
 * - 이미지 탭: 배경 이미지 + 오버레이 설정(히어로 이미지)
 *
 * 탭 선택에 따라 내부적으로 profileTheme이 자동 설정됩니다.
 */

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ColorPicker, COLOR_PRESETS } from '@/components/ui/color-picker';
import { ImageUploadField } from './image-upload-field';
import { ProfileTheme } from '@/lib/public-page/header-templates';
import type { HeaderBlock } from '@/lib/public-page/block-types';
import { Palette, ImageIcon } from 'lucide-react';

interface ProfileBackgroundTabsProps {
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

// 헤더 배경색 프리셋 (primary 계열 + 어두운 톤)
const HEADER_BG_PRESETS = [
  '#3B82F6', // Blue
  '#2563EB', // Blue darker
  '#8B5CF6', // Purple
  '#7C3AED', // Purple darker
  '#EC4899', // Pink
  '#10B981', // Green
  '#F59E0B', // Amber
  '#1f2937', // Gray dark
  '#18181b', // Zinc dark
];

export function ProfileBackgroundTabs({
  config,
  onUpdate,
}: ProfileBackgroundTabsProps) {
  // 현재 모드 결정: 이미지가 있으면 'image', 그 외는 'color'
  const defaultTab = config.heroImageUrl ? 'image' : 'color';

  // 배경색이 없으면 투명(클래식) 모드
  const isTransparent = !config.headerBackgroundColor;

  const overlayOpacity = config.heroOverlayOpacity ?? 40;
  const minHeight = config.heroMinHeight ?? '300px';

  /**
   * 배경색 탭에서 투명 토글
   */
  const handleTransparentChange = (checked: boolean) => {
    if (checked) {
      // 투명으로 설정 → classic 테마
      onUpdate({
        headerBackgroundColor: undefined,
        profileTheme: ProfileTheme.CLASSIC,
      });
    } else {
      // 기본 색상으로 설정 → solid-color 테마
      onUpdate({
        headerBackgroundColor: '#3B82F6',
        profileTheme: ProfileTheme.SOLID_COLOR,
      });
    }
  };

  /**
   * 배경색 변경
   */
  const handleColorChange = (color: string) => {
    onUpdate({
      headerBackgroundColor: color,
      profileTheme: ProfileTheme.SOLID_COLOR,
    });
  };

  /**
   * 이미지 업로드/삭제
   */
  const handleImageChange = (url: string | undefined) => {
    if (url) {
      // 이미지 설정 → hero-image 테마
      onUpdate({
        heroImageUrl: url,
        profileTheme: ProfileTheme.HERO_IMAGE,
      });
    } else {
      // 이미지 삭제 → 배경색 상태에 따라 테마 결정
      onUpdate({
        heroImageUrl: undefined,
        profileTheme: config.headerBackgroundColor
          ? ProfileTheme.SOLID_COLOR
          : ProfileTheme.CLASSIC,
      });
    }
  };

  /**
   * 탭 변경 시 테마 자동 설정
   */
  const handleTabChange = (value: string) => {
    if (value === 'color') {
      // 색상 탭으로 전환 시, 현재 배경색 상태에 따라 테마 결정
      onUpdate({
        profileTheme: config.headerBackgroundColor
          ? ProfileTheme.SOLID_COLOR
          : ProfileTheme.CLASSIC,
      });
    } else if (value === 'image') {
      // 이미지 탭으로 전환 시, 이미지가 있으면 hero-image 테마
      if (config.heroImageUrl) {
        onUpdate({
          profileTheme: ProfileTheme.HERO_IMAGE,
        });
      }
    }
  };

  return (
    <div className="space-y-3">
      <Label className="text-base font-medium">프로필 배경</Label>

      <Tabs
        defaultValue={defaultTab}
        onValueChange={handleTabChange}
        className="w-full"
      >
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="color" className="gap-1.5">
            <Palette className="h-3.5 w-3.5" />
            배경색
          </TabsTrigger>
          <TabsTrigger value="image" className="gap-1.5">
            <ImageIcon className="h-3.5 w-3.5" />
            이미지
          </TabsTrigger>
        </TabsList>

        {/* 배경색 탭 */}
        <TabsContent value="color" className="space-y-4 pt-3">
          {/* 투명 옵션 */}
          <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 p-3">
            <div className="space-y-0.5">
              <Label
                htmlFor="transparent-bg"
                className="cursor-pointer text-sm font-medium"
              >
                투명 (배경 없음)
              </Label>
              <p className="text-xs text-muted-foreground">
                클래식 스타일로 배경 없이 표시됩니다
              </p>
            </div>
            <Switch
              id="transparent-bg"
              checked={isTransparent}
              onCheckedChange={handleTransparentChange}
            />
          </div>

          {/* 배경색 선택 (투명이 아닐 때만) */}
          {!isTransparent && (
            <ColorPicker
              label="배경색"
              value={config.headerBackgroundColor || '#3B82F6'}
              onChange={handleColorChange}
              presets={HEADER_BG_PRESETS}
              description="프로필 영역 배경"
            />
          )}
        </TabsContent>

        {/* 이미지 탭 */}
        <TabsContent value="image" className="space-y-4 pt-3">
          {/* 배경 이미지 업로드 */}
          <ImageUploadField
            id="profile-hero-image"
            label="배경 이미지"
            value={config.heroImageUrl || ''}
            onChange={(url) => handleImageChange(url || undefined)}
            placeholder="https://example.com/hero.jpg"
            maxSize={1920}
            previewHeight={120}
          />
          <p className="text-xs text-muted-foreground">
            이미지가 없으면 테마 색상의 그라디언트가 표시됩니다.
          </p>

          {/* 이미지가 있을 때만 추가 설정 표시 */}
          {config.heroImageUrl && (
            <div className="space-y-4 rounded-lg border border-border bg-muted/30 p-4">
              <div className="text-sm font-medium text-foreground">
                이미지 설정
              </div>

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
                  onValueChange={(value) =>
                    onUpdate({ heroOverlayOpacity: value[0] })
                  }
                  className="w-full"
                />
                <p className="text-xs text-muted-foreground">
                  텍스트 가독성을 위해 어두운 오버레이를 적용합니다
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
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
