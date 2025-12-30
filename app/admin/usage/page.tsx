/**
 * AI 토큰 사용량 대시보드
 * 전체 시스템의 토큰 사용량 및 비용을 모니터링합니다.
 */

import { getUsageDashboardData } from './actions';
import { UsageOverviewCards } from './components/usage-overview-cards';
import { CostBreakdownChart } from './components/cost-breakdown-chart';
import { UsageTrendChart } from './components/usage-trend-chart';
import { TenantUsageTable } from './components/tenant-usage-table';
import { BudgetStatusList } from './components/budget-status-list';
import { ForecastWidget } from './components/forecast-widget';
import { AnomalyAlert } from './components/anomaly-alert';

export default async function UsageDashboardPage() {
  const data = await getUsageDashboardData();

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
    </div>
  );
}
