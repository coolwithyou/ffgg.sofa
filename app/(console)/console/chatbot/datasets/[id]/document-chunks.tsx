'use client';

/**
 * 문서별 청크 목록 컴포넌트
 * Console 마이그레이션
 * 청크 조회 및 활성화/비활성화/삭제 기능 제공
 * 청크 내용으로 검색 가능
 */

import { useState, useEffect, useTransition, useMemo } from 'react';
import { ChevronDown, ChevronUp, Eye, EyeOff, Trash2, Search, X } from 'lucide-react';
import { useAlertDialog } from '@/components/ui/alert-dialog';
import { toast } from 'sonner';

interface ChunkItem {
  id: string;
  content: string;
  preview: string;
  chunkIndex: number | null;
  qualityScore: number | null;
  status: string;
  isActive: boolean;
  autoApproved: boolean;
  createdAt: string;
}

interface DocumentChunksProps {
  documentId: string;
  onChunkUpdate?: () => void;
  showSearch?: boolean;
}

type FilterType = 'all' | 'active' | 'inactive';

export function DocumentChunks({ documentId, onChunkUpdate, showSearch = false }: DocumentChunksProps) {
  const [chunks, setChunks] = useState<ChunkItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterType>('all');
  const [expandedChunkId, setExpandedChunkId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [processingChunkId, setProcessingChunkId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const { confirm } = useAlertDialog();

  useEffect(() => {
    fetchChunks();
    // 새 문서 선택 시 검색어 초기화
    setSearchQuery('');
    setExpandedChunkId(null);
  }, [documentId]);

  const fetchChunks = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await fetch(`/api/documents/${documentId}/chunks?includeInactive=true`);
      if (!response.ok) {
        throw new Error('청크 목록을 불러오는데 실패했습니다.');
      }
      const data = await response.json();
      setChunks(data.chunks);
    } catch (err) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleActive = async (chunkId: string, currentActive: boolean) => {
    setProcessingChunkId(chunkId);

    startTransition(async () => {
      try {
        const response = await fetch(`/api/chunks/${chunkId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isActive: !currentActive }),
        });

        if (!response.ok) {
          throw new Error('상태 변경에 실패했습니다.');
        }

        // 로컬 상태 업데이트
        setChunks((prev) =>
          prev.map((chunk) =>
            chunk.id === chunkId ? { ...chunk, isActive: !currentActive } : chunk
          )
        );

        onChunkUpdate?.();
      } catch (err) {
        toast.error('상태 변경 실패', { description: err instanceof Error ? err.message : '오류가 발생했습니다.' });
      } finally {
        setProcessingChunkId(null);
      }
    });
  };

  const handleDelete = async (chunkId: string) => {
    await confirm({
      title: '청크 삭제',
      message: '이 청크를 삭제하시겠습니까? 삭제된 청크는 복구할 수 없습니다.',
      confirmText: '삭제',
      cancelText: '취소',
      variant: 'destructive',
      onConfirm: async () => {
        const response = await fetch(`/api/chunks/${chunkId}`, {
          method: 'DELETE',
        });

        if (!response.ok) {
          throw new Error('삭제에 실패했습니다.');
        }

        // 로컬 상태 업데이트
        setChunks((prev) => prev.filter((chunk) => chunk.id !== chunkId));
        onChunkUpdate?.();
      },
    });
  };

  // 필터링 및 검색된 청크 목록
  const filteredChunks = useMemo(() => {
    let result = chunks;

    // 활성화 상태 필터
    switch (filter) {
      case 'active':
        result = result.filter((chunk) => chunk.isActive);
        break;
      case 'inactive':
        result = result.filter((chunk) => !chunk.isActive);
        break;
    }

    // 검색어 필터
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter((chunk) =>
        chunk.content.toLowerCase().includes(query)
      );
    }

    return result;
  }, [chunks, filter, searchQuery]);

  // 통계
  const stats = {
    total: chunks.length,
    active: chunks.filter((c) => c.isActive).length,
    inactive: chunks.filter((c) => !c.isActive).length,
  };

  // 검색어 하이라이트 함수
  const highlightText = (text: string, query: string) => {
    if (!query.trim()) return text;

    const parts = text.split(new RegExp(`(${query})`, 'gi'));
    return parts.map((part, i) =>
      part.toLowerCase() === query.toLowerCase() ? (
        <mark key={i} className="bg-yellow-500/30 text-foreground rounded px-0.5">
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <LoadingSpinner className="h-6 w-6 text-primary" />
        <span className="ml-2 text-muted-foreground">청크 로딩 중...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-center">
        <p className="text-destructive">{error}</p>
        <button
          onClick={fetchChunks}
          className="mt-2 text-sm text-primary hover:underline"
        >
          다시 시도
        </button>
      </div>
    );
  }

  if (chunks.length === 0) {
    return (
      <div className="py-8 text-center text-muted-foreground">
        청크가 없습니다.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* 검색창 */}
      {showSearch && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="청크 내용 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-md border border-border bg-background py-2 pl-9 pr-9 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      )}

      {/* 필터 및 통계 */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <FilterButton
            label={`전체 (${stats.total})`}
            isActive={filter === 'all'}
            onClick={() => setFilter('all')}
          />
          <FilterButton
            label={`활성 (${stats.active})`}
            isActive={filter === 'active'}
            onClick={() => setFilter('active')}
          />
          <FilterButton
            label={`비활성 (${stats.inactive})`}
            isActive={filter === 'inactive'}
            onClick={() => setFilter('inactive')}
          />
        </div>
        {searchQuery && (
          <span className="text-xs text-muted-foreground">
            {filteredChunks.length}건 검색됨
          </span>
        )}
      </div>

      {/* 청크 목록 */}
      <div className="space-y-2">
        {filteredChunks.length === 0 ? (
          <p className="py-4 text-center text-muted-foreground">
            {searchQuery
              ? '검색 결과가 없습니다.'
              : filter === 'active'
                ? '활성 청크가 없습니다.'
                : filter === 'inactive'
                  ? '비활성 청크가 없습니다.'
                  : '청크가 없습니다.'}
          </p>
        ) : (
          filteredChunks.map((chunk) => (
            <div
              key={chunk.id}
              className={`rounded-lg border transition-colors ${
                chunk.isActive
                  ? 'border-border bg-card'
                  : 'border-border/50 bg-muted/30'
              }`}
            >
              {/* 청크 헤더 */}
              <div className="flex items-center justify-between px-3 py-2">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() =>
                      setExpandedChunkId(expandedChunkId === chunk.id ? null : chunk.id)
                    }
                    className="flex items-center gap-1.5 text-sm font-medium text-foreground hover:text-primary"
                  >
                    {expandedChunkId === chunk.id ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                    <span>
                      #{chunk.chunkIndex !== null ? chunk.chunkIndex + 1 : '?'}
                    </span>
                  </button>

                  {/* 상태 배지 */}
                  <ChunkStatusBadge status={chunk.status} />

                  {/* 비활성 표시 */}
                  {!chunk.isActive && (
                    <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                      비활성
                    </span>
                  )}

                  {/* 품질 점수 */}
                  {chunk.qualityScore !== null && (
                    <span className="text-xs text-muted-foreground">
                      품질: {chunk.qualityScore.toFixed(2)}
                    </span>
                  )}
                </div>

                {/* 액션 버튼 */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleToggleActive(chunk.id, chunk.isActive)}
                    disabled={isPending || processingChunkId === chunk.id}
                    className={`rounded p-1 transition-colors disabled:opacity-50 ${
                      chunk.isActive
                        ? 'text-muted-foreground hover:bg-yellow-500/10 hover:text-yellow-500'
                        : 'text-muted-foreground hover:bg-green-500/10 hover:text-green-500'
                    }`}
                    title={chunk.isActive ? '비활성화' : '활성화'}
                  >
                    {processingChunkId === chunk.id ? (
                      <LoadingSpinner className="h-4 w-4" />
                    ) : chunk.isActive ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>

                  <button
                    onClick={() => handleDelete(chunk.id)}
                    disabled={isPending || processingChunkId === chunk.id}
                    className="rounded p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                    title="삭제"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* 청크 미리보기 (접힌 상태) */}
              {expandedChunkId !== chunk.id && (
                <div className="border-t border-border/50 px-3 py-2">
                  <p className="line-clamp-2 text-sm text-muted-foreground">
                    {searchQuery ? highlightText(chunk.preview, searchQuery) : chunk.preview}
                  </p>
                </div>
              )}

              {/* 청크 전체 내용 (펼친 상태) */}
              {expandedChunkId === chunk.id && (
                <div className="border-t border-border/50 px-3 py-2">
                  <pre className="max-h-[300px] overflow-auto whitespace-pre-wrap text-sm text-foreground">
                    {searchQuery ? highlightText(chunk.content, searchQuery) : chunk.content}
                  </pre>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// 필터 버튼
function FilterButton({
  label,
  isActive,
  onClick,
}: {
  label: string;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
        isActive
          ? 'bg-primary text-primary-foreground'
          : 'bg-muted text-muted-foreground hover:bg-muted/80'
      }`}
    >
      {label}
    </button>
  );
}

// 청크 상태 배지
function ChunkStatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; className: string }> = {
    pending: { label: '대기', className: 'bg-muted text-muted-foreground' },
    approved: { label: '승인됨', className: 'bg-green-500/10 text-green-500' },
    rejected: { label: '거부됨', className: 'bg-destructive/10 text-destructive' },
  };

  const { label, className } = config[status] || {
    label: status,
    className: 'bg-muted text-muted-foreground',
  };

  return (
    <span className={`rounded-full px-1.5 py-0.5 text-xs font-medium ${className}`}>
      {label}
    </span>
  );
}

// 로딩 스피너
function LoadingSpinner({ className }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} fill="none" viewBox="0 0 24 24">
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}
