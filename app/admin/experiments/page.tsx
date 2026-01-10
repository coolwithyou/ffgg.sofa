'use server';

/**
 * 관리자 A/B 테스트 실험 대시보드
 *
 * 모든 챗봇의 A/B 테스트 현황과 품질 메트릭을 한눈에 확인합니다.
 *
 * @see docs/testplans/phase5-ab-test-quality-validation.md
 */

import {
  getExperimentChatbots,
  getExperimentSummary,
  getChatbotExperimentMetrics,
  type ExperimentChatbot,
  type ExperimentSummary,
  type ChatbotExperimentMetrics,
} from './actions';

export default async function AdminExperimentsPage() {
  // 병렬로 데이터 조회
  const [chatbots, summary, metrics] = await Promise.all([
    getExperimentChatbots(),
    getExperimentSummary(),
    getChatbotExperimentMetrics(),
  ]);

  return (
    <div className="space-y-8 p-6">
      {/* 페이지 헤더 */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          A/B 테스트 실험 관리
        </h1>
        <p className="mt-1 text-muted-foreground">
          모든 챗봇의 A/B 테스트 현황과 품질 메트릭을 확인합니다
        </p>
      </div>

      {/* 요약 통계 */}
      <SummaryCards summary={summary} />

      {/* 실험 진행 중인 챗봇 목록 */}
      <section>
        <h2 className="mb-4 text-lg font-semibold text-foreground">
          실험 진행 중인 챗봇 ({chatbots.length}개)
        </h2>
        {chatbots.length === 0 ? (
          <EmptyState message="현재 A/B 테스트가 진행 중인 챗봇이 없습니다" />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {chatbots.map((chatbot) => (
              <ChatbotCard key={chatbot.id} chatbot={chatbot} />
            ))}
          </div>
        )}
      </section>

      {/* 품질 메트릭 테이블 */}
      <section>
        <h2 className="mb-4 text-lg font-semibold text-foreground">
          챗봇별 품질 비교
        </h2>
        {metrics.length === 0 ? (
          <EmptyState message="품질 데이터가 아직 없습니다" />
        ) : (
          <MetricsTable metrics={metrics} />
        )}
      </section>
    </div>
  );
}

/**
 * 요약 통계 카드
 */
function SummaryCards({ summary }: { summary: ExperimentSummary }) {
  const cards = [
    {
      label: '전체 챗봇',
      value: summary.totalChatbots,
      suffix: '개',
      color: 'text-foreground',
    },
    {
      label: '실험 진행 중',
      value: summary.activeExperiments,
      suffix: '개',
      color: 'text-primary',
    },
    {
      label: '실험 청크',
      value: summary.totalChunksInExperiments,
      suffix: '개',
      color: 'text-foreground',
    },
    {
      label: '대조군 청크',
      value: summary.controlChunks,
      suffix: '개',
      color: 'text-blue-500',
    },
    {
      label: '처리군 청크',
      value: summary.treatmentChunks,
      suffix: '개',
      color: 'text-purple-500',
    },
    {
      label: '평균 품질 차이',
      value: summary.avgQualityDelta ?? '-',
      suffix: summary.avgQualityDelta !== null ? '점' : '',
      color:
        summary.avgQualityDelta !== null && summary.avgQualityDelta > 0
          ? 'text-green-500'
          : summary.avgQualityDelta !== null && summary.avgQualityDelta < 0
            ? 'text-destructive'
            : 'text-muted-foreground',
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
      {cards.map((card, idx) => (
        <div
          key={idx}
          className="rounded-xl border border-border bg-card p-4"
        >
          <p className="text-xs text-muted-foreground">{card.label}</p>
          <p className={`mt-1 text-2xl font-bold ${card.color}`}>
            {card.value}
            <span className="ml-0.5 text-sm font-normal text-muted-foreground">
              {card.suffix}
            </span>
          </p>
        </div>
      ))}
    </div>
  );
}

/**
 * 챗봇 카드
 */
function ChatbotCard({ chatbot }: { chatbot: ExperimentChatbot }) {
  const config = chatbot.experimentConfig;

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-medium text-foreground">{chatbot.name}</h3>
          {chatbot.tenantName && (
            <p className="text-xs text-muted-foreground">{chatbot.tenantName}</p>
          )}
        </div>
        <span
          className={`rounded-full px-2 py-0.5 text-xs ${
            chatbot.status === 'active'
              ? 'bg-green-500/10 text-green-500'
              : 'bg-muted text-muted-foreground'
          }`}
        >
          {chatbot.status === 'active' ? '활성' : '비활성'}
        </span>
      </div>

      {config && (
        <div className="mt-4 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Semantic 비율</span>
            <span className="font-medium text-foreground">
              {config.semanticTrafficPercent ?? 50}%
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">청킹 전략</span>
            <span className="font-medium text-foreground">
              {getStrategyLabel(config.chunkingStrategy ?? 'smart')}
            </span>
          </div>
          {config.experimentStartedAt && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">시작일</span>
              <span className="font-medium text-foreground">
                {new Date(config.experimentStartedAt).toLocaleDateString('ko-KR')}
              </span>
            </div>
          )}
        </div>
      )}

      <p className="mt-4 text-xs text-muted-foreground">
        마지막 수정: {chatbot.updatedAt.toLocaleDateString('ko-KR')}
      </p>
    </div>
  );
}

