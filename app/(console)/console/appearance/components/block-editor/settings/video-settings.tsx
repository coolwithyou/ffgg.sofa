'use client';

/**
 * 비디오 블록 설정 컴포넌트
 *
 * VideoBlock의 설정을 편집합니다:
 * - 제공자: YouTube, Vimeo
 * - 비디오 ID
 * - 자동 재생 옵션
 * - 컨트롤 표시 옵션
 */

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { VideoBlock, VideoProvider } from '@/lib/public-page/block-types';
import type { BlockSettingsProps } from './index';

const PROVIDER_OPTIONS: { value: VideoProvider; label: string }[] = [
  { value: 'youtube', label: 'YouTube' },
  { value: 'vimeo', label: 'Vimeo' },
];

export function VideoBlockSettings({
  block,
  onUpdate,
}: BlockSettingsProps<VideoBlock>) {
  const { config } = block;

  /**
   * config 내 특정 필드 업데이트
   */
  const updateConfig = (updates: Partial<VideoBlock['config']>) => {
    onUpdate({
      config: { ...config, ...updates },
    } as Partial<VideoBlock>);
  };

  return (
    <div className="space-y-4">
      {/* 제공자 선택 */}
      <div className="space-y-2">
        <Label htmlFor="video-provider">플랫폼</Label>
        <Select
          value={config.provider}
          onValueChange={(value: VideoProvider) =>
            updateConfig({ provider: value })
          }
        >
          <SelectTrigger id="video-provider">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PROVIDER_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* 비디오 ID */}
      <div className="space-y-2">
        <Label htmlFor="video-id">비디오 ID</Label>
        <Input
          id="video-id"
          placeholder={
            config.provider === 'youtube'
              ? 'dQw4w9WgXcQ'
              : '12345678'
          }
          value={config.videoId}
          onChange={(e) => updateConfig({ videoId: e.target.value })}
        />
        <p className="text-xs text-muted-foreground">
          {config.provider === 'youtube'
            ? 'YouTube URL에서 v= 다음에 오는 문자열입니다. (예: youtube.com/watch?v=dQw4w9WgXcQ)'
            : 'Vimeo URL의 마지막 숫자입니다. (예: vimeo.com/12345678)'}
        </p>
      </div>

      {/* 자동 재생 */}
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label htmlFor="video-autoplay" className="cursor-pointer">
            자동 재생
          </Label>
          <p className="text-xs text-muted-foreground">
            브라우저 정책에 따라 음소거 상태로 재생될 수 있습니다.
          </p>
        </div>
        <Switch
          id="video-autoplay"
          checked={config.autoPlay}
          onCheckedChange={(checked) => updateConfig({ autoPlay: checked })}
        />
      </div>

      {/* 컨트롤 표시 */}
      <div className="flex items-center justify-between">
        <Label htmlFor="video-controls" className="cursor-pointer">
          컨트롤 표시
        </Label>
        <Switch
          id="video-controls"
          checked={config.showControls}
          onCheckedChange={(checked) => updateConfig({ showControls: checked })}
        />
      </div>
    </div>
  );
}
