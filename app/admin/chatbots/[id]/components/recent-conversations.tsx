'use client';

/**
 * 최근 대화 목록
 * 해당 챗봇의 최근 대화 내역을 표시합니다.
 */

import Link from 'next/link';

interface Conversation {
  id: string;
  channel: 'widget' | 'kakao';
  messageCount: number;
  createdAt: Date;
  lastMessageAt: Date;
}

interface RecentConversationsProps {
  conversations: Conversation[];
  chatbotId: string;
}

export function RecentConversations({ conversations, chatbotId }: RecentConversationsProps) {
  if (conversations.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-6">
        <h2 className="mb-4 text-lg font-semibold text-foreground">최근 대화</h2>
        <div className="flex h-32 items-center justify-center">
          <p className="text-muted-foreground">최근 대화가 없습니다.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">최근 대화</h2>
        <span className="text-sm text-muted-foreground">{conversations.length}건</span>
      </div>

      <div className="overflow-hidden rounded-lg border border-border">
        <table className="min-w-full divide-y divide-border">
          <thead className="bg-muted">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                채널
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                메시지 수
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                시작 시간
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                마지막 활동
              </th>
              <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">
                상세
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border bg-card">
            {conversations.map((conversation) => (
              <tr key={conversation.id} className="hover:bg-muted/50">
                <td className="px-4 py-3">
                  <ChannelBadge channel={conversation.channel} />
                </td>
                <td className="px-4 py-3">
                  <span className="font-medium text-foreground">
                    {conversation.messageCount}
                  </span>
                  <span className="text-muted-foreground">개</span>
                </td>
                <td className="px-4 py-3 text-sm text-muted-foreground">
                  {formatDateTime(conversation.createdAt)}
                </td>
                <td className="px-4 py-3 text-sm text-muted-foreground">
                  {formatRelativeTime(conversation.lastMessageAt)}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/admin/chatbots/${chatbotId}/conversations/${conversation.id}`}
                    className="text-sm text-primary hover:underline"
                  >
                    보기
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ChannelBadge({ channel }: { channel: 'widget' | 'kakao' }) {
  if (channel === 'widget') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-green-500/10 px-2.5 py-1 text-xs font-medium text-green-500">
        <GlobeIcon className="h-3 w-3" />
        웹
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-yellow-500/10 px-2.5 py-1 text-xs font-medium text-yellow-500">
      <KakaoIcon className="h-3 w-3" />
      카카오
    </span>
  );
}

function formatDateTime(date: Date): string {
  const d = new Date(date);
  return d.toLocaleString('ko-KR', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
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

function GlobeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"
      />
    </svg>
  );
}

function KakaoIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 3c-5.2 0-9.4 3.5-9.4 7.8 0 2.8 1.8 5.2 4.5 6.6-.2.7-.7 2.5-.8 2.9-.1.5.2.5.4.3.2-.1 2.8-1.9 3.9-2.7.4.1.9.1 1.4.1 5.2 0 9.4-3.5 9.4-7.8S17.2 3 12 3z" />
    </svg>
  );
}
