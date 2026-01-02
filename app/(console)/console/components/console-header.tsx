'use client';

import Link from 'next/link';
import { useSaveStatus, useCurrentChatbot } from '../hooks/use-console-state';
import { Check, Loader2, AlertCircle, ExternalLink } from 'lucide-react';

export function ConsoleHeader() {
  const { saveStatus } = useSaveStatus();
  const { currentChatbot } = useCurrentChatbot();

  // 저장 상태 표시
  const renderSaveStatus = () => {
    switch (saveStatus) {
      case 'saved':
        return (
          <span className="flex items-center gap-1 text-sm text-green-500">
            <Check className="h-4 w-4" />
            저장됨
          </span>
        );
      case 'saving':
        return (
          <span className="flex items-center gap-1 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            저장 중...
          </span>
        );
      case 'unsaved':
        return (
          <span className="flex items-center gap-1 text-sm text-yellow-500">
            <AlertCircle className="h-4 w-4" />
            저장되지 않음
          </span>
        );
      case 'error':
        return (
          <span className="flex items-center gap-1 text-sm text-destructive">
            <AlertCircle className="h-4 w-4" />
            저장 실패
          </span>
        );
    }
  };

  return (
    <header className="flex h-14 items-center justify-between border-b border-border bg-card px-4">
      {/* 좌측: 로고 */}
      <div className="flex items-center gap-4">
        <Link href="/" className="text-xl font-bold text-primary">
          SOFA
        </Link>
        <span className="text-sm text-muted-foreground">Console Editor</span>
      </div>

      {/* 중앙: 저장 상태 */}
      <div className="flex items-center gap-4">
        {renderSaveStatus()}
      </div>

      {/* 우측: 액션 버튼 */}
      <div className="flex items-center gap-2">
        {currentChatbot?.slug && currentChatbot.publicPageEnabled && (
          <a
            href={`/${currentChatbot.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted"
          >
            <ExternalLink className="h-4 w-4" />
            미리보기
          </a>
        )}
        <button
          className="inline-flex items-center rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          disabled={saveStatus === 'saving'}
        >
          발행하기
        </button>
      </div>
    </header>
  );
}
