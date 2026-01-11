// app/(console)/console/chatbot/blog/validation/page.tsx

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useCurrentChatbot } from '../../../hooks/use-console-state';
import { NoChatbotState } from '../../../components/no-chatbot-state';
import { ValidationList } from '../_components/validation-list';
import { getValidationSessions, type ValidationSessionWithDocument } from './actions';
import { RefreshCw, FileCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function ValidationPage() {
  const { currentChatbot } = useCurrentChatbot();
  const [sessions, setSessions] = useState<ValidationSessionWithDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadSessions = useCallback(async () => {
    if (!currentChatbot?.id) return;
    setIsLoading(true);
    try {
      const data = await getValidationSessions(currentChatbot.id);
      setSessions(data);
    } finally {
      setIsLoading(false);
    }
  }, [currentChatbot?.id]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  if (!currentChatbot) {
    return <NoChatbotState title="챗봇을 선택하세요" />;
  }

  const pendingCount = sessions.filter(
    (s) => s.status === 'ready_for_review' || s.status === 'reviewing'
  ).length;

  return (
    <div className="flex h-full flex-col">
      {/* 헤더 */}
      <header className="flex items-center justify-between border-b border-border px-6 py-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground">문서 검증</h1>
          <p className="text-sm text-muted-foreground">
            AI가 재구성한 문서를 검토하고 승인합니다
          </p>
        </div>
        <div className="flex items-center gap-4">
          {pendingCount > 0 && (
            <span className="rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
              {pendingCount}건 검토 대기
            </span>
          )}
          <Button variant="outline" size="sm" onClick={loadSessions} disabled={isLoading}>
            <RefreshCw className={`mr-1 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            새로고침
          </Button>
        </div>
      </header>

      {/* 목록 */}
      <div className="flex-1 overflow-auto p-6">
        {isLoading ? (
          <div className="flex h-40 items-center justify-center">
            <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : sessions.length === 0 ? (
          <EmptyState />
        ) : (
          <ValidationList sessions={sessions} onRefresh={loadSessions} />
        )}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted">
        <FileCheck className="h-10 w-10 text-muted-foreground" />
      </div>
      <div className="text-center">
        <h3 className="text-lg font-semibold text-foreground">
          검증 대기 중인 문서가 없습니다
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          문서를 업로드하면 AI가 자동으로 분석을 시작합니다
        </p>
      </div>
    </div>
  );
}
