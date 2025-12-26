'use client';

/**
 * 상태 요약 카드
 */

interface StatusSummaryProps {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  modified: number;
}

export function StatusSummary({
  total,
  pending,
  approved,
  rejected,
  modified,
}: StatusSummaryProps) {
  const stats = [
    { label: '전체', value: total, color: 'bg-gray-500' },
    { label: '대기', value: pending, color: 'bg-gray-400' },
    { label: '승인', value: approved, color: 'bg-green-500' },
    { label: '거부', value: rejected, color: 'bg-red-500' },
    { label: '수정됨', value: modified, color: 'bg-blue-500' },
  ];

  return (
    <div className="grid grid-cols-5 gap-4">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="rounded-lg border bg-white p-4"
        >
          <div className="flex items-center gap-2">
            <div className={`h-2 w-2 rounded-full ${stat.color}`} />
            <span className="text-sm text-gray-600">{stat.label}</span>
          </div>
          <p className="mt-1 text-2xl font-bold text-gray-900">{stat.value}</p>
        </div>
      ))}
    </div>
  );
}
