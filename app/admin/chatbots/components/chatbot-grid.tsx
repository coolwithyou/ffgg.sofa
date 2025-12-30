'use client';

/**
 * 챗봇 그리드
 * 모든 챗봇 목록을 카드 형태로 표시합니다.
 */

import Link from 'next/link';
import type { ChatbotStats } from '../actions';

interface ChatbotGridProps {
  chatbots: ChatbotStats[];
}

export function ChatbotGrid({ chatbots }: ChatbotGridProps) {
  if (chatbots.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-6">
        <h2 className="mb-4 text-lg font-semibold text-foreground">챗봇 목록</h2>
        <div className="flex h-48 items-center justify-center">
          <p className="text-muted-foreground">등록된 챗봇이 없습니다.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">챗봇 목록</h2>
        <span className="text-sm text-muted-foreground">{chatbots.length}개</span>
      </div>

      <div className="space-y-3">
        {chatbots.map((chatbot) => (
          <ChatbotCard key={chatbot.id} chatbot={chatbot} />
        ))}
      </div>
    </div>
  );
}

function ChatbotCard({ chatbot }: { chatbot: ChatbotStats }) {
  const hasActivity = chatbot.weeklyConversations > 0;

  return (
    <Link
      href={`/admin/chatbots/${chatbot.id}`}
      className="block rounded-lg border border-border p-4 transition-colors hover:bg-muted/50"
    >
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate font-medium text-foreground">{chatbot.name}</h3>
            <StatusBadge
              widgetEnabled={chatbot.widgetEnabled}
              kakaoEnabled={chatbot.kakaoEnabled}
            />
          </div>
          <p className="mt-0.5 text-sm text-muted-foreground">{chatbot.tenantName}</p>
          {chatbot.description && (
            <p className="mt-1 truncate text-sm text-muted-foreground">{chatbot.description}</p>
          )}
        </div>
        <ActivityIndicator active={hasActivity} />
      </div>

      <div className="mt-3 grid grid-cols-4 gap-4 text-center">
        <div>
          <p className="text-lg font-semibold text-foreground">
            {chatbot.todayConversations}
          </p>
          <p className="text-xs text-muted-foreground">오늘</p>
        </div>
        <div>
          <p className="text-lg font-semibold text-foreground">
            {chatbot.weeklyConversations}
          </p>
          <p className="text-xs text-muted-foreground">7일</p>
        </div>
        <div>
          <p className="text-lg font-semibold text-foreground">
            {chatbot.totalConversations}
          </p>
          <p className="text-xs text-muted-foreground">전체</p>
        </div>
        <div>
          <p className="text-lg font-semibold text-foreground">
            ${chatbot.totalCostUsd.toFixed(2)}
          </p>
          <p className="text-xs text-muted-foreground">비용</p>
        </div>
      </div>

      {chatbot.lastActivityAt && (
        <p className="mt-2 text-xs text-muted-foreground">
          최근 활동: {formatRelativeTime(chatbot.lastActivityAt)}
        </p>
      )}
    </Link>
  );
}

function StatusBadge({
  widgetEnabled,
  kakaoEnabled,
}: {
  widgetEnabled: boolean;
  kakaoEnabled: boolean;
}) {
  const channels: string[] = [];
  if (widgetEnabled) channels.push('웹');
  if (kakaoEnabled) channels.push('카카오');

  if (channels.length === 0) {
    return (
      <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
        비활성
      </span>
    );
  }

  return (
    <span className="rounded bg-green-500/10 px-1.5 py-0.5 text-xs text-green-500">
      {channels.join(' / ')}
    </span>
  );
}

function ActivityIndicator({ active }: { active: boolean }) {
  return (
    <div className="flex items-center gap-1.5">
      <div
        className={`h-2 w-2 rounded-full ${active ? 'bg-green-500' : 'bg-muted-foreground/40'}`}
      />
      <span className={`text-xs ${active ? 'text-green-500' : 'text-muted-foreground'}`}>
        {active ? '활성' : '비활성'}
      </span>
    </div>
  );
}

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - new Date(date).getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return '방금 전';
  if (diffMins < 60) return `${diffMins}분 전`;
  if (diffHours < 24) return `${diffHours}시간 전`;
  if (diffDays < 7) return `${diffDays}일 전`;

  return new Date(date).toLocaleDateString('ko-KR');
}
