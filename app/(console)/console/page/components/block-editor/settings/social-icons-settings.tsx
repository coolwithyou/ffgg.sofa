'use client';

/**
 * 소셜 아이콘 블록 설정 컴포넌트
 *
 * SocialIconsBlock의 설정을 편집합니다:
 * - 아이콘 목록: 타입과 URL
 * - 크기: sm, md, lg
 * - 스타일: default, filled, outline
 */

import { useState } from 'react';
import { Plus, Trash2, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type {
  SocialIconsBlock,
  SocialIconItem,
  SocialIconType,
  SocialIconsBlockSize,
  SocialIconsBlockStyle,
} from '@/lib/public-page/block-types';
import type { BlockSettingsProps } from './index';

const ICON_TYPE_OPTIONS: { value: SocialIconType; label: string }[] = [
  { value: 'instagram', label: 'Instagram' },
  { value: 'twitter', label: 'Twitter' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'github', label: 'GitHub' },
  { value: 'website', label: 'Website' },
];

const SIZE_OPTIONS: { value: SocialIconsBlockSize; label: string }[] = [
  { value: 'sm', label: '작게' },
  { value: 'md', label: '보통' },
  { value: 'lg', label: '크게' },
];

const STYLE_OPTIONS: { value: SocialIconsBlockStyle; label: string }[] = [
  { value: 'default', label: '기본' },
  { value: 'filled', label: '채움' },
  { value: 'outline', label: '외곽선' },
];

export function SocialIconsBlockSettings({
  block,
  onUpdate,
}: BlockSettingsProps<SocialIconsBlock>) {
  const { config } = block;

  /**
   * config 내 특정 필드 업데이트
   */
  const updateConfig = (updates: Partial<SocialIconsBlock['config']>) => {
    onUpdate({
      config: { ...config, ...updates },
    } as Partial<SocialIconsBlock>);
  };

  /**
   * 아이콘 추가
   */
  const addIcon = () => {
    const newIcon: SocialIconItem = { type: 'instagram', url: '' };
    updateConfig({ icons: [...config.icons, newIcon] });
  };

  /**
   * 아이콘 삭제
   */
  const removeIcon = (index: number) => {
    const newIcons = config.icons.filter((_, i) => i !== index);
    updateConfig({ icons: newIcons });
  };

  /**
   * 아이콘 업데이트
   */
  const updateIcon = (index: number, updates: Partial<SocialIconItem>) => {
    const newIcons = config.icons.map((icon, i) =>
      i === index ? { ...icon, ...updates } : icon
    );
    updateConfig({ icons: newIcons });
  };

  return (
    <div className="space-y-4">
      {/* 아이콘 목록 */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>소셜 아이콘</Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addIcon}
            className="h-7 text-xs"
          >
            <Plus className="mr-1 h-3 w-3" />
            추가
          </Button>
        </div>

        {config.icons.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            아이콘을 추가하세요
          </p>
        ) : (
          <div className="space-y-2">
            {config.icons.map((icon, index) => (
              <div
                key={index}
                className="flex items-center gap-2 rounded-md border border-border bg-muted/30 p-2"
              >
                {/* 아이콘 타입 선택 */}
                <Select
                  value={icon.type}
                  onValueChange={(value: SocialIconType) =>
                    updateIcon(index, { type: value })
                  }
                >
                  <SelectTrigger className="w-[120px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ICON_TYPE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* URL 입력 */}
                <Input
                  type="url"
                  placeholder="URL"
                  value={icon.url}
                  onChange={(e) => updateIcon(index, { url: e.target.value })}
                  className="flex-1"
                />

                {/* 삭제 버튼 */}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeIcon(index)}
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                  <span className="sr-only">삭제</span>
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 크기 */}
      <div className="space-y-2">
        <Label htmlFor="social-size">아이콘 크기</Label>
        <Select
          value={config.size}
          onValueChange={(value: SocialIconsBlockSize) =>
            updateConfig({ size: value })
          }
        >
          <SelectTrigger id="social-size">
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

      {/* 스타일 */}
      <div className="space-y-2">
        <Label htmlFor="social-style">아이콘 스타일</Label>
        <Select
          value={config.style}
          onValueChange={(value: SocialIconsBlockStyle) =>
            updateConfig({ style: value })
          }
        >
          <SelectTrigger id="social-style">
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
      </div>
    </div>
  );
}
