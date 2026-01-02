'use client';

import { usePageConfig } from '../../hooks/use-console-state';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

/**
 * 챗봇 블록 설정 폼
 *
 * - 최소 높이: 채팅 영역 최소 높이 (px)
 * - 최대 높이: 채팅 영역 최대 높이 (px)
 */
export function ChatbotSettings() {
  const { pageConfig, updateChatbotConfig } = usePageConfig();
  const { chatbot } = pageConfig;

  return (
    <div className="space-y-4 pt-2">
      {/* 최소 높이 */}
      <div className="space-y-2">
        <Label htmlFor="chatbot-min-height">최소 높이 (px)</Label>
        <Input
          id="chatbot-min-height"
          type="number"
          min={200}
          max={800}
          step={50}
          value={chatbot.minHeight}
          onChange={(e) =>
            updateChatbotConfig({ minHeight: Number(e.target.value) })
          }
        />
        <p className="text-xs text-muted-foreground">
          채팅 영역의 최소 높이입니다. (기본: 400px)
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
          value={chatbot.maxHeight}
          onChange={(e) =>
            updateChatbotConfig({ maxHeight: Number(e.target.value) })
          }
        />
        <p className="text-xs text-muted-foreground">
          채팅 영역의 최대 높이입니다. (기본: 600px)
        </p>
      </div>

      {/* 높이 범위 안내 */}
      <div className="rounded-md bg-muted/50 p-3">
        <p className="text-xs text-muted-foreground">
          💡 채팅 영역은 설정한 최소/최대 높이 범위 내에서 콘텐츠에 맞게
          자동으로 조절됩니다.
        </p>
      </div>
    </div>
  );
}
