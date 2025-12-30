'use client';

/**
 * 청크 선택 및 데이터셋 복사 컴포넌트
 * 라이브러리 청크를 선택하여 데이터셋에 복사
 */

import { useState, useTransition } from 'react';
import type { LibraryDocument, LibraryChunk, DatasetOption } from './actions';
import { copyChunksToDataset } from './actions';

interface ChunkSelectorProps {
  document: LibraryDocument;
  chunks: LibraryChunk[];
  datasets: DatasetOption[];
}

export function ChunkSelector({ document, chunks, datasets }: ChunkSelectorProps) {
  const [selectedChunks, setSelectedChunks] = useState<Set<string>>(new Set());
  const [targetDatasetId, setTargetDatasetId] = useState<string>(
    datasets.find((d) => d.isDefault)?.id || datasets[0]?.id || ''
  );
  const [isPending, startTransition] = useTransition();
  const [expandedChunk, setExpandedChunk] = useState<string | null>(null);

  const handleSelectAll = () => {
    if (selectedChunks.size === chunks.length) {
      setSelectedChunks(new Set());
    } else {
      setSelectedChunks(new Set(chunks.map((c) => c.id)));
    }
  };

  const handleToggleChunk = (chunkId: string) => {
    const newSelected = new Set(selectedChunks);
    if (newSelected.has(chunkId)) {
      newSelected.delete(chunkId);
    } else {
      newSelected.add(chunkId);
    }
    setSelectedChunks(newSelected);
  };

  const handleCopy = () => {
    if (selectedChunks.size === 0) {
      alert('복사할 청크를 선택해주세요.');
      return;
    }

    if (!targetDatasetId) {
      alert('대상 데이터셋을 선택해주세요.');
      return;
    }

    startTransition(async () => {
      const result = await copyChunksToDataset(Array.from(selectedChunks), targetDatasetId);

      if (result.success) {
        alert(`${result.copiedCount}개 청크가 성공적으로 복사되었습니다.`);
        setSelectedChunks(new Set());
      } else {
        alert(result.error || '복사에 실패했습니다.');
      }
    });
  };

  if (chunks.length === 0) {
    return (
      <div className="flex h-full min-h-[400px] items-center justify-center p-8 text-center">
        <div>
          <AlertIcon className="mx-auto h-12 w-12 text-yellow-500" />
          <p className="mt-4 text-foreground font-medium">청크가 없습니다</p>
          <p className="mt-2 text-sm text-muted-foreground">
            문서가 아직 처리되지 않았거나 처리 중입니다.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* 헤더 */}
      <div className="border-b border-border px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-foreground truncate max-w-[200px]">
              {document.filename}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {chunks.length}개 청크 중 {selectedChunks.size}개 선택됨
            </p>
          </div>
          <button
            onClick={handleSelectAll}
            className="text-sm text-primary hover:underline"
          >
            {selectedChunks.size === chunks.length ? '선택 해제' : '전체 선택'}
          </button>
        </div>
      </div>

      {/* 청크 목록 */}
      <div className="flex-1 overflow-y-auto divide-y divide-border max-h-[400px]">
        {chunks.map((chunk) => (
          <div
            key={chunk.id}
            className={`px-6 py-3 ${selectedChunks.has(chunk.id) ? 'bg-primary/5' : ''}`}
          >
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={selectedChunks.has(chunk.id)}
                onChange={() => handleToggleChunk(chunk.id)}
                className="mt-1 h-4 w-4 rounded border-border text-primary focus:ring-primary"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    #{(chunk.chunkIndex ?? 0) + 1}
                  </span>
                  <QualityBadge score={chunk.qualityScore} />
                  <StatusBadge status={chunk.status} />
                </div>
                <p
                  className={`mt-1 text-sm text-foreground ${
                    expandedChunk === chunk.id ? '' : 'line-clamp-2'
                  }`}
                >
                  {chunk.content}
                </p>
                {chunk.content.length > 100 && (
                  <button
                    onClick={() =>
                      setExpandedChunk(expandedChunk === chunk.id ? null : chunk.id)
                    }
                    className="mt-1 text-xs text-primary hover:underline"
                  >
                    {expandedChunk === chunk.id ? '접기' : '더보기'}
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 복사 액션 */}
      <div className="border-t border-border p-4">
        <div className="flex items-center gap-3">
          <select
            value={targetDatasetId}
            onChange={(e) => setTargetDatasetId(e.target.value)}
            className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:ring-1 focus:ring-primary"
          >
            {datasets.length === 0 ? (
              <option value="">데이터셋 없음</option>
            ) : (
              datasets.map((dataset) => (
                <option key={dataset.id} value={dataset.id}>
                  {dataset.name} {dataset.isDefault && '(기본)'}
                </option>
              ))
            )}
          </select>
          <button
            onClick={handleCopy}
            disabled={isPending || selectedChunks.size === 0 || !targetDatasetId}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPending ? (
              <span className="flex items-center gap-2">
                <LoadingSpinner className="h-4 w-4" />
                복사 중...
              </span>
            ) : (
              `${selectedChunks.size}개 복사`
            )}
          </button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          선택한 청크를 데이터셋에 복사하면 챗봇 검색에 활용됩니다.
        </p>
      </div>
    </div>
  );
}

// 품질 점수 배지
function QualityBadge({ score }: { score: number | null }) {
  if (score === null) return null;

  const color =
    score >= 85
      ? 'text-green-500'
      : score >= 70
        ? 'text-yellow-500'
        : 'text-destructive';

  return (
    <span className={`text-xs font-medium ${color}`}>
      {score}점
    </span>
  );
}

// 상태 배지
function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; className: string }> = {
    pending: { label: '검토대기', className: 'bg-muted text-muted-foreground' },
    approved: { label: '승인', className: 'bg-green-500/10 text-green-500' },
    rejected: { label: '거부', className: 'bg-destructive/10 text-destructive' },
  };

  const { label, className } = config[status] || {
    label: status,
    className: 'bg-muted text-muted-foreground',
  };

  return (
    <span className={`inline-flex rounded px-1.5 py-0.5 text-[10px] font-medium ${className}`}>
      {label}
    </span>
  );
}

// 아이콘 컴포넌트들
function AlertIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
      />
    </svg>
  );
}

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
