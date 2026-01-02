/**
 * AI 토큰 사용량 대시보드
 * 전체 시스템의 토큰 사용량 및 비용을 모니터링합니다.
 *
 * 포함 섹션:
 * 1. 기존 대시보드: 개요 카드, 비용 분포, 예측, 추이, 테넌트별 사용량, 예산 상태
 * 2. 상세 인사이트: 비용-효율성, 캐시 효율성, 시간대 패턴, RAG 파이프라인
 */

import { getInsightsDashboardData } from './actions';
import { UsageOverviewCards } from './components/usage-overview-cards';
import { CostBreakdownChart } from './components/cost-breakdown-chart';
import { UsageTrendChart } from './components/usage-trend-chart';
import { TenantUsageTable } from './components/tenant-usage-table';
import { BudgetStatusList } from './components/budget-status-list';
import { ForecastWidget } from './components/forecast-widget';
import { AnomalyAlert } from './components/anomaly-alert';
// Phase 2 인사이트 차트 컴포넌트
import { FeatureTokenDistribution } from './components/feature-token-distribution';
import { CacheHitTrendChart } from './components/cache-hit-trend-chart';
import { ChannelUsageChart } from './components/channel-usage-chart';
import { PipelineLatencyChart } from './components/pipeline-latency-chart';
// Phase 3 인사이트 차트 컴포넌트
import { TokenEfficiencyChart } from './components/token-efficiency-chart';
import { CacheCostDonut } from './components/cache-cost-donut';
import { UsageHeatmap } from './components/usage-heatmap';
import { ChunkDistributionChart } from './components/chunk-distribution-chart';

export default async function UsageDashboardPage() {
  const data = await getInsightsDashboardData();

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
          <h1 className="text-2xl font-semibold text-foreground">AI 사용량 대시보드</h1>
          <p className="text-muted-foreground">토큰 사용량 및 비용을 모니터링하세요.</p>
        </div>
        <div className="text-right text-sm text-muted-foreground">
          마지막 업데이트: {new Date().toLocaleString('ko-KR')}
        </div>
      </div>

      {/* 이상 감지 알림 */}
      {data.anomalies.length > 0 && <AnomalyAlert anomalies={data.anomalies} />}

      {/* 핵심 지표 카드 */}
      <UsageOverviewCards
        todayOverview={data.overview.today}
        monthOverview={data.overview.month}
        forecast={data.forecast}
      />

      {/* 차트 영역 */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* 모델별 비용 분포 */}
        <CostBreakdownChart overview={data.overview.month} />

        {/* 월말 예측 위젯 */}
        <ForecastWidget forecast={data.forecast} />
      </div>

      {/* 일별 추이 차트 */}
      <UsageTrendChart trend={data.trend} />

      {/* 하단 영역 */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* 테넌트별 사용량 순위 */}
        <TenantUsageTable topTenants={data.topTenants} />

        {/* 예산 상태 현황 */}
        <BudgetStatusList budgetStatuses={data.budgetStatuses} />
      </div>

      {/* === 상세 인사이트 섹션 === */}
      <div className="border-t border-border pt-6">
        <h2 className="text-xl font-semibold text-foreground">상세 인사이트</h2>
        <p className="text-sm text-muted-foreground">
          수집된 데이터에서 도출한 심층 분석
        </p>
      </div>

      {/* 비용-효율성 분석 */}
      <section className="space-y-4">
        <h3 className="text-lg font-medium text-foreground">비용-효율성 분석</h3>
        <div className="grid gap-6 lg:grid-cols-2">
          {/* TokenEfficiencyChart - 버블 매트릭스 (Phase 3) ✅ */}
          <TokenEfficiencyChart data={data.tokenEfficiency} />
          {/* FeatureTokenDistribution - 수평 Bar (Phase 2) ✅ */}
          <FeatureTokenDistribution data={data.featureDistribution} />
        </div>
      </section>

      {/* 캐시 효율성 */}
      <section className="space-y-4">
        <h3 className="text-lg font-medium text-foreground">캐시 효율성</h3>
        <div className="grid gap-6 lg:grid-cols-2">
          {/* CacheHitTrendChart - Bar Chart (Phase 2) ✅ */}
          <CacheHitTrendChart data={data.cacheHitTrend} />
          {/* CacheCostDonut - Donut Chart (Phase 3) ✅ */}
          <CacheCostDonut data={data.cacheCostComparison} />
        </div>
      </section>

      {/* 시간대 패턴 분석 */}
      <section className="space-y-4">
        <h3 className="text-lg font-medium text-foreground">시간대 패턴 분석</h3>
        <div className="grid gap-6 lg:grid-cols-2">
          {/* UsageHeatmap - CSS Grid 7×24 (Phase 3) ✅ */}
          <UsageHeatmap data={data.usageHeatmap} />
          {/* ChannelUsageChart - Stacked Bar (Phase 2) ✅ */}
          <ChannelUsageChart data={data.channelUsage} />
        </div>
      </section>

      {/* RAG 파이프라인 효율성 */}
      <section className="space-y-4">
        <h3 className="text-lg font-medium text-foreground">RAG 파이프라인 효율성</h3>
        <div className="grid gap-6 lg:grid-cols-2">
          {/* ChunkDistributionChart - Histogram (Phase 3) ✅ */}
          <ChunkDistributionChart data={data.chunkDistribution} />
          {/* PipelineLatencyChart - Stacked Bar (Phase 2) ✅ */}
          <PipelineLatencyChart data={data.pipelineLatency} />
        </div>
      </section>
    </div>
  );
}

