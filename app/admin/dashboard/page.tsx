/**
 * 관리자 대시보드 페이지
 * [Week 10] 전체 시스템 현황
 */

import Link from 'next/link';
import { getAdminDashboardData } from './actions';
import { formatCompactNumber } from '@/lib/format';

export default async function AdminDashboardPage() {
  const data = await getAdminDashboardData();

  if (!data) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">데이터를 불러올 수 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 페이지 타이틀 */}
      <div>
        <h1 className="text-2xl font-semibold text-foreground">운영 대시보드</h1>
        <p className="text-muted-foreground">전체 시스템 현황을 확인하세요.</p>
      </div>

      {/* 알림 영역 */}
      <div className="space-y-3">
        {/* 이상 징후 알림 */}
        {data.anomalies.length > 0 && (
          <div className="rounded-lg border border-yellow-500/50 bg-yellow-500/10 p-4">
            <div className="flex items-center gap-2">
              <span className="text-yellow-500">⚠️</span>
              <h3 className="font-medium text-foreground">이상 사용량 감지</h3>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {data.anomalies.length}개 테넌트에서 비정상적인 사용량 증가가 감지되었습니다.
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {data.anomalies.map((a) => (
                <span
                  key={a.tenantId}
                  className="rounded bg-yellow-500/20 px-2 py-0.5 text-xs text-yellow-600 dark:text-yellow-400"
                >
                  {a.tenantName} (+{(a.increaseRatio * 100).toFixed(0)}%)
                </span>
              ))}
            </div>
          </div>
        )}

        {/* 저잔액 테넌트 알림 */}
        {data.lowBalanceTenants.length > 0 && (
          <div className="rounded-lg border border-red-500/50 bg-red-500/10 p-4">
            <div className="flex items-center gap-2">
              <span className="text-red-500">🔴</span>
              <h3 className="font-medium text-foreground">포인트 부족 테넌트</h3>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {data.lowBalanceTenants.length}개 테넌트의 포인트 잔액이 100P 이하입니다.
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {data.lowBalanceTenants.map((t) => (
                <span
                  key={t.tenantId}
                  className="rounded bg-red-500/20 px-2 py-0.5 text-xs text-red-600 dark:text-red-400"
                >
                  {t.tenantName} ({t.balance}P)
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 주요 통계 */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="전체 테넌트"
          value={data.stats.totalTenants}
          subValue={`활성 ${data.stats.activeTenants}`}
        />
        <StatCard
          title="전체 문서"
          value={data.stats.totalDocuments}
        />
        <StatCard
          title="승인된 청크"
          value={data.stats.approvedChunks}
          subValue={`전체 ${data.stats.totalChunks}`}
        />
        <StatCard
          title="오늘 상담"
          value={data.stats.todayConversations}
          subValue={`주간 ${data.stats.weeklyConversations}`}
        />
      </div>

      {/* AI 사용량 요약 */}
      <div className="rounded-lg border border-border bg-card p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">AI 사용량</h2>
          <Link
            href="/admin/usage"
            className="text-sm text-primary hover:text-primary/80"
          >
            상세 보기
          </Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <AIStatCard
            title="오늘 비용"
            value={`$${data.aiUsage.todayCostUsd.toFixed(2)}`}
            subValue={`${formatCompactNumber(data.aiUsage.todayTokens)} tokens`}
          />
          <AIStatCard
            title="이번 달"
            value={`$${data.aiUsage.monthCostUsd.toFixed(2)}`}
            subValue={`${formatCompactNumber(data.aiUsage.monthTokens)} tokens`}
          />
          <AIStatCard
            title="월말 예측"
            value={`$${data.aiUsage.forecastCostUsd.toFixed(2)}`}
            subValue="예상 비용"
            highlight={data.aiUsage.forecastCostUsd > data.aiUsage.monthCostUsd * 1.5}
          />
          <AIStatCard
            title="캐시 효율"
            value={`${data.aiUsage.cacheHitRate.toFixed(1)}%`}
            subValue={`$${data.aiUsage.estimatedSavings.toFixed(2)} 절감`}
            positive={data.aiUsage.cacheHitRate >= 50}
          />
        </div>
      </div>

      {/* 포인트 시스템 통계 */}
      <div className="rounded-lg border border-border bg-card p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">💎 포인트 시스템</h2>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="rounded bg-primary/10 px-2 py-0.5 text-primary">
              {data.pointsStats.activeTenantsWithPoints}명 보유
            </span>
            {data.pointsStats.lowBalanceCount > 0 && (
              <span className="rounded bg-red-500/10 px-2 py-0.5 text-red-500">
                {data.pointsStats.lowBalanceCount}명 저잔액
              </span>
            )}
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <PointStatCard
            title="전체 잔액"
            value={`${data.pointsStats.totalBalance.toLocaleString()}P`}
            subValue="모든 테넌트 합계"
          />
          <PointStatCard
            title="오늘 사용"
            value={`${data.pointsStats.todayUsage.toLocaleString()}P`}
            subValue={`이번 달 ${data.pointsStats.monthUsage.toLocaleString()}P`}
            highlight={data.pointsStats.todayUsage > 1000}
          />
          <PointStatCard
            title="오늘 충전"
            value={`${data.pointsStats.todayCharges.toLocaleString()}P`}
            subValue={`이번 달 ${data.pointsStats.monthCharges.toLocaleString()}P`}
            positive={data.pointsStats.todayCharges > 0}
          />
          <PointStatCard
            title="순증감 (이번 달)"
            value={`${(data.pointsStats.monthCharges - data.pointsStats.monthUsage).toLocaleString()}P`}
            subValue={data.pointsStats.monthCharges >= data.pointsStats.monthUsage ? '충전 > 사용' : '사용 > 충전'}
            positive={data.pointsStats.monthCharges >= data.pointsStats.monthUsage}
            highlight={data.pointsStats.monthCharges < data.pointsStats.monthUsage}
          />
        </div>
      </div>

      {/* 상세 통계 */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* 상위 테넌트 */}
        <div className="rounded-lg border border-border bg-card p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">상위 테넌트 (사용량 기준)</h2>
            <Link
              href="/admin/tenants"
              className="text-sm text-primary hover:text-primary/80"
            >
              전체 보기
            </Link>
          </div>
          {data.topTenants.length === 0 ? (
            <p className="text-sm text-muted-foreground">등록된 테넌트가 없습니다.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="pb-2 font-medium">테넌트</th>
                    <th className="pb-2 text-center font-medium">티어</th>
                    <th className="pb-2 text-right font-medium">포인트</th>
                    <th className="pb-2 text-right font-medium">문서</th>
                    <th className="pb-2 text-right font-medium">청크</th>
                    <th className="pb-2 text-right font-medium">상담</th>
                    <th className="pb-2 text-right font-medium">상태</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.topTenants.map((tenant) => (
                    <tr key={tenant.id} className="hover:bg-muted/50">
                      <td className="py-3">
                        <div>
                          <p className="font-medium text-foreground">{tenant.name}</p>
                          <p className="text-xs text-muted-foreground">{tenant.email}</p>
                        </div>
                      </td>
                      <td className="py-3 text-center">
                        <TierBadge tier={tenant.tier} />
                      </td>
                      <td className="py-3 text-right">
                        <span className={`tabular-nums ${tenant.balance <= 100 ? 'font-medium text-red-500' : 'text-muted-foreground'}`}>
                          {tenant.balance.toLocaleString()}P
                        </span>
                      </td>
                      <td className="py-3 text-right text-muted-foreground">
                        {tenant.documentCount.toLocaleString()}
                      </td>
                      <td className="py-3 text-right text-muted-foreground">
                        {tenant.chunkCount.toLocaleString()}
                      </td>
                      <td className="py-3 text-right text-muted-foreground">
                        {tenant.conversationCount.toLocaleString()}
                      </td>
                      <td className="py-3 text-right">
                        <StatusBadge status={tenant.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* 시스템 상태 */}
        <div className="rounded-lg border border-border bg-card p-6">
          <h2 className="mb-4 text-lg font-semibold text-foreground">시스템 상태</h2>
          <div className="space-y-4">
            <SystemStatusItem
              name="데이터베이스"
              status="healthy"
              description="PostgreSQL 정상 작동"
            />
            <SystemStatusItem
              name="OpenAI API"
              status="healthy"
              description="임베딩 및 LLM 정상"
            />
            <SystemStatusItem
              name="Redis"
              status="healthy"
              description="캐시 및 Rate Limiting 정상"
            />
            <SystemStatusItem
              name="파일 스토리지"
              status="healthy"
              description="Supabase Storage 정상"
            />
          </div>
          <Link
            href="/admin/monitoring"
            className="mt-4 block text-center text-sm text-primary hover:text-primary/80"
          >
            상세 모니터링 보기
          </Link>
        </div>
      </div>

      {/* 빠른 작업 */}
      <div className="rounded-lg border border-border bg-card p-6">
        <h2 className="mb-4 text-lg font-semibold text-foreground">빠른 작업</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <QuickAction
            href="/admin/tenants"
            title="테넌트 관리"
            description="테넌트 목록 확인 및 관리"
            icon={TenantsIcon}
          />
          <QuickAction
            href="/admin/monitoring"
            title="모니터링"
            description="시스템 상태 및 로그 확인"
            icon={MonitoringIcon}
          />
          <QuickAction
            href="/review"
            title="청크 검토"
            description="대기 중인 청크 검토"
            icon={ReviewIcon}
          />
        </div>
      </div>
    </div>
  );
}

// 통계 카드 컴포넌트
interface StatCardProps {
  title: string;
  value: number;
  subValue?: string;
}

function StatCard({ title, value, subValue }: StatCardProps) {
  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <p className="text-sm font-medium text-muted-foreground">{title}</p>
      <p className="mt-2 text-3xl font-bold text-foreground">{value.toLocaleString()}</p>
      {subValue && <p className="mt-1 text-sm text-muted-foreground">{subValue}</p>}
    </div>
  );
}

// AI 사용량 카드 컴포넌트
interface AIStatCardProps {
  title: string;
  value: string;
  subValue: string;
  highlight?: boolean;
  positive?: boolean;
}

function AIStatCard({ title, value, subValue, highlight, positive }: AIStatCardProps) {
  return (
    <div className="rounded-lg bg-muted/50 p-4">
      <p className="text-sm font-medium text-muted-foreground">{title}</p>
      <p
        className={`mt-1 text-2xl font-bold tabular-nums ${
          highlight
            ? 'text-yellow-500'
            : positive
              ? 'text-green-500'
              : 'text-foreground'
        }`}
      >
        {value}
      </p>
      <p className="mt-0.5 text-xs text-muted-foreground">{subValue}</p>
    </div>
  );
}

// 포인트 통계 카드 컴포넌트
interface PointStatCardProps {
  title: string;
  value: string;
  subValue: string;
  highlight?: boolean;
  positive?: boolean;
}

function PointStatCard({ title, value, subValue, highlight, positive }: PointStatCardProps) {
  return (
    <div className="rounded-lg bg-gradient-to-br from-purple-500/5 to-primary/5 p-4">
      <p className="text-sm font-medium text-muted-foreground">{title}</p>
      <p
        className={`mt-1 text-2xl font-bold tabular-nums ${
          highlight
            ? 'text-red-500'
            : positive
              ? 'text-green-500'
              : 'text-foreground'
        }`}
      >
        {value}
      </p>
      <p className="mt-0.5 text-xs text-muted-foreground">{subValue}</p>
    </div>
  );
}

// 상태 배지
function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; className: string }> = {
    active: { label: '활성', className: 'text-green-500' },
    inactive: { label: '비활성', className: 'text-muted-foreground' },
    suspended: { label: '정지', className: 'text-red-500' },
  };

  const { label, className } = config[status] || config.active;

  return (
    <span className={`text-xs font-medium ${className}`}>
      {label}
    </span>
  );
}

// 티어 배지
function TierBadge({ tier }: { tier: string }) {
  const config: Record<string, { label: string; className: string }> = {
    free: { label: 'Free', className: 'bg-muted text-muted-foreground' },
    pro: { label: 'Pro', className: 'bg-primary/10 text-primary' },
    business: { label: 'Business', className: 'bg-purple-500/10 text-purple-500' },
  };

  const { label, className } = config[tier.toLowerCase()] || config.free;

  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${className}`}>
      {label}
    </span>
  );
}

// 시스템 상태 항목
interface SystemStatusItemProps {
  name: string;
  status: 'healthy' | 'degraded' | 'down';
  description: string;
}

function SystemStatusItem({ name, status, description }: SystemStatusItemProps) {
  const statusConfig = {
    healthy: { color: 'bg-green-500', label: '정상', textColor: 'text-green-500' },
    degraded: { color: 'bg-yellow-500', label: '저하', textColor: 'text-yellow-500' },
    down: { color: 'bg-red-500', label: '장애', textColor: 'text-red-500' },
  };

  const { color, label, textColor } = statusConfig[status];

  return (
    <div className="flex items-center justify-between rounded-lg bg-muted/50 px-4 py-3">
      <div className="flex items-center gap-3">
        <div className={`h-2 w-2 rounded-full ${color}`} />
        <div>
          <p className="font-medium text-foreground">{name}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      <span className={`text-xs font-medium ${textColor}`}>{label}</span>
    </div>
  );
}

// 빠른 작업 컴포넌트
interface QuickActionProps {
  href: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

function QuickAction({ href, title, description, icon: Icon }: QuickActionProps) {
  return (
    <Link
      href={href}
      className="flex items-start gap-4 rounded-lg border border-border p-4 transition-colors hover:bg-muted"
    >
      <div className="rounded-lg bg-muted p-2">
        <Icon className="h-5 w-5 text-muted-foreground" />
      </div>
      <div>
        <h3 className="font-medium text-foreground">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </Link>
  );
}

// 아이콘
function TenantsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
      />
    </svg>
  );
}

function MonitoringIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
      />
    </svg>
  );
}

function ReviewIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
      />
    </svg>
  );
}
