/**
 * 예약 슬러그 관리 페이지
 * 관리자가 슬러그 블랙리스트를 관리할 수 있는 페이지
 */

import { getReservedSlugs } from './actions';
import { CATEGORIES, CATEGORY_LABELS } from './constants';
import { ReservedSlugsTable } from './reserved-slugs-table';
import { AddSlugDialog } from './add-slug-dialog';

interface PageProps {
  searchParams: Promise<{
    search?: string;
    category?: string;
    page?: string;
  }>;
}

export default async function ReservedSlugsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const search = params.search || '';
  const category = params.category as (typeof CATEGORIES)[number] | undefined;
  const page = parseInt(params.page || '1');

  const { slugs, pagination, stats } = await getReservedSlugs({
    search,
    category,
    page,
    pageSize: 20,
  });

  return (
    <div className="space-y-6">
      {/* 페이지 타이틀 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">예약 슬러그 관리</h1>
          <p className="text-muted-foreground">
            사용자가 등록할 수 없는 슬러그 목록을 관리합니다.
          </p>
        </div>
        <AddSlugDialog />
      </div>

      {/* 통계 카드 */}
      <div className="grid gap-4 sm:grid-cols-6">
        <StatCard label="전체" count={stats.total} color="default" />
        {CATEGORIES.map((cat) => (
          <StatCard
            key={cat}
            label={CATEGORY_LABELS[cat]}
            count={stats.byCategory[cat] || 0}
            color={cat}
          />
        ))}
      </div>

      {/* 테이블 */}
      <ReservedSlugsTable
        slugs={slugs}
        pagination={pagination}
        currentSearch={search}
        currentCategory={category}
      />
    </div>
  );
}

// 통계 카드
interface StatCardProps {
  label: string;
  count: number;
  color: 'default' | 'profanity' | 'brand' | 'premium' | 'system' | 'other';
}

function StatCard({ label, count, color }: StatCardProps) {
  const colorClasses = {
    default: 'bg-muted border-border text-foreground',
    profanity: 'bg-red-50 border-red-200 text-red-700 dark:bg-red-950 dark:border-red-800 dark:text-red-400',
    brand: 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-950 dark:border-blue-800 dark:text-blue-400',
    premium: 'bg-yellow-50 border-yellow-200 text-yellow-700 dark:bg-yellow-950 dark:border-yellow-800 dark:text-yellow-400',
    system: 'bg-purple-50 border-purple-200 text-purple-700 dark:bg-purple-950 dark:border-purple-800 dark:text-purple-400',
    other: 'bg-gray-50 border-gray-200 text-gray-700 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400',
  };

  return (
    <div className={`rounded-lg border p-4 ${colorClasses[color]}`}>
      <p className="text-2xl font-bold">{count}</p>
      <p className="text-sm">{label}</p>
    </div>
  );
}
