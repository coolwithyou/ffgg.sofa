'use client';

/**
 * 청크 상세 보기/편집 컴포넌트
 */

import { useState, useEffect, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { ChunkReviewItem, ChunkStatus } from '@/lib/review/types';

interface ChunkDetailProps {
  chunkId: string;
}

export function ChunkDetail({ chunkId }: ChunkDetailProps) {
  const router = useRouter();
  const [chunk, setChunk] = useState<ChunkReviewItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [isPending, startTransition] = useTransition();

  // 청크 조회
  useEffect(() => {
    async function fetchChunk() {
      try {
        const response = await fetch(`/api/review/chunks/${chunkId}`);
        if (!response.ok) {
          if (response.status === 404) {
            setError('청크를 찾을 수 없습니다.');
          } else {
            setError('청크를 불러오는데 실패했습니다.');
          }
          return;
        }
        const data = await response.json();
        setChunk(data.chunk);
        setEditContent(data.chunk.content);
      } catch (err) {
        setError('네트워크 오류가 발생했습니다.');
      } finally {
        setIsLoading(false);
      }
    }

    fetchChunk();
  }, [chunkId]);

  // 상태 변경
  const handleStatusChange = async (status: ChunkStatus) => {
    if (!chunk) return;

    startTransition(async () => {
      try {
        const response = await fetch(`/api/review/chunks/${chunkId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status }),
        });

        if (!response.ok) {
          throw new Error('Failed to update status');
        }

        const data = await response.json();
        setChunk(data.chunk);
      } catch (err) {
        alert('상태 변경에 실패했습니다.');
      }
    });
  };

  // 내용 저장
  const handleSaveContent = async () => {
    if (!chunk) return;

    startTransition(async () => {
      try {
        const response = await fetch(`/api/review/chunks/${chunkId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: editContent,
            status: 'modified' as ChunkStatus,
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to save content');
        }

        const data = await response.json();
        setChunk(data.chunk);
        setIsEditing(false);
      } catch (err) {
        alert('저장에 실패했습니다.');
      }
    });
  };

  // 삭제
  const handleDelete = async () => {
    if (!confirm('이 청크를 삭제하시겠습니까?')) return;

    startTransition(async () => {
      try {
        const response = await fetch(`/api/review/chunks/${chunkId}`, {
          method: 'DELETE',
        });

        if (!response.ok) {
          throw new Error('Failed to delete');
        }

        router.push('/review');
      } catch (err) {
        alert('삭제에 실패했습니다.');
      }
    });
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
      </div>
    );
  }

  if (error || !chunk) {
    return (
      <div className="rounded-lg border bg-white p-8 text-center">
        <p className="text-red-600">{error || '청크를 찾을 수 없습니다.'}</p>
        <Link
          href="/review"
          className="mt-4 inline-block text-blue-600 hover:underline"
        >
          목록으로 돌아가기
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/review"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200"
          >
            <BackIcon className="h-5 w-5 text-gray-600" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              청크 #{chunk.chunkIndex + 1}
            </h1>
            <p className="text-gray-600">{chunk.documentName}</p>
          </div>
        </div>
        <StatusBadge status={chunk.status} autoApproved={chunk.autoApproved} />
      </div>

      {/* 메타 정보 */}
      <div className="grid grid-cols-3 gap-4">
        <MetaCard label="품질 점수" value={chunk.qualityScore?.toString() ?? '-'} />
        <MetaCard label="생성일" value={formatDate(chunk.createdAt)} />
        <MetaCard label="수정일" value={formatDate(chunk.updatedAt)} />
      </div>

      {/* 내용 */}
      <div className="rounded-lg border bg-white">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">청크 내용</h2>
          {!isEditing && (
            <button
              onClick={() => setIsEditing(true)}
              className="text-sm text-blue-600 hover:underline"
            >
              편집
            </button>
          )}
        </div>
        <div className="p-6">
          {isEditing ? (
            <div className="space-y-4">
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="h-64 w-full rounded-md border p-4 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => {
                    setIsEditing(false);
                    setEditContent(chunk.content);
                  }}
                  className="rounded-md border px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  취소
                </button>
                <button
                  onClick={handleSaveContent}
                  disabled={isPending}
                  className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  저장
                </button>
              </div>
            </div>
          ) : (
            <div className="whitespace-pre-wrap text-sm text-gray-700">
              {chunk.content}
            </div>
          )}
        </div>
      </div>

      {/* 액션 버튼 */}
      <div className="flex items-center justify-between rounded-lg border bg-white p-6">
        <button
          onClick={handleDelete}
          disabled={isPending}
          className="rounded-md border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
        >
          삭제
        </button>
        <div className="flex gap-2">
          {chunk.status !== 'rejected' && (
            <button
              onClick={() => handleStatusChange('rejected')}
              disabled={isPending}
              className="rounded-md bg-red-600 px-6 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              거부
            </button>
          )}
          {chunk.status !== 'approved' && (
            <button
              onClick={() => handleStatusChange('approved')}
              disabled={isPending}
              className="rounded-md bg-green-600 px-6 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
            >
              승인
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// 메타 카드
function MetaCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-white p-4">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-gray-900">{value}</p>
    </div>
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
    pending: { label: '대기', className: 'bg-gray-100 text-gray-700' },
    approved: { label: '승인', className: 'bg-green-100 text-green-700' },
    rejected: { label: '거부', className: 'bg-red-100 text-red-700' },
    modified: { label: '수정됨', className: 'bg-blue-100 text-blue-700' },
  };

  const { label, className } = config[status];

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-4 py-1.5 text-sm font-medium ${className}`}
    >
      {label}
      {autoApproved && <span className="text-xs">(자동)</span>}
    </span>
  );
}

// 날짜 포맷
function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// 아이콘
function BackIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M15 19l-7-7 7-7"
      />
    </svg>
  );
}
