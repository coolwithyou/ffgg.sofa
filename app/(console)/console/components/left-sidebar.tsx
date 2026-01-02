'use client';

import { useConsoleMode, useCurrentChatbot } from '../hooks/use-console-state';
import { cn } from '@/lib/utils';
import { FileText, MessageSquare, Plus } from 'lucide-react';

export function LeftSidebar() {
  const { mode, setMode } = useConsoleMode();
  const { chatbots, currentChatbotIndex, selectChatbot } = useCurrentChatbot();

  return (
    <aside className="flex w-64 flex-col border-r border-border bg-card">
      {/* 모드 탭 */}
      <div className="flex border-b border-border">
        <button
          onClick={() => setMode('page')}
          className={cn(
            'flex flex-1 items-center justify-center gap-2 py-3 text-sm font-medium transition-colors',
            mode === 'page'
              ? 'border-b-2 border-primary text-primary'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <FileText className="h-4 w-4" />
          Page
        </button>
        <button
          onClick={() => setMode('widget')}
          className={cn(
            'flex flex-1 items-center justify-center gap-2 py-3 text-sm font-medium transition-colors',
            mode === 'widget'
              ? 'border-b-2 border-primary text-primary'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <MessageSquare className="h-4 w-4" />
          Widget
        </button>
      </div>

      {/* 챗봇 목록 */}
      <div className="flex-1 overflow-y-auto p-3">
        <h3 className="mb-2 text-xs font-medium uppercase text-muted-foreground">
          내 챗봇
        </h3>
        <div className="space-y-1">
          {chatbots.map((bot, index) => (
            <button
              key={bot.id}
              onClick={() => selectChatbot(index)}
              className={cn(
                'flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors',
                currentChatbotIndex === index
                  ? 'bg-primary/10 text-primary'
                  : 'text-foreground hover:bg-muted'
              )}
            >
              <span className="truncate">{bot.name}</span>
              {bot.publicPageEnabled && (
                <span className="ml-auto h-2 w-2 rounded-full bg-green-500" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* 새 챗봇 추가 버튼 */}
      <div className="border-t border-border p-3">
        <button className="flex w-full items-center justify-center gap-2 rounded-md border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-muted">
          <Plus className="h-4 w-4" />
          새 챗봇 추가
        </button>
      </div>
    </aside>
  );
}