/**
 * 품질 메트릭 테이블
 */
function MetricsTable({ metrics }: { metrics: ChatbotExperimentMetrics[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="min-w-full divide-y divide-border">
        <thead className="bg-muted">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground">
              챗봇
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">
              대조군 청크
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">
              처리군 청크
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">
              대조군 품질
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">
              처리군 품질
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">
              품질 차이
            </th>
            <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground">
              유의미
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border bg-card">
          {metrics.map((metric) => (
            <tr key={metric.chatbotId} className="hover:bg-muted/50">
              <td className="px-4 py-3">
                <div>
                  <p className="font-medium text-foreground">{metric.chatbotName}</p>
                  {metric.tenantName && (
                    <p className="text-xs text-muted-foreground">{metric.tenantName}</p>
                  )}
                </div>
              </td>
              <td className="px-4 py-3 text-right text-sm text-foreground">
                {metric.controlChunks.toLocaleString()}
              </td>
              <td className="px-4 py-3 text-right text-sm text-foreground">
                {metric.treatmentChunks.toLocaleString()}
              </td>
              <td className="px-4 py-3 text-right text-sm text-blue-500">
                {metric.controlAvgQuality}점
              </td>
              <td className="px-4 py-3 text-right text-sm text-purple-500">
                {metric.treatmentAvgQuality}점
              </td>
              <td className="px-4 py-3 text-right">
                <span
                  className={`text-sm font-medium ${
                    metric.qualityDelta > 0
                      ? 'text-green-500'
                      : metric.qualityDelta < 0
                        ? 'text-destructive'
                        : 'text-muted-foreground'
                  }`}
                >
                  {metric.qualityDelta > 0 ? '+' : ''}
                  {metric.qualityDelta}점
                </span>
              </td>
              <td className="px-4 py-3 text-center">
                {metric.isSignificant ? (
                  <span className="inline-flex items-center rounded-full bg-green-500/10 px-2 py-0.5 text-xs text-green-500">
                    ✓ 유의미
                  </span>
                ) : (
                  <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                    - 미달
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * 빈 상태 컴포넌트
 */
function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card py-12">
      <FlaskIcon className="h-12 w-12 text-muted-foreground/50" />
      <p className="mt-4 text-muted-foreground">{message}</p>
    </div>
  );
}

/**
 * 플라스크 아이콘
 */
function FlaskIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"
      />
    </svg>
  );
}

/**
 * 전략 라벨 변환
 */
function getStrategyLabel(strategy: string): string {
  const labels: Record<string, string> = {
    smart: 'Smart (규칙 기반)',
    semantic: 'Semantic (AI)',
    late: 'Late Chunking',
  };
  return labels[strategy] ?? strategy;
}
