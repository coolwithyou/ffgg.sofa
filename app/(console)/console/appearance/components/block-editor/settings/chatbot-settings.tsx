'use client';

/**
 * 챗봇 블록 설정 컴포넌트
 *
 * ChatbotBlock의 설정을 편집합니다:
 * - 최소 높이: 채팅 영역의 최소 높이 (px)
 * - 최대 높이: 채팅 영역의 최대 높이 (px)
 */

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { ChatbotBlock } from '@/lib/public-page/block-types';
import type { BlockSettingsProps } from './index';

export function ChatbotBlockSettings({
  block,
  onUpdate,
}: BlockSettingsProps<ChatbotBlock>) {
  const { config } = block;

  /**
   * config 내 특정 필드 업데이트
   */
  const updateConfig = (updates: Partial<ChatbotBlock['config']>) => {
    onUpdate({
      config: { ...config, ...updates },
    } as Partial<ChatbotBlock>);
  };

  return (
    <div className="space-y-4">
      {/* 최소 높이 */}
      <div className="space-y-2">
        <Label htmlFor="chatbot-min-height">최소 높이 (px)</Label>
        <Input
          id="chatbot-min-height"
          type="number"
          min={200}
          max={800}
          step={50}
          value={config.minHeight}
          onChange={(e) =>
            updateConfig({ minHeight: parseInt(e.target.value, 10) || 300 })
          }
        />
        <p className="text-xs text-muted-foreground">
          채팅 영역의 최소 높이입니다. (200-800px)
        </p>
      </div>

      {/* 최대 높이 */}
      <div className="space-y-2">
        <Label htmlFor="chatbot-max-height">최대 높이 (px)</Label>
        <Input
          id="chatbot-max-height"
          type="number"
          min={300}
          max={1200}
          step={50}
          value={config.maxHeight}
          onChange={(e) =>
            updateConfig({ maxHeight: parseInt(e.target.value, 10) || 600 })
          }
        />
        <p className="text-xs text-muted-foreground">
          채팅 영역의 최대 높이입니다. (300-1200px)
        </p>
      </div>

      {/* 높이 미리보기 */}
      <div className="rounded-lg border border-border bg-muted/50 p-3">
        <p className="text-xs font-medium text-muted-foreground mb-2">
          높이 미리보기
        </p>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-foreground">{config.minHeight}px</span>
          <span className="text-muted-foreground">~</span>
          <span className="text-foreground">{config.maxHeight}px</span>
        </div>
      </div>
    </div>
  );
}
