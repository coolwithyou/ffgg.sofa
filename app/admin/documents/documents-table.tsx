'use client';

/**
 * 문서 테이블 컴포넌트
 * 문서 목록 표시 및 재처리 기능
 */

import { useState, useEffect, useCallback } from 'react';

interface Document {
  id: string;
  tenantId: string;
  tenantName: string | null;
  filename: string;
  filePath: string;
  fileSize: number | null;
  fileType: string | null;
  status: string | null;
  progressStep: string | null;
  progressPercent: number | null;
  errorMessage: string | null;
  chunkCount: number;
  createdAt: string | null;
  updatedAt: string | null;
}

interface ApiResponse {
  documents: Document[];
  stats: Record<string, number>;
  pagination: {
    limit: number;
    offset: number;
    total: number;
  };
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  uploaded: { label: '업로드됨', color: 'bg-gray-100 text-gray-700' },
  processing: { label: '처리 중', color: 'bg-blue-100 text-blue-700' },
  chunked: { label: '청킹 완료', color: 'bg-purple-100 text-purple-700' },
  reviewing: { label: '검토 중', color: 'bg-yellow-100 text-yellow-700' },
  approved: { label: '승인됨', color: 'bg-green-100 text-green-700' },
  failed: { label: '실패', color: 'bg-red-100 text-red-700' },
};

const PROGRESS_LABELS: Record<string, string> = {
  parsing: '파싱 중',
  chunking: '청킹 중',
  embedding: '임베딩 생성 중',
  quality_check: '품질 검사 중',
};

