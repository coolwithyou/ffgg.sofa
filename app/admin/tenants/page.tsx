/**
 * 테넌트 관리 페이지
 * [Week 10] 테넌트 목록 및 관리
 */

import { getTenantList } from './actions';
import { TenantTable } from './tenant-table';

export default async function TenantsPage() {
  const tenants = await getTenantList();

  return (
    <div className="space-y-6">
      {/* 페이지 타이틀 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">테넌트 관리</h1>
          <p className="text-gray-600">
            등록된 테넌트 목록을 확인하고 관리하세요.
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-gray-500">총</span>
          <span className="font-semibold text-gray-900">{tenants.length}</span>
          <span className="text-gray-500">개 테넌트</span>
        </div>
      </div>

      {/* 통계 요약 */}
      <div className="grid gap-4 sm:grid-cols-4">
        <SummaryCard
          label="활성"
          count={tenants.filter((t) => t.status === 'active').length}
          color="green"
        />
        <SummaryCard
          label="비활성"
          count={tenants.filter((t) => t.status === 'inactive').length}
          color="gray"
        />
        <SummaryCard
          label="정지"
          count={tenants.filter((t) => t.status === 'suspended').length}
          color="red"
        />
        <SummaryCard
          label="유료"
          count={tenants.filter((t) => t.tier !== 'free').length}
          color="orange"
        />
      </div>

      {/* 테넌트 테이블 */}
      <TenantTable tenants={tenants} />
    </div>
  );
}

// 요약 카드
interface SummaryCardProps {
  label: string;
  count: number;
  color: 'green' | 'gray' | 'red' | 'orange';
}

function SummaryCard({ label, count, color }: SummaryCardProps) {
  const colorClasses = {
    green: 'bg-green-50 border-green-200 text-green-700',
    gray: 'bg-gray-50 border-gray-200 text-gray-700',
    red: 'bg-red-50 border-red-200 text-red-700',
    orange: 'bg-orange-50 border-orange-200 text-orange-700',
  };

  return (
    <div className={`rounded-lg border p-4 ${colorClasses[color]}`}>
      <p className="text-2xl font-bold">{count}</p>
      <p className="text-sm">{label}</p>
    </div>
  );
}
