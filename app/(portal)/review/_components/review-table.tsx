'use client';

/**
 * 청크 검토 테이블
 */

import Link from 'next/link';
import type { ChunkReviewItem, ChunkStatus } from '@/lib/review/types';

interface ReviewTableProps {
  chunks: ChunkReviewItem[];
  selectedIds: Set<string>;
  onSelectToggle: (chunkId: string) => void;
  onSelectAll: () => void;
  onStatusChange: (chunkId: string, status: ChunkStatus) => void;
  isLoading: boolean;
  isPending: boolean;
}

export function ReviewTable({
  chunks,
  selectedIds,
  onSelectToggle,
  onSelectAll,
  onStatusChange,
  isLoading,
  isPending,
}: ReviewTableProps) {
  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center rounded-lg border border-border bg-card">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (chunks.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-12 text-center">
        <EmptyIcon className="mx-auto h-12 w-12 text-muted-foreground" />
        <h3 className="mt-4 text-lg font-medium text-foreground">
          검토할 청크가 없습니다
        </h3>
        <p className="mt-2 text-muted-foreground">
          필터 조건을 변경하거나 문서를 업로드하세요.
        </p>
      </div>
    );
  }

  const allSelected = selectedIds.size === chunks.length && chunks.length > 0;

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <table className="min-w-full divide-y divide-border">
        <thead className="bg-muted">
          <tr>
            <th className="w-12 px-4 py-3">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={onSelectAll}
                className="h-4 w-4 rounded border-border bg-background text-primary focus:ring-primary"
              />
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
              문서
            </th>
            <th className="w-20 px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
              #
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
              내용 미리보기
            </th>
            <th className="w-16 px-4 py-3 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground">
              컨텍스트
            </th>
            <th className="w-24 px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
              품질
            </th>
            <th className="w-28 px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
              상태
            </th>
            <th className="w-32 px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
              액션
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border bg-card">
          {chunks.map((chunk) => (
            <tr
              key={chunk.id}
              className={`hover:bg-muted ${
                selectedIds.has(chunk.id) ? 'bg-primary/5' : ''
              }`}
            >
              <td className="px-4 py-3">
                <input
                  type="checkbox"
                  checked={selectedIds.has(chunk.id)}
                  onChange={() => onSelectToggle(chunk.id)}
                  className="h-4 w-4 rounded border-border bg-background text-primary focus:ring-primary"
                />
              </td>
              <td className="px-4 py-3">
                <p className="max-w-[200px] truncate text-sm font-medium text-foreground">
                  {chunk.documentName}
                </p>
              </td>
              <td className="px-4 py-3">
                <span className="text-sm text-muted-foreground">
                  #{chunk.chunkIndex + 1}
                </span>
              </td>
              <td className="px-4 py-3">
                <p className="max-w-md truncate text-sm text-muted-foreground">
                  {chunk.content.slice(0, 100)}...
                </p>
              </td>
              <td className="px-4 py-3 text-center">
                <ContextBadge hasContext={chunk.hasContext} />
              </td>
              <td className="px-4 py-3">
                <QualityBadge score={chunk.qualityScore} />
              </td>
              <td className="px-4 py-3">
                <StatusBadge status={chunk.status} autoApproved={chunk.autoApproved} />
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-1">
                  <Link
                    href={`/review/${chunk.id}`}
                    className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                    title="상세 보기"
                  >
                    <ViewIcon className="h-4 w-4" />
                  </Link>
                  {chunk.status === 'pending' && (
                    <>
                      <button
                        onClick={() => onStatusChange(chunk.id, 'approved')}
                        disabled={isPending}
                        className="rounded p-1.5 text-green-500 hover:bg-green-500/10 disabled:opacity-50"
                        title="승인"
                      >
                        <CheckIcon className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => onStatusChange(chunk.id, 'rejected')}
                        disabled={isPending}
                        className="rounded p-1.5 text-destructive hover:bg-destructive/10 disabled:opacity-50"
                        title="거부"
                      >
                        <XIcon className="h-4 w-4" />
                      </button>
                    </>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// 컨텍스트 배지
function ContextBadge({ hasContext }: { hasContext?: boolean }) {
  if (!hasContext) {
    return <span className="text-muted-foreground/50">—</span>;
  }

  return (
    <span
      className="inline-flex items-center rounded-full bg-purple-500/10 px-2 py-0.5 text-xs font-medium text-purple-500"
      title="컨텍스트 생성됨"
    >
      <SparklesIcon className="mr-0.5 h-3 w-3" />
      AI
    </span>
  );
}

// 품질 점수 배지
function QualityBadge({ score }: { score: number | null }) {
  if (score === null) {
    return <span className="text-sm text-muted-foreground">-</span>;
  }

  let colorClass = 'bg-muted text-muted-foreground';
  if (score >= 85) {
    colorClass = 'bg-green-500/10 text-green-500';
  } else if (score >= 70) {
    colorClass = 'bg-yellow-500/10 text-yellow-500';
  } else if (score >= 50) {
    colorClass = 'bg-orange-500/10 text-orange-500';
  } else {
    colorClass = 'bg-destructive/10 text-destructive';
  }

  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${colorClass}`}
    >
      {score}
    </span>
  );
}

// 상태 배지
function StatusBadge({
  status,
  autoApproved,
}: {
  status: ChunkStatus;
  autoApproved: boolean;
}) {
  const config: Record<ChunkStatus, { label: string; className: string }> = {
    pending: { label: '대기', className: 'bg-muted text-muted-foreground' },
    approved: { label: '승인', className: 'bg-green-500/10 text-green-500' },
    rejected: { label: '거부', className: 'bg-destructive/10 text-destructive' },
    modified: { label: '수정됨', className: 'bg-primary/10 text-primary' },
  };

  const { label, className } = config[status];

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${className}`}
      title={autoApproved ? '자동 승인됨' : undefined}
    >
      {label}
      {autoApproved && <span className="text-[10px]">✓</span>}
    </span>
  );
}

// 아이콘
function EmptyIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
      />
    </svg>
  );
}

function ViewIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
      />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M5 13l4 4L19 7"
      />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M6 18L18 6M6 6l12 12"
      />
    </svg>
  );
}

function SparklesIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
      />
    </svg>
  );
}
