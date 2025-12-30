/**
 * 알림 관리 페이지
 * 발생한 알림 목록 조회, 확인 처리, Slack 설정 관리
 */

import Link from 'next/link';
import { getAlerts, getAlertsOverview, getSlackSettings } from './actions';
import { AlertsOverviewCards, AlertTypeBreakdown } from './components/alerts-overview-cards';
import { AlertsTable } from './components/alerts-table';
import { SlackSettingsForm } from './components/slack-settings-form';

interface AlertsPageProps {
  searchParams: Promise<{
    page?: string;
    acknowledged?: string;
    type?: string;
  }>;
}

export default async function AlertsPage({ searchParams }: AlertsPageProps) {
  const params = await searchParams;
  const page = parseInt(params.page || '1', 10);
  const acknowledged = params.acknowledged === 'true' ? true : params.acknowledged === 'false' ? false : undefined;

  // 데이터 조회
  const [alertsData, overview, slackSettings] = await Promise.all([
    getAlerts({ page, limit: 20, acknowledged }),
    getAlertsOverview(),
    getSlackSettings(),
  ]);

  if (!alertsData || !overview) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-muted-foreground">데이터를 불러올 수 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 페이지 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/admin/monitoring"
            className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <BackIcon className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-semibold text-foreground">알림 관리</h1>
            <p className="text-muted-foreground">예산 및 이상 징후 알림 관리</p>
          </div>
        </div>
      </div>

      {/* 개요 카드 */}
      <AlertsOverviewCards overview={overview} />

      {/* 설정 및 분포 */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <SlackSettingsForm settings={slackSettings} />
        </div>
        <div>
          <AlertTypeBreakdown overview={overview} />
        </div>
      </div>

      {/* 필터 탭 */}
      <div className="flex gap-2 border-b border-border">
        <FilterTab
          href="/admin/monitoring/alerts"
          active={acknowledged === undefined}
          label="전체"
        />
        <FilterTab
          href="/admin/monitoring/alerts?acknowledged=false"
          active={acknowledged === false}
          label="미확인"
          count={overview.unacknowledged}
        />
        <FilterTab
          href="/admin/monitoring/alerts?acknowledged=true"
          active={acknowledged === true}
          label="확인됨"
        />
      </div>

      {/* 알림 목록 */}
      <AlertsTable
        alerts={alertsData.alerts}
        total={alertsData.total}
        page={page}
        limit={20}
      />
    </div>
  );
}

function FilterTab({
  href,
  active,
  label,
  count,
}: {
  href: string;
  active: boolean;
  label: string;
  count?: number;
}) {
  return (
    <Link
      href={href}
      className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
        active
          ? 'border-primary text-primary'
          : 'border-transparent text-muted-foreground hover:text-foreground'
      }`}
    >
      {label}
      {count !== undefined && count > 0 && (
        <span className="ml-2 rounded-full bg-destructive/10 px-2 py-0.5 text-xs text-destructive">
          {count}
        </span>
      )}
    </Link>
  );
}

function BackIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M10 19l-7-7m0 0l7-7m-7 7h18"
      />
    </svg>
  );
}
