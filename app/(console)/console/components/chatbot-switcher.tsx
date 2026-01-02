'use client';

import { useState } from 'react';
import { useCurrentChatbot } from '../hooks/use-console-state';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { Bot, ChevronDown, Check, Plus, Search } from 'lucide-react';

/**
 * ChatbotSwitcher
 *
 * Top Bar에 위치하는 챗봇 선택 드롭다운
 *
 * 기능:
 * - 현재 선택된 챗봇 표시
 * - 드롭다운으로 다른 챗봇 선택
 * - 챗봇 검색 (목록이 많을 경우)
 * - 새 챗봇 생성 버튼
 */
export function ChatbotSwitcher() {
  const { chatbots, currentChatbot, currentChatbotIndex, selectChatbot } =
    useCurrentChatbot();
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredChatbots = chatbots.filter((bot) =>
    bot.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelect = (index: number) => {
    selectChatbot(index);
    setOpen(false);
    setSearchQuery('');
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            'flex items-center gap-2 rounded-lg px-3 py-1.5 transition-colors',
            'hover:bg-muted',
            'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2'
          )}
          aria-label="챗봇 선택"
        >
          {/* 챗봇 아이콘 */}
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10">
            <Bot className="h-3.5 w-3.5 text-primary" />
          </div>

          {/* 챗봇 이름 */}
          <span className="max-w-[160px] truncate text-sm font-medium text-foreground">
            {currentChatbot?.name ?? '챗봇 선택'}
          </span>

          {/* 공개 상태 표시 */}
          {currentChatbot?.publicPageEnabled && (
            <span className="h-2 w-2 rounded-full bg-green-500" />
          )}

          {/* 드롭다운 화살표 */}
          <ChevronDown
            className={cn(
              'h-4 w-4 text-muted-foreground transition-transform',
              open && 'rotate-180'
            )}
          />
        </button>
      </PopoverTrigger>

      <PopoverContent align="start" className="w-64 p-0">
        {/* 검색 입력 */}
        <div className="border-b border-border p-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="챗봇 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-md border-0 bg-muted/50 py-1.5 pl-8 pr-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
        </div>

        {/* 챗봇 목록 */}
        <div className="max-h-64 overflow-y-auto p-1">
          {filteredChatbots.length === 0 ? (
            <div className="px-3 py-6 text-center text-sm text-muted-foreground">
              검색 결과가 없습니다
            </div>
          ) : (
            filteredChatbots.map((bot, index) => {
              const originalIndex = chatbots.findIndex((b) => b.id === bot.id);
              const isSelected = currentChatbotIndex === originalIndex;

              return (
                <button
                  key={bot.id}
                  onClick={() => handleSelect(originalIndex)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors',
                    isSelected
                      ? 'bg-primary/10 text-primary'
                      : 'text-foreground hover:bg-muted'
                  )}
                >
                  {/* 챗봇 아이콘 */}
                  <div
                    className={cn(
                      'flex h-8 w-8 items-center justify-center rounded-lg',
                      isSelected ? 'bg-primary/20' : 'bg-muted'
                    )}
                  >
                    <Bot
                      className={cn(
                        'h-4 w-4',
                        isSelected ? 'text-primary' : 'text-muted-foreground'
                      )}
                    />
                  </div>

                  {/* 챗봇 정보 */}
                  <div className="flex-1 truncate">
                    <p className="truncate font-medium">{bot.name}</p>
                    {bot.slug && (
                      <p className="truncate text-xs text-muted-foreground">
                        /{bot.slug}
                      </p>
                    )}
                  </div>

                  {/* 상태 표시 */}
                  <div className="flex items-center gap-2">
                    {bot.publicPageEnabled && (
                      <span className="h-2 w-2 rounded-full bg-green-500" />
                    )}
                    {isSelected && <Check className="h-4 w-4" />}
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* 새 챗봇 추가 */}
        <div className="border-t border-border p-1">
          <button
            onClick={() => {
              // TODO: 새 챗봇 생성 모달 열기
              setOpen(false);
            }}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Plus className="h-4 w-4" />
            새 챗봇 추가
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
