'use client';

/**
 * 채널 상태 카드
 * 웹 위젯과 카카오 채널별 대화 통계를 표시합니다.
 */

interface ChannelStatusProps {
  widgetEnabled: boolean;
  kakaoEnabled: boolean;
  widgetConversations: number;
  kakaoConversations: number;
}

export function ChannelStatus({
  widgetEnabled,
  kakaoEnabled,
  widgetConversations,
  kakaoConversations,
}: ChannelStatusProps) {
  const total = widgetConversations + kakaoConversations;

  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <h2 className="mb-4 text-lg font-semibold text-foreground">채널별 현황</h2>

      <div className="space-y-4">
        {/* 웹 위젯 */}
        <div className="rounded-lg border border-border p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                  widgetEnabled ? 'bg-green-500/10' : 'bg-muted'
                }`}
              >
                <WidgetIcon
                  className={`h-5 w-5 ${widgetEnabled ? 'text-green-500' : 'text-muted-foreground'}`}
                />
              </div>
              <div>
                <p className="font-medium text-foreground">웹 위젯</p>
                <p className="text-sm text-muted-foreground">
                  {widgetEnabled ? '활성화됨' : '비활성화됨'}
                </p>
              </div>
            </div>
            <div
              className={`h-3 w-3 rounded-full ${widgetEnabled ? 'bg-green-500' : 'bg-muted-foreground/40'}`}
            />
          </div>
          <div className="mt-3 flex items-end justify-between">
            <p className="text-2xl font-bold text-foreground">{widgetConversations}</p>
            <p className="text-sm text-muted-foreground">
              {total > 0 ? `${((widgetConversations / total) * 100).toFixed(0)}%` : '0%'}
            </p>
          </div>
          {total > 0 && (
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-green-500"
                style={{ width: `${(widgetConversations / total) * 100}%` }}
              />
            </div>
          )}
        </div>

        {/* 카카오 */}
        <div className="rounded-lg border border-border p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                  kakaoEnabled ? 'bg-yellow-500/10' : 'bg-muted'
                }`}
              >
                <KakaoIcon
                  className={`h-5 w-5 ${kakaoEnabled ? 'text-yellow-500' : 'text-muted-foreground'}`}
                />
              </div>
              <div>
                <p className="font-medium text-foreground">카카오</p>
                <p className="text-sm text-muted-foreground">
                  {kakaoEnabled ? '활성화됨' : '비활성화됨'}
                </p>
              </div>
            </div>
            <div
              className={`h-3 w-3 rounded-full ${kakaoEnabled ? 'bg-yellow-500' : 'bg-muted-foreground/40'}`}
            />
          </div>
          <div className="mt-3 flex items-end justify-between">
            <p className="text-2xl font-bold text-foreground">{kakaoConversations}</p>
            <p className="text-sm text-muted-foreground">
              {total > 0 ? `${((kakaoConversations / total) * 100).toFixed(0)}%` : '0%'}
            </p>
          </div>
          {total > 0 && (
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-yellow-500"
                style={{ width: `${(kakaoConversations / total) * 100}%` }}
              />
            </div>
          )}
        </div>
      </div>

      {/* 전체 요약 */}
      <div className="mt-4 rounded-lg bg-muted p-3 text-center">
        <p className="text-sm text-muted-foreground">전체 대화</p>
        <p className="text-xl font-bold text-foreground">{total.toLocaleString()}건</p>
      </div>
    </div>
  );
}

function WidgetIcon({ className }: { className?: string }) {
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
