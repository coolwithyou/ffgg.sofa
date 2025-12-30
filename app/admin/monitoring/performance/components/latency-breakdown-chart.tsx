'use client';

/**
 * 단계별 지연 분석 차트 컴포넌트
 * 응답 시간을 LLM, 검색, 쿼리 재작성 등 단계별로 분석합니다.
 */

interface BreakdownData {
  llmAvgMs: number;
  searchAvgMs: number;
  rewriteAvgMs: number;
  otherAvgMs: number;
}

interface LatencyBreakdownChartProps {
  breakdown: BreakdownData;
}

export function LatencyBreakdownChart({ breakdown }: LatencyBreakdownChartProps) {
  const total = breakdown.llmAvgMs + breakdown.searchAvgMs + breakdown.rewriteAvgMs + breakdown.otherAvgMs;

  const segments = [
    {
      label: 'LLM 생성',
      value: breakdown.llmAvgMs,
      color: 'bg-primary',
      description: 'AI 응답 생성 시간',
    },
    {
      label: '벡터 검색',
      value: breakdown.searchAvgMs,
      color: 'bg-purple-500',
      description: 'RAG 검색 소요 시간',
    },
    {
      label: '쿼리 재작성',
      value: breakdown.rewriteAvgMs,
      color: 'bg-yellow-500',
      description: '대화 맥락 반영 시간',
    },
    {
      label: '기타',
      value: breakdown.otherAvgMs,
      color: 'bg-muted-foreground',
      description: 'DB, 캐시, 네트워크 등',
    },
  ];

  const formatMs = (ms: number) => {
    if (ms >= 1000) {
      return `${(ms / 1000).toFixed(1)}s`;
    }
    return `${Math.round(ms)}ms`;
  };

  if (total === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-6">
        <h2 className="mb-4 text-lg font-semibold text-foreground">단계별 지연 분석</h2>
        <div className="flex h-64 items-center justify-center">
          <p className="text-muted-foreground">데이터가 없습니다.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <h2 className="mb-4 text-lg font-semibold text-foreground">단계별 지연 분석</h2>

      {/* 스택 바 차트 */}
      <div className="mb-6">
        <div className="flex h-8 overflow-hidden rounded-lg">
          {segments.map((segment) => (
            <div
              key={segment.label}
              className={`${segment.color} flex items-center justify-center text-xs font-medium text-white transition-all`}
              style={{ width: `${(segment.value / total) * 100}%` }}
            >
              {segment.value / total > 0.1 && (
                <span>{((segment.value / total) * 100).toFixed(0)}%</span>
              )}
            </div>
          ))}
        </div>
        <div className="mt-2 text-right text-xs text-muted-foreground">
          총 평균: {formatMs(total)}
        </div>
      </div>

      {/* 상세 목록 */}
      <div className="space-y-3">
        {segments.map((segment) => (
          <div key={segment.label} className="flex items-center gap-3">
            <div className={`h-3 w-3 rounded ${segment.color}`} />
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-foreground">{segment.label}</span>
                <span className="text-sm font-semibold text-foreground">{formatMs(segment.value)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{segment.description}</span>
                <span className="text-xs text-muted-foreground">
                  {((segment.value / total) * 100).toFixed(1)}%
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 인사이트 */}
      <div className="mt-6 rounded-md bg-muted/50 p-3">
        <p className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground">💡 인사이트: </span>
          {breakdown.llmAvgMs > breakdown.searchAvgMs * 2
            ? 'LLM 생성이 주요 병목입니다. 토큰 수를 줄이거나 더 빠른 모델을 고려해보세요.'
            : breakdown.searchAvgMs > breakdown.llmAvgMs
            ? '검색 단계가 느립니다. 인덱스 최적화나 청크 수 조정을 검토하세요.'
            : '응답 시간이 잘 분산되어 있습니다.'}
        </p>
      </div>
    </div>
  );
}
