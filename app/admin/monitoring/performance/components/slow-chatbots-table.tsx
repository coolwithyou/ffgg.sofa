'use client';

/**
 * 느린 챗봇 목록 컴포넌트
 * 응답 시간이 느린 챗봇들을 정렬하여 표시합니다.
 */

interface SlowChatbot {
  chatbotId: string;
  chatbotName: string | null;
  tenantName: string;
  avgMs: number;
  p95Ms: number;
  requestCount: number;
}

interface SlowChatbotsTableProps {
  chatbots: SlowChatbot[];
}

export function SlowChatbotsTable({ chatbots }: SlowChatbotsTableProps) {
  const formatMs = (ms: number) => {
    if (ms >= 1000) {
      return `${(ms / 1000).toFixed(1)}s`;
    }
    return `${Math.round(ms)}ms`;
  };

  const getStatusBadge = (p95Ms: number) => {
    if (p95Ms < 2000) {
      return (
        <span className="rounded-full bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-500">
          양호
        </span>
      );
    }
    if (p95Ms < 3000) {
      return (
        <span className="rounded-full bg-yellow-500/10 px-2 py-0.5 text-xs font-medium text-yellow-500">
          주의
        </span>
      );
    }
    return (
      <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
        느림
      </span>
    );
  };

  if (chatbots.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-6">
        <h2 className="mb-4 text-lg font-semibold text-foreground">챗봇별 성능</h2>
        <div className="flex h-32 items-center justify-center">
          <p className="text-muted-foreground">데이터가 없습니다.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="border-b border-border p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">챗봇별 성능</h2>
          <span className="text-sm text-muted-foreground">
            P95 기준 정렬 (느린 순)
          </span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                챗봇
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                테넌트
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                평균
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                P95
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
                요청 수
              </th>
              <th className="px-6 py-3 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground">
                상태
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {chatbots.map((chatbot, idx) => (
              <tr key={chatbot.chatbotId} className="hover:bg-muted/30">
                <td className="whitespace-nowrap px-6 py-4">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
                      {idx + 1}
                    </span>
                    <span className="font-medium text-foreground">
                      {chatbot.chatbotName || '이름 없음'}
                    </span>
                  </div>
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-sm text-muted-foreground">
                  {chatbot.tenantName}
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-medium text-foreground">
                  {formatMs(chatbot.avgMs)}
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-right">
                  <span className={`text-sm font-bold ${chatbot.p95Ms >= 3000 ? 'text-destructive' : 'text-foreground'}`}>
                    {formatMs(chatbot.p95Ms)}
                  </span>
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-right text-sm text-muted-foreground">
                  {chatbot.requestCount.toLocaleString()}
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-center">
                  {getStatusBadge(chatbot.p95Ms)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
