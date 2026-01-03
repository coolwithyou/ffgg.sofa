'use client';

/**
 * 링크 블록 설정 컴포넌트
 *
 * LinkBlock의 설정을 편집합니다:
 * - URL: 링크 주소
 * - 제목: 링크 버튼에 표시할 텍스트
 * - 설명: 부가 설명 (선택)
 * - 썸네일: 이미지 URL (선택)
 * - 스타일: default, featured, outline
 * - 새 탭에서 열기: 체크박스
 */

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { LinkBlock, LinkBlockStyle } from '@/lib/public-page/block-types';
import type { BlockSettingsProps } from './index';

const STYLE_OPTIONS: { value: LinkBlockStyle; label: string }[] = [
  { value: 'default', label: '기본' },
  { value: 'featured', label: '강조' },
  { value: 'outline', label: '외곽선' },
];

export function LinkBlockSettings({
  block,
  onUpdate,
}: BlockSettingsProps<LinkBlock>) {
  const { config } = block;

  /**
   * config 내 특정 필드 업데이트
   */
  const updateConfig = (updates: Partial<LinkBlock['config']>) => {
    onUpdate({
      config: { ...config, ...updates },
    } as Partial<LinkBlock>);
  };

  return (
    <div className="space-y-4">
      {/* URL */}
      <div className="space-y-2">
        <Label htmlFor="link-url">URL</Label>
        <Input
          id="link-url"
          type="url"
          placeholder="https://example.com"
          value={config.url}
          onChange={(e) => updateConfig({ url: e.target.value })}
        />
      </div>

      {/* 제목 */}
      <div className="space-y-2">
        <Label htmlFor="link-title">제목</Label>
        <Input
          id="link-title"
          placeholder="링크 제목"
          value={config.title}
          onChange={(e) => updateConfig({ title: e.target.value })}
        />
      </div>

      {/* 설명 */}
      <div className="space-y-2">
        <Label htmlFor="link-description">설명 (선택)</Label>
        <Textarea
          id="link-description"
          placeholder="링크에 대한 부가 설명"
          value={config.description ?? ''}
          onChange={(e) => updateConfig({ description: e.target.value })}
          rows={2}
        />
      </div>

      {/* 썸네일 */}
      <div className="space-y-2">
        <Label htmlFor="link-thumbnail">썸네일 URL (선택)</Label>
        <Input
          id="link-thumbnail"
          type="url"
          placeholder="https://example.com/image.jpg"
          value={config.thumbnail ?? ''}
          onChange={(e) => updateConfig({ thumbnail: e.target.value })}
        />
        <p className="text-xs text-muted-foreground">
          링크 왼쪽에 표시될 이미지 URL입니다.
        </p>
      </div>

      {/* 스타일 */}
      <div className="space-y-2">
        <Label htmlFor="link-style">스타일</Label>
        <Select
          value={config.style}
          onValueChange={(value: LinkBlockStyle) =>
            updateConfig({ style: value })
          }
        >
          <SelectTrigger id="link-style">
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

      {/* 새 탭에서 열기 */}
      <div className="flex items-center justify-between">
        <Label htmlFor="link-new-tab" className="cursor-pointer">
          새 탭에서 열기
        </Label>
        <Switch
          id="link-new-tab"
          checked={config.openInNewTab}
          onCheckedChange={(checked) => updateConfig({ openInNewTab: checked })}
        />
      </div>
    </div>
  );
}
