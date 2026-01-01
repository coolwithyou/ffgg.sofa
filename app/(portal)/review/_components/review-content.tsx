'use client';

/**
 * 청크 검토 메인 콘텐츠
 * [v2] 확장 필터 및 메트릭 컬럼 지원
 */

import { useState, useEffect, useTransition, useCallback } from 'react';
import { ReviewTable } from './review-table';
import { ReviewFilters, type FilterState } from './review-filters';
import { ReviewActions } from './review-actions';
import { StatusSummary } from './status-summary';
import type { ChunkReviewItem, ChunkReviewItemWithMetrics, ChunkStatus } from '@/lib/review/types';

// 메트릭 포함 여부에 따른 응답 타입
type ChunkItem = ChunkReviewItem | ChunkReviewItemWithMetrics;

interface ChunkListResponse {
  chunks: ChunkItem[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export function ReviewContent() {
  const [chunks, setChunks] = useState<ChunkItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [hasMore, setHasMore] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();
  const [isLoading, setIsLoading] = useState(true);

  const [filters, setFilters] = useState<FilterState>({
    status: [],
    minQualityScore: undefined,
    maxQualityScore: undefined,
    search: '',
    sortBy: 'createdAt',
    sortOrder: 'desc',
    // v2 확장 필터
    searchability: [],
    hasContext: undefined,
    minContentLength: undefined,
    maxContentLength: undefined,
    includeMetrics: false,
  });

  // 청크 목록 조회
  const fetchChunks = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', page.toString());
      params.set('limit', limit.toString());

      if (filters.status.length > 0) {
        filters.status.forEach((s) => params.append('status', s));
      }
      if (filters.minQualityScore !== undefined) {
        params.set('minQualityScore', filters.minQualityScore.toString());
      }
      if (filters.maxQualityScore !== undefined) {
        params.set('maxQualityScore', filters.maxQualityScore.toString());
      }
      if (filters.search) {
        params.set('search', filters.search);
      }
      if (filters.sortBy) {
        params.set('sortBy', filters.sortBy);
      }
      if (filters.sortOrder) {
        params.set('sortOrder', filters.sortOrder);
      }

      // v2 확장 필터
      if (filters.searchability.length > 0) {
        filters.searchability.forEach((s) => params.append('searchability', s));
      }
      if (filters.hasContext !== undefined) {
        params.set('hasContext', filters.hasContext.toString());
      }
      if (filters.minContentLength !== undefined) {
        params.set('minContentLength', filters.minContentLength.toString());
      }
      if (filters.maxContentLength !== undefined) {
        params.set('maxContentLength', filters.maxContentLength.toString());
      }
      if (filters.includeMetrics) {
        params.set('includeMetrics', 'true');
      }

      const response = await fetch(`/api/review/chunks?${params.toString()}`);
      if (!response.ok) {
        throw new Error('Failed to fetch chunks');
      }

      const data: ChunkListResponse = await response.json();
      setChunks(data.chunks);
      setTotal(data.total);
      setHasMore(data.hasMore);
    } catch (error) {
      console.error('Error fetching chunks:', error);
    } finally {
      setIsLoading(false);
    }
  }, [page, limit, filters]);

  useEffect(() => {
    fetchChunks();
  }, [fetchChunks]);

  // 필터 변경
  const handleFilterChange = (newFilters: FilterState) => {
    setFilters(newFilters);
    setPage(1); // 필터 변경 시 첫 페이지로
    setSelectedIds(new Set());
  };

  // 선택 토글
  const handleSelectToggle = (chunkId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(chunkId)) {
        next.delete(chunkId);
      } else {
        next.add(chunkId);
      }
      return next;
    });
  };

  // 전체 선택
  const handleSelectAll = () => {
    if (selectedIds.size === chunks.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(chunks.map((c) => c.id)));
    }
  };

  // 일괄 상태 변경
  const handleBulkAction = async (status: 'approved' | 'rejected') => {
    if (selectedIds.size === 0) return;

    startTransition(async () => {
      try {
        const response = await fetch('/api/review/chunks', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chunkIds: Array.from(selectedIds),
            status,
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to update chunks');
        }

        // 성공 시 상태 업데이트
        setChunks((prev) =>
          prev.map((chunk) =>
            selectedIds.has(chunk.id)
              ? { ...chunk, status: status as ChunkStatus }
              : chunk
          )
        );
        setSelectedIds(new Set());
      } catch (error) {
        console.error('Bulk update error:', error);
        alert('일괄 업데이트에 실패했습니다.');
      }
    });
  };

  // 개별 상태 변경
  const handleStatusChange = async (chunkId: string, status: ChunkStatus) => {
    startTransition(async () => {
      try {
        const response = await fetch(`/api/review/chunks/${chunkId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status }),
        });

        if (!response.ok) {
          throw new Error('Failed to update chunk');
        }

        setChunks((prev) =>
          prev.map((chunk) =>
            chunk.id === chunkId ? { ...chunk, status } : chunk
          )
        );
      } catch (error) {
        console.error('Status change error:', error);
        alert('상태 변경에 실패했습니다.');
      }
    });
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-4">
      {/* 상태 요약 */}
      <StatusSummary
        total={total}
        pending={chunks.filter((c) => c.status === 'pending').length}
        approved={chunks.filter((c) => c.status === 'approved').length}
        rejected={chunks.filter((c) => c.status === 'rejected').length}
        modified={chunks.filter((c) => c.status === 'modified').length}
      />

      {/* 필터 */}
      <ReviewFilters filters={filters} onChange={handleFilterChange} />

      {/* 일괄 액션 */}
      {selectedIds.size > 0 && (
        <ReviewActions
          selectedCount={selectedIds.size}
          onApprove={() => handleBulkAction('approved')}
          onReject={() => handleBulkAction('rejected')}
          onClear={() => setSelectedIds(new Set())}
          isPending={isPending}
        />
      )}

      {/* 테이블 */}
      <ReviewTable
        chunks={chunks}
        selectedIds={selectedIds}
        onSelectToggle={handleSelectToggle}
        onSelectAll={handleSelectAll}
        onStatusChange={handleStatusChange}
        isLoading={isLoading}
        isPending={isPending}
        showMetrics={filters.includeMetrics}
      />

      {/* 페이지네이션 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3">
          <p className="text-sm text-muted-foreground">
            총 <span className="font-medium text-foreground">{total}</span>개 중{' '}
            <span className="font-medium text-foreground">{(page - 1) * limit + 1}</span>-
            <span className="font-medium text-foreground">
              {Math.min(page * limit, total)}
            </span>
            개 표시
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="rounded-md border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50"
            >
              이전
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={!hasMore}
              className="rounded-md border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50"
            >
              다음
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
