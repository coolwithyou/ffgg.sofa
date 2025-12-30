'use client';

/**
 * 챗봇 선택 사이드 패널
 * 테스트할 챗봇을 선택하는 카드 목록 UI
 */

import { Bot, Star, Database, AlertTriangle } from 'lucide-react';
import type { TestableChatbot } from './actions';

interface ChatbotSelectorProps {
  chatbots: TestableChatbot[];
  selectedId: string | null;
  onSelect: (chatbot: TestableChatbot) => void;
  isLoading?: boolean;
}

export function ChatbotSelector({
  chatbots,
  selectedId,
  onSelect,
  isLoading = false,
}: ChatbotSelectorProps) {
  if (isLoading) {
    return (
      <div className="flex h-full w-72 flex-col border-r border-border bg-card">
        <div className="border-b border-border p-4">
          <h2 className="font-semibold text-foreground">내 챗봇 목록</h2>
        </div>
        <div className="flex-1 space-y-3 p-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-24 animate-pulse rounded-lg border border-border bg-muted"
            />
          ))}
        </div>
      </div>
    );
  }

  if (chatbots.length === 0) {
    return (
      <div className="flex h-full w-72 flex-col border-r border-border bg-card">
        <div className="border-b border-border p-4">
          <h2 className="font-semibold text-foreground">내 챗봇 목록</h2>
        </div>
        <div className="flex flex-1 flex-col items-center justify-center p-6 text-center">
          <Bot className="mb-3 h-12 w-12 text-muted-foreground" />
          <p className="mb-2 font-medium text-foreground">챗봇이 없습니다</p>
          <p className="text-sm text-muted-foreground">
            챗봇 관리에서 먼저 챗봇을 생성해주세요.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full w-72 flex-col border-r border-border bg-card">
      <div className="border-b border-border p-4">
        <h2 className="font-semibold text-foreground">내 챗봇 목록</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          테스트할 챗봇을 선택하세요
        </p>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto p-3">
        {chatbots.map((chatbot) => {
          const isSelected = selectedId === chatbot.id;
          const hasNoDatasets = chatbot.datasetCount === 0;

          return (
            <button
              key={chatbot.id}
              onClick={() => onSelect(chatbot)}
              className={`w-full rounded-lg border p-3 text-left transition-all ${
                isSelected
                  ? 'border-primary bg-primary/5 ring-1 ring-primary'
                  : 'border-border bg-background hover:border-primary/50 hover:bg-muted/50'
              }`}
            >
              <div className="flex items-start gap-3">
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                    isSelected ? 'bg-primary/10' : 'bg-muted'
                  }`}
                >
                  <Bot
                    className={`h-5 w-5 ${
                      isSelected ? 'text-primary' : 'text-muted-foreground'
                    }`}
                  />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`truncate font-medium ${
                        isSelected ? 'text-primary' : 'text-foreground'
                      }`}
                    >
                      {chatbot.name}
                    </span>
                    {chatbot.isDefault && (
                      <Star className="h-3.5 w-3.5 shrink-0 fill-yellow-500 text-yellow-500" />
                    )}
                  </div>

                  <div className="mt-1 flex items-center gap-1.5 text-xs">
                    {hasNoDatasets ? (
                      <span className="flex items-center gap-1 text-yellow-500">
                        <AlertTriangle className="h-3 w-3" />
                        데이터셋 없음
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <Database className="h-3 w-3" />
                        {chatbot.datasetCount}개 데이터셋
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