export function DocumentsTable() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [stats, setStats] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [reprocessing, setReprocessing] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchDocuments = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filter) params.set('status', filter);

      const response = await fetch(`/api/admin/documents?${params}`);
      if (!response.ok) throw new Error('Failed to fetch documents');

      const data: ApiResponse = await response.json();
      setDocuments(data.documents);
      setStats(data.stats);
    } catch (error) {
      console.error('Error fetching documents:', error);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  // 자동 새로고침 (처리 중인 문서가 있을 때)
  useEffect(() => {
    const hasProcessing = documents.some((d) => d.status === 'processing');
    if (!hasProcessing) return;

    const interval = setInterval(fetchDocuments, 5000);
    return () => clearInterval(interval);
  }, [documents, fetchDocuments]);

  const handleSelectAll = () => {
    if (selectedIds.size === documents.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(documents.map((d) => d.id)));
    }
  };

  const handleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const handleReprocess = async (documentIds?: string[]) => {
    const ids = documentIds || Array.from(selectedIds);
    if (ids.length === 0) return;

    setReprocessing(true);
    setMessage(null);

    try {
      const response = await fetch('/api/admin/documents/reprocess', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentIds: ids }),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage({ type: 'success', text: data.message });
        setSelectedIds(new Set());
        fetchDocuments();
      } else {
        setMessage({ type: 'error', text: data.error || '재처리 요청 실패' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: '네트워크 오류' });
    } finally {
      setReprocessing(false);
    }
  };

  const handleReprocessAll = async () => {
    if (!confirm('모든 미처리/실패 문서를 재처리하시겠습니까?')) return;

    setReprocessing(true);
    setMessage(null);

    try {
      const response = await fetch('/api/admin/documents/reprocess', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reprocessAll: true }),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage({ type: 'success', text: data.message });
        fetchDocuments();
      } else {
        setMessage({ type: 'error', text: data.error || '재처리 요청 실패' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: '네트워크 오류' });
    } finally {
      setReprocessing(false);
    }
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return '-';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (date: string | null) => {
    if (!date) return '-';
    return new Date(date).toLocaleString('ko-KR', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const needsReprocessCount = (stats.uploaded || 0) + (stats.failed || 0);

  if (loading) {
    return <div className="text-center py-10">로딩 중...</div>;
  }

  return (
    <div className="space-y-4">
      {/* 상태 통계 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <StatCard
          label="전체"
          count={Object.values(stats).reduce((a, b) => a + b, 0)}
          active={filter === null}
          onClick={() => setFilter(null)}
        />
        {Object.entries(STATUS_LABELS).map(([status, { label }]) => (
          <StatCard
            key={status}
            label={label}
            count={stats[status] || 0}
            active={filter === status}
            onClick={() => setFilter(filter === status ? null : status)}
            status={status}
          />
        ))}
      </div>

      {/* 메시지 */}
      {message && (
        <div
          className={`p-4 rounded-lg ${
            message.type === 'success'
              ? 'bg-green-50 text-green-700 border border-green-200'
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* 액션 버튼 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {selectedIds.size > 0 && (
            <button
              onClick={() => handleReprocess()}
              disabled={reprocessing}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
            >
              {reprocessing ? (
                <LoadingSpinner />
              ) : (
                <RefreshIcon className="w-4 h-4" />
              )}
              선택 재처리 ({selectedIds.size})
            </button>
          )}
        </div>

        {needsReprocessCount > 0 && (
          <button
            onClick={handleReprocessAll}
            disabled={reprocessing}
            className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 flex items-center gap-2"
          >
            {reprocessing ? (
              <LoadingSpinner />
            ) : (
              <RefreshIcon className="w-4 h-4" />
            )}
            미처리 문서 전체 재처리 ({needsReprocessCount})
          </button>
        )}
      </div>

      {/* 문서 테이블 */}
      <div className="bg-white rounded-lg border overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left">
                <input
                  type="checkbox"
                  checked={selectedIds.size === documents.length && documents.length > 0}
                  onChange={handleSelectAll}
                  className="rounded border-gray-300"
                />
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                파일명
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                테넌트
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                상태
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                청크
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                크기
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                업로드
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                액션
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {documents.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-gray-500">
                  문서가 없습니다.
                </td>
              </tr>
            ) : (
              documents.map((doc) => (
                <tr key={doc.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(doc.id)}
                      onChange={() => handleSelect(doc.id)}
                      className="rounded border-gray-300"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <FileIcon type={doc.fileType} />
                      <div>
                        <p className="text-sm font-medium text-gray-900 truncate max-w-[200px]">
                          {doc.filename}
                        </p>
                        {doc.errorMessage && (
                          <p className="text-xs text-red-500 truncate max-w-[200px]">
                            {doc.errorMessage}
                          </p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {doc.tenantName || '-'}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge
                      status={doc.status}
                      progressStep={doc.progressStep}
                      progressPercent={doc.progressPercent}
                    />
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {doc.chunkCount}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {formatFileSize(doc.fileSize)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {formatDate(doc.createdAt)}
                  </td>
                  <td className="px-4 py-3">
                    {(doc.status === 'uploaded' ||
                      doc.status === 'failed' ||
                      doc.status === 'processing') && (
                      <button
                        onClick={() => handleReprocess([doc.id])}
                        disabled={reprocessing}
                        className="text-blue-600 hover:text-blue-800 disabled:opacity-50"
                        title="재처리"
                      >
                        <RefreshIcon className="w-5 h-5" />
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatCard({
  label,
  count,
  active,
  onClick,
  status,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
  status?: string;
}) {
  const statusConfig = status ? STATUS_LABELS[status] : null;

  return (
    <button
      onClick={onClick}
      className={`p-4 rounded-lg border text-left transition-all ${
        active
          ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
          : 'border-gray-200 bg-white hover:border-gray-300'
      }`}
    >
      <p className="text-2xl font-bold text-gray-900">{count}</p>
      <p className={`text-sm ${statusConfig ? '' : 'text-gray-500'}`}>
        {statusConfig && (
          <span
            className={`inline-block px-1.5 py-0.5 rounded text-xs ${statusConfig.color}`}
          >
            {label}
          </span>
        )}
        {!statusConfig && label}
      </p>
    </button>
  );
}

function StatusBadge({
  status,
  progressStep,
  progressPercent,
}: {
  status: string | null;
  progressStep: string | null;
  progressPercent: number | null;
}) {
  const config = status ? STATUS_LABELS[status] : STATUS_LABELS.uploaded;

  return (
    <div className="flex flex-col gap-1">
      <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${config.color}`}>
        {config.label}
      </span>
      {status === 'processing' && progressStep && (
        <div className="flex items-center gap-1">
          <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 transition-all"
              style={{ width: `${progressPercent || 0}%` }}
            />
          </div>
          <span className="text-xs text-gray-500">
            {PROGRESS_LABELS[progressStep] || progressStep}
          </span>
        </div>
      )}
    </div>
  );
}

function FileIcon({ type }: { type: string | null }) {
  const iconClass = 'w-8 h-8';

  switch (type) {
    case 'pdf':
      return (
        <div className={`${iconClass} bg-red-100 text-red-600 rounded flex items-center justify-center text-xs font-bold`}>
          PDF
        </div>
      );
    case 'docx':
    case 'doc':
      return (
        <div className={`${iconClass} bg-blue-100 text-blue-600 rounded flex items-center justify-center text-xs font-bold`}>
          DOC
        </div>
      );
    case 'txt':
      return (
        <div className={`${iconClass} bg-gray-100 text-gray-600 rounded flex items-center justify-center text-xs font-bold`}>
          TXT
        </div>
      );
    case 'csv':
      return (
        <div className={`${iconClass} bg-green-100 text-green-600 rounded flex items-center justify-center text-xs font-bold`}>
          CSV
        </div>
      );
    default:
      return (
        <div className={`${iconClass} bg-gray-100 text-gray-600 rounded flex items-center justify-center text-xs font-bold`}>
          FILE
        </div>
      );
  }
}

function RefreshIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
      />
    </svg>
  );
}

function LoadingSpinner() {
  return (
    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
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
