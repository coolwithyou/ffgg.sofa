'use client';

/**
 * 최근 활동 리스트
 * 최근에 대화가 발생한 챗봇 목록을 표시합니다.
 */

import Link from 'next/link';

interface Activity {
  chatbotId: string;
  chatbotName: string;
  tenantName: string;
  conversationCount: number;
  lastActivityAt: Date;
}

interface RecentActivityListProps {
  activities: Activity[];
}

export function RecentActivityList({ activities }: RecentActivityListProps) {
  if (activities.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-6">
        <h2 className="mb-4 text-lg font-semibold text-foreground">최근 활동</h2>
        <div className="flex h-32 items-center justify-center">
          <p className="text-sm text-muted-foreground">최근 활동이 없습니다.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <h2 className="mb-4 text-lg font-semibold text-foreground">최근 활동</h2>

      <div className="space-y-3">
        {activities.map((activity) => (
          <Link
            key={activity.chatbotId}
            href={`/admin/chatbots/${activity.chatbotId}`}
            className="block rounded-lg border border-border p-3 transition-colors hover:bg-muted/50"
          >
            <div className="flex items-start justify-between">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-foreground">{activity.chatbotName}</p>
                <p className="text-sm text-muted-foreground">{activity.tenantName}</p>
              </div>
              <span className="ml-2 shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                {activity.conversationCount}건
              </span>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {formatRelativeTime(activity.lastActivityAt)}
            </p>
          </Link>
        ))}
      </div>
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
