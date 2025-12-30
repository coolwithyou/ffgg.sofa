'use client';

/**
 * 대화 추이 차트
 * 최근 7일간 대화 수와 비용을 바 차트로 표시합니다.
 */

interface DailyConversation {
  date: Date;
  conversationCount: number;
  messageCount: number;
  costUsd: number;
}

interface ConversationTrendProps {
  trend: DailyConversation[];
}

export function ConversationTrend({ trend }: ConversationTrendProps) {
  if (trend.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-6">
        <h2 className="mb-4 text-lg font-semibold text-foreground">대화 추이</h2>
        <div className="flex h-48 items-center justify-center">
          <p className="text-muted-foreground">데이터가 없습니다.</p>
        </div>
      </div>
    );
  }

  const maxConversations = Math.max(...trend.map((d) => d.conversationCount), 1);
  const totalConversations = trend.reduce((sum, d) => sum + d.conversationCount, 0);
  const avgConversations = totalConversations / trend.length;

  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">대화 추이</h2>
        <div className="text-sm text-muted-foreground">
          일 평균 {avgConversations.toFixed(1)}건
        </div>
      </div>

      <div className="space-y-3">
        {trend.map((day, index) => {
          const percentage = (day.conversationCount / maxConversations) * 100;
          const isToday = index === trend.length - 1;
          const date = new Date(day.date);
          const dayName = getDayName(date);

          return (
            <div key={date.toISOString()} className="group">
              <div className="mb-1 flex items-center justify-between">
                <span
                  className={`text-sm ${isToday ? 'font-medium text-foreground' : 'text-muted-foreground'}`}
                >
                  {formatDate(date)} ({dayName})
                  {isToday && (
                    <span className="ml-2 rounded bg-primary/10 px-1.5 py-0.5 text-xs text-primary">
                      오늘
                    </span>
                  )}
                </span>
                <span className="text-sm font-medium text-foreground">
                  {day.conversationCount}건
                </span>
              </div>
              <div className="h-6 w-full overflow-hidden rounded-md bg-muted">
                <div
                  className={`h-full transition-all duration-300 ${
                    isToday ? 'bg-primary' : 'bg-primary/60'
                  }`}
                  style={{ width: `${Math.max(percentage, 2)}%` }}
                />
              </div>
              <div className="mt-1 flex justify-between text-xs text-muted-foreground">
                <span>{day.messageCount}개 메시지</span>
                <span>${day.costUsd.toFixed(3)}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* 요약 */}
      <div className="mt-4 grid grid-cols-3 gap-4 border-t border-border pt-4">
        <div className="text-center">
          <p className="text-lg font-semibold text-foreground">{totalConversations}</p>
          <p className="text-xs text-muted-foreground">총 대화</p>
        </div>
        <div className="text-center">
          <p className="text-lg font-semibold text-foreground">
            {trend.reduce((sum, d) => sum + d.messageCount, 0)}
          </p>
          <p className="text-xs text-muted-foreground">총 메시지</p>
        </div>
        <div className="text-center">
          <p className="text-lg font-semibold text-foreground">
            ${trend.reduce((sum, d) => sum + d.costUsd, 0).toFixed(2)}
          </p>
          <p className="text-xs text-muted-foreground">총 비용</p>
        </div>
      </div>
    </div>
  );
}

function formatDate(date: Date): string {
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function getDayName(date: Date): string {
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  return days[date.getDay()];
}
