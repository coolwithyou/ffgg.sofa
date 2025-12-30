/**
 * 응답 시간 성능 대시보드
 * 챗봇 응답 속도를 모니터링하고 지연 발생 시 경고를 확인합니다.
 */

import Link from 'next/link';
import { getPerformanceDashboardData } from './actions';
import { PerformanceOverviewCards } from './components/performance-overview-cards';
import { ResponseTimeTrendChart } from './components/response-time-trend-chart';
import { LatencyBreakdownChart } from './components/latency-breakdown-chart';
import { SlowChatbotsTable } from './components/slow-chatbots-table';
import { PerformanceAlertsPanel } from './components/performance-alerts-panel';

export default async function PerformanceDashboardPage() {
  const data = await getPerformanceDashboardData();

  if (!data) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">데이터를 불러올 수 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 페이지 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">응답 시간 모니터링</h1>
          <p className="text-muted-foreground">챗봇 응답 속도 및 성능을 분석하세요.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/admin/monitoring"
            className="rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
          >
            ← 시스템 모니터링
          </Link>
          <div className="text-right text-sm text-muted-foreground">
            마지막 업데이트: {new Date().toLocaleString('ko-KR')}
          </div>
        </div>
      </div>

      {/* 활성 알림 패널 */}
      {data.activeAlerts.length > 0 && (
        <PerformanceAlertsPanel alerts={data.activeAlerts} />
      )}

      {/* 핵심 지표 카드 */}
      <PerformanceOverviewCards overview={data.overview} />

      {/* 차트 영역 */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* 응답 시간 추이 */}
        <ResponseTimeTrendChart
          trendData={data.trendData}
          realtimeTrend={data.realtimeTrend}
        />

        {/* 단계별 지연 분석 */}
        <LatencyBreakdownChart breakdown={data.breakdown} />
      </div>

      {/* 느린 챗봇 목록 */}
      <SlowChatbotsTable chatbots={data.slowChatbots} />
    </div>
  );
}
