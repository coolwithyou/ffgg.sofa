'use client';

import { useCurrentChatbot } from '../../hooks/use-console-state';
import { cn } from '@/lib/utils';
import { Plus } from 'lucide-react';
import { SecondaryPanelSection } from './secondary-panel';

/**
 * 챗봇 선택기 (Secondary Panel용)
 *
 * Appearance 메뉴에서 챗봇 목록을 표시하고 선택할 수 있게 함
 */
export function ChatbotSelector() {
  const { chatbots, currentChatbotIndex, selectChatbot } = useCurrentChatbot();

  return (
    <>
      <SecondaryPanelSection title="내 챗봇">
        <div className="space-y-1">
          {chatbots.map((bot, index) => (
            <button
              key={bot.id}
              onClick={() => selectChatbot(index)}
              className={cn(
                'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors',
                currentChatbotIndex === index
                  ? 'bg-primary/10 font-medium text-primary'
                  : 'text-foreground hover:bg-muted'
              )}
            >
              <span className="truncate">{bot.name}</span>
              {bot.publicPageEnabled && (
                <span className="ml-auto h-2 w-2 shrink-0 rounded-full bg-green-500" />
              )}
            </button>
          ))}
        </div>
      </SecondaryPanelSection>

      {/* 새 챗봇 추가 버튼 */}
      <div className="mt-auto border-t border-border p-3">
        <button className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:border-foreground hover:text-foreground">
          <Plus className="h-4 w-4" />
          새 챗봇 추가
        </button>
      </div>
    </>
  );
}
