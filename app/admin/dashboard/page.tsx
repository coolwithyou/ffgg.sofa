/**
 * 관리자 대시보드 페이지
 * [Week 10] 전체 시스템 현황
 */

import Link from 'next/link';
import { getAdminDashboardData } from './actions';

export default async function AdminDashboardPage() {
  const data = await getAdminDashboardData();

  if (!data) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-gray-500">데이터를 불러올 수 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 페이지 타이틀 */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">운영 대시보드</h1>
        <p className="text-gray-600">전체 시스템 현황을 확인하세요.</p>
      </div>

      {/* 주요 통계 */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="전체 테넌트"
          value={data.stats.totalTenants}
          subValue={`활성 ${data.stats.activeTenants}`}
          color="blue"
        />
        <StatCard
          title="전체 문서"
          value={data.stats.totalDocuments}
          color="purple"
        />
        <StatCard
          title="승인된 청크"
          value={data.stats.approvedChunks}
          subValue={`전체 ${data.stats.totalChunks}`}
          color="green"
        />
        <StatCard
          title="오늘 상담"
          value={data.stats.todayConversations}
          subValue={`주간 ${data.stats.weeklyConversations}`}
          color="orange"
        />
      </div>

      {/* 상세 통계 */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* 상위 테넌트 */}
        <div className="rounded-lg border bg-white p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">상위 테넌트 (사용량 기준)</h2>
            <Link
              href="/admin/tenants"
              className="text-sm text-orange-600 hover:text-orange-700"
            >
              전체 보기
            </Link>
          </div>
          {data.topTenants.length === 0 ? (
            <p className="text-sm text-gray-500">등록된 테넌트가 없습니다.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-gray-500">
                    <th className="pb-2 font-medium">테넌트</th>
                    <th className="pb-2 text-right font-medium">문서</th>
                    <th className="pb-2 text-right font-medium">청크</th>
                    <th className="pb-2 text-right font-medium">상담</th>
                    <th className="pb-2 text-right font-medium">상태</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {data.topTenants.map((tenant) => (
                    <tr key={tenant.id} className="hover:bg-gray-50">
                      <td className="py-3">
                        <div>
                          <p className="font-medium text-gray-900">{tenant.name}</p>
                          <p className="text-xs text-gray-500">{tenant.email}</p>
                        </div>
                      </td>
                      <td className="py-3 text-right text-gray-600">
                        {tenant.documentCount.toLocaleString()}
                      </td>
                      <td className="py-3 text-right text-gray-600">
                        {tenant.chunkCount.toLocaleString()}
                      </td>
                      <td className="py-3 text-right text-gray-600">
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
        <div className="rounded-lg border bg-white p-6">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">시스템 상태</h2>
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
            className="mt-4 block text-center text-sm text-orange-600 hover:text-orange-700"
          >
            상세 모니터링 보기
          </Link>
        </div>
      </div>

      {/* 빠른 작업 */}
      <div className="rounded-lg border bg-white p-6">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">빠른 작업</h2>
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
  color: 'blue' | 'purple' | 'green' | 'orange';
}

function StatCard({ title, value, subValue, color }: StatCardProps) {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600',
    purple: 'bg-purple-50 text-purple-600',
    green: 'bg-green-50 text-green-600',
    orange: 'bg-orange-50 text-orange-600',
  };

  return (
    <div className="rounded-lg border bg-white p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="mt-1 text-3xl font-bold text-gray-900">{value.toLocaleString()}</p>
          {subValue && <p className="mt-1 text-sm text-gray-500">{subValue}</p>}
        </div>
        <div className={`rounded-full p-3 ${colorClasses[color]}`}>
          <div className="h-6 w-6" />
        </div>
      </div>
    </div>
  );
}

// 상태 배지
function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; className: string }> = {
    active: { label: '활성', className: 'bg-green-100 text-green-700' },
    inactive: { label: '비활성', className: 'bg-gray-100 text-gray-700' },
    suspended: { label: '정지', className: 'bg-red-100 text-red-700' },
  };

  const { label, className } = config[status] || config.active;

  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${className}`}>
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
    healthy: { color: 'bg-green-500', label: '정상' },
    degraded: { color: 'bg-yellow-500', label: '저하' },
    down: { color: 'bg-red-500', label: '장애' },
  };

  const { color, label } = statusConfig[status];

  return (
    <div className="flex items-center justify-between rounded-lg bg-gray-50 px-4 py-3">
      <div className="flex items-center gap-3">
        <div className={`h-3 w-3 rounded-full ${color}`} />
        <div>
          <p className="font-medium text-gray-900">{name}</p>
          <p className="text-xs text-gray-500">{description}</p>
        </div>
      </div>
      <span className="text-xs font-medium text-gray-600">{label}</span>
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
      className="flex items-start gap-4 rounded-lg border p-4 transition-colors hover:bg-gray-50"
    >
      <div className="rounded-lg bg-orange-100 p-2">
        <Icon className="h-5 w-5 text-orange-600" />
      </div>
      <div>
        <h3 className="font-medium text-gray-900">{title}</h3>
        <p className="text-sm text-gray-500">{description}</p>
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
