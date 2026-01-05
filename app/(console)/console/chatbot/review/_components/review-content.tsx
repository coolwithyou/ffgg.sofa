'use client';

/**
 * 청크 검토 메인 콘텐츠
 * Console 마이그레이션 - [v2] 확장 필터 및 메트릭 컬럼 지원
 */

import { useState, useEffect, useTransition, useCallback } from 'react';
import { ReviewTable } from './review-table';
import { ReviewFilters, type FilterState } from './review-filters';
import { ReviewActions } from './review-actions';
import { StatusSummary } from './status-summary';
import { ChunkDetailDialog } from './chunk-detail-dialog';
import type { ChunkReviewItem, ChunkReviewItemWithMetrics, ChunkStatus } from '@/lib/review/types';
import { toast } from 'sonner';
import { useCurrentChatbot } from '../../../hooks/use-console-state';
import { NoChatbotState } from '../../../components/no-chatbot-state';
// 메트릭 포함 여부에 따른 응답 타입
type ChunkItem = ChunkReviewItem | ChunkReviewItemWithMetrics;

interface ChunkListResponse {
  chunks: ChunkItem[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

interface ReviewContentProps {
  /** URL 쿼리 파라미터에서 전달받은 초기 필터 값 */
  initialFilters?: Partial<FilterState>;
}

export function ReviewContent({ initialFilters }: ReviewContentProps) {
  const { currentChatbot } = useCurrentChatbot();
  const [chunks, setChunks] = useState<ChunkItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [hasMore, setHasMore] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();
  const [isLoading, setIsLoading] = useState(true);

  // 다이얼로그 상태
  const [selectedChunkId, setSelectedChunkId] = useState<string | null>(null);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);

  const [filters, setFilters] = useState<FilterState>({
    // 문서 필터 (URL 파라미터에서)
    documentId: initialFilters?.documentId,
    documentName: initialFilters?.documentName,
    // 기존 필터
    status: initialFilters?.status || [],
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
    if (!currentChatbot?.id) return;

    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', page.toString());
      params.set('limit', limit.toString());

      // 챗봇별 필터링
      params.set('chatbotId', currentChatbot.id);

      // 문서 필터
      if (filters.documentId) {
        params.set('documentId', filters.documentId);
      }

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

      // documentId가 설정되어 있지만 documentName이 없으면 첫 번째 청크에서 추출
      if (filters.documentId && !filters.documentName && data.chunks.length > 0) {
        const firstChunk = data.chunks[0];
        if ('documentName' in firstChunk && firstChunk.documentName) {
          setFilters((prev) => ({
            ...prev,
            documentName: firstChunk.documentName,
          }));
        }
      }
    } catch (error) {
      console.error('Error fetching chunks:', error);
    } finally {
      setIsLoading(false);
    }
  }, [page, limit, filters, currentChatbot?.id]);

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
        toast.error('일괄 업데이트 실패', { description: '선택한 항목들의 상태 변경에 실패했습니다.' });
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
        toast.error('상태 변경 실패', { description: '청크 상태 변경에 실패했습니다.' });
      }
    });
  };

  // 상세 보기 다이얼로그 열기
  const handleViewClick = (chunkId: string) => {
    setSelectedChunkId(chunkId);
    setIsDetailDialogOpen(true);
  };

  // 다이얼로그 닫기
  const handleCloseDialog = () => {
    setIsDetailDialogOpen(false);
    setSelectedChunkId(null);
  };

  // 청크 업데이트 콜백 (다이얼로그에서 상태/내용 변경 시)
  const handleChunkUpdated = (chunkId: string, updates: Partial<ChunkReviewItem>) => {
    setChunks((prev) =>
      prev.map((chunk) =>
        chunk.id === chunkId ? { ...chunk, ...updates } : chunk
      )
    );
  };

  // 청크 삭제 콜백
  const handleChunkDeleted = (chunkId: string) => {
    setChunks((prev) => prev.filter((chunk) => chunk.id !== chunkId));
    setTotal((prev) => prev - 1);
    handleCloseDialog();
  };

  // 청크 네비게이션 (이전/다음 청크로 이동)
  const handleNavigate = (chunkId: string) => {
    setSelectedChunkId(chunkId);
  };

  const totalPages = Math.ceil(total / limit);

  // 챗봇 없음 상태
  if (!currentChatbot) {
    return <NoChatbotState />;
  }

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
        onViewClick={handleViewClick}
        isLoading={isLoading}
        isPending={isPending}
        showMetrics={filters.includeMetrics}
      />

      {/* 청크 상세 다이얼로그 */}
      <ChunkDetailDialog
        chunkId={selectedChunkId}
        isOpen={isDetailDialogOpen}
        onClose={handleCloseDialog}
        onChunkUpdated={handleChunkUpdated}
        onChunkDeleted={handleChunkDeleted}
        chunkIds={chunks.map((c) => c.id)}
        onNavigate={handleNavigate}
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
