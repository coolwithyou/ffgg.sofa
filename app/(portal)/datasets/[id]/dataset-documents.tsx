/**
 * 데이터셋 문서 목록 컴포넌트 (2열 레이아웃)
 * 1열: 문서 목록 + 검색
 * 2열: 선택된 문서의 청크 목록 + 검색
 */

'use client';

import { useState, useEffect, useTransition, useMemo } from 'react';
import Link from 'next/link';
import { FileText, Trash2, RotateCcw, ExternalLink, Search, X, Unlink } from 'lucide-react';
import { DocumentProgressModal } from '@/components/document-progress-modal';
import { DocumentChunks } from './document-chunks';
import { unassignDocumentFromDataset } from '@/app/(portal)/library/actions';
import { useAlertDialog } from '@/components/ui/alert-dialog';

interface DocumentItem {
  id: string;
  filename: string;
  fileSize: number | null;
  fileType: string | null;
  status: string;
  chunkCount: number;
  approvedCount: number;
  progressPercent: number | null;
  errorMessage: string | null;
  createdAt: string;
}

interface DatasetDocumentsProps {
  datasetId: string;
  onUpdate: () => void;
}

export function DatasetDocuments({ datasetId, onUpdate }: DatasetDocumentsProps) {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [reprocessingId, setReprocessingId] = useState<string | null>(null);
  const [unassigningId, setUnassigningId] = useState<string | null>(null);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
  const [progressModalDocId, setProgressModalDocId] = useState<string | null>(null);
  const [documentSearch, setDocumentSearch] = useState('');
  const { confirm } = useAlertDialog();

  useEffect(() => {
    fetchDocuments();
  }, [datasetId]);

  // 처리 중인 문서 폴링
  useEffect(() => {
    const processingDocs = documents.filter(
      (d) => d.status === 'processing' || d.status === 'uploaded'
    );

    if (processingDocs.length === 0) return;

    const interval = setInterval(() => {
      fetchDocuments();
    }, 3000);

    return () => clearInterval(interval);
  }, [documents]);

  // 첫 번째 문서 자동 선택
  useEffect(() => {
    if (documents.length > 0 && !selectedDocumentId) {
      setSelectedDocumentId(documents[0].id);
    }
  }, [documents, selectedDocumentId]);

  const fetchDocuments = async () => {
    try {
      const response = await fetch(`/api/datasets/${datasetId}/documents`);
      if (response.ok) {
        const data = await response.json();
        setDocuments(data.documents);
      }
    } catch (err) {
      console.error('Failed to fetch documents:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // 문서 검색 필터링
  const filteredDocuments = useMemo(() => {
    if (!documentSearch.trim()) return documents;
    const search = documentSearch.toLowerCase();
    return documents.filter((doc) =>
      doc.filename.toLowerCase().includes(search)
    );
  }, [documents, documentSearch]);

  const handleDelete = async (documentId: string) => {
    const confirmed = await confirm({
      title: '문서 삭제',
      message: '이 문서를 삭제하시겠습니까? 관련된 모든 청크도 함께 삭제됩니다.',
      confirmText: '삭제',
      cancelText: '취소',
      variant: 'destructive',
    });

    if (!confirmed) {
      return;
    }

    setDeletingId(documentId);

    startTransition(async () => {
      try {
        const response = await fetch(`/api/documents/${documentId}`, {
          method: 'DELETE',
        });

        if (response.ok) {
          setDocuments((prev) => prev.filter((d) => d.id !== documentId));
          if (selectedDocumentId === documentId) {
            setSelectedDocumentId(null);
          }
          onUpdate();
        } else {
          alert('삭제에 실패했습니다.');
        }
      } catch (err) {
        console.error('Delete error:', err);
        alert('삭제 중 오류가 발생했습니다.');
      } finally {
        setDeletingId(null);
      }
    });
  };

  const handleReprocess = async (documentId: string) => {
    setReprocessingId(documentId);

    startTransition(async () => {
      try {
        const response = await fetch(`/api/documents/${documentId}/reprocess`, {
          method: 'POST',
        });

        if (response.ok) {
          setDocuments((prev) =>
            prev.map((d) =>
              d.id === documentId
                ? { ...d, status: 'processing', progressPercent: 0, errorMessage: null }
                : d
            )
          );
        } else {
          alert('재처리 요청에 실패했습니다.');
        }
      } catch (err) {
        console.error('Reprocess error:', err);
        alert('재처리 요청 중 오류가 발생했습니다.');
      } finally {
        setReprocessingId(null);
      }
    });
  };

  const handleUnassign = async (documentId: string) => {
    const confirmed = await confirm({
      title: '배치 해제',
      message: '이 문서를 데이터셋에서 배치 해제하시겠습니까? 문서는 삭제되지 않고 라이브러리로 이동됩니다.',
      confirmText: '배치 해제',
      cancelText: '취소',
    });

    if (!confirmed) {
      return;
    }

    setUnassigningId(documentId);

    startTransition(async () => {
      try {
        const result = await unassignDocumentFromDataset(documentId);

        if (result.success) {
          setDocuments((prev) => prev.filter((d) => d.id !== documentId));
          if (selectedDocumentId === documentId) {
            setSelectedDocumentId(null);
          }
          onUpdate();
        } else {
          alert(result.error || '배치 해제에 실패했습니다.');
        }
      } catch (err) {
        console.error('Unassign error:', err);
        alert('배치 해제 중 오류가 발생했습니다.');
      } finally {
        setUnassigningId(null);
      }
    });
  };

  const selectedDocument = documents.find((d) => d.id === selectedDocumentId);

  if (isLoading) {
    return (
      <div className="rounded-lg border border-border bg-card p-8">
        <div className="flex items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <span className="ml-2 text-muted-foreground">문서 목록 로딩 중...</span>
        </div>
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-12 text-center">
        <FileText className="mx-auto h-12 w-12 text-muted-foreground" />
        <h3 className="mt-4 text-lg font-medium text-foreground">문서가 없습니다</h3>
        <p className="mt-2 text-muted-foreground">
          이 데이터셋에 업로드된 문서가 없습니다.
        </p>
        <Link
          href={`/documents?datasetId=${datasetId}`}
          className="mt-4 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          문서 업로드하기
        </Link>
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* 1열: 문서 목록 */}
      <div className="rounded-lg border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-base font-semibold text-foreground">
            문서 목록 ({documents.length})
          </h2>
          <Link
            href={`/documents?datasetId=${datasetId}`}
            className="flex items-center gap-1 text-sm text-primary hover:underline"
          >
            업로드
            <ExternalLink className="h-3 w-3" />
          </Link>
        </div>

        {/* 문서 검색 */}
        <div className="border-b border-border px-4 py-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="파일명으로 검색..."
              value={documentSearch}
              onChange={(e) => setDocumentSearch(e.target.value)}
              className="w-full rounded-md border border-border bg-background py-2 pl-9 pr-9 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
            {documentSearch && (
              <button
                onClick={() => setDocumentSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* 문서 목록 */}
        <div className="max-h-[600px] divide-y divide-border overflow-y-auto">
          {filteredDocuments.length === 0 ? (
            <div className="px-4 py-8 text-center text-muted-foreground">
              {documentSearch ? '검색 결과가 없습니다.' : '문서가 없습니다.'}
            </div>
          ) : (
            filteredDocuments.map((doc) => (
              <button
                key={doc.id}
                onClick={() => setSelectedDocumentId(doc.id)}
                className={`w-full px-4 py-3 text-left transition-colors ${
                  selectedDocumentId === doc.id
                    ? 'bg-primary/10'
                    : 'hover:bg-muted/50'
                }`}
              >
                <div className="flex items-start gap-3">
                  <FileTypeIcon fileType={doc.fileType} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-foreground">{doc.filename}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                      <span>{formatFileSize(doc.fileSize)}</span>
                      <span>•</span>
                      <span>청크 {doc.chunkCount}개</span>
                      {doc.approvedCount > 0 && (
                        <>
                          <span>•</span>
                          <span className="text-green-500">승인 {doc.approvedCount}</span>
                        </>
                      )}
                    </div>
                    <div className="mt-1.5 flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setProgressModalDocId(doc.id);
                        }}
                        className="hover:opacity-80"
                        title="처리 상태 상세 보기"
                      >
                        <StatusBadge
                          status={doc.status}
                          progressPercent={doc.progressPercent}
                          errorMessage={doc.errorMessage}
                        />
                      </button>
                    </div>
                  </div>

                  {/* 액션 버튼 */}
                  <div className="flex flex-shrink-0 items-center gap-1">
                    {['uploaded', 'failed'].includes(doc.status) && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleReprocess(doc.id);
                        }}
                        disabled={isPending || reprocessingId === doc.id}
                        className="rounded p-1.5 text-muted-foreground hover:bg-primary/10 hover:text-primary disabled:opacity-50"
                        title="재처리"
                      >
                        {reprocessingId === doc.id ? (
                          <LoadingSpinner className="h-4 w-4" />
                        ) : (
                          <RotateCcw className="h-4 w-4" />
                        )}
                      </button>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleUnassign(doc.id);
                      }}
                      disabled={isPending || unassigningId === doc.id}
                      className="rounded p-1.5 text-muted-foreground hover:bg-yellow-500/10 hover:text-yellow-500 disabled:opacity-50"
                      title="배치 해제"
                    >
                      {unassigningId === doc.id ? (
                        <LoadingSpinner className="h-4 w-4" />
                      ) : (
                        <Unlink className="h-4 w-4" />
                      )}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(doc.id);
                      }}
                      disabled={isPending || deletingId === doc.id}
                      className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                      title="삭제"
                    >
                      {deletingId === doc.id ? (
                        <LoadingSpinner className="h-4 w-4" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* 2열: 청크 목록 */}
      <div className="rounded-lg border border-border bg-card">
        {selectedDocument ? (
          <>
            <div className="border-b border-border px-4 py-3">
              <h2 className="text-base font-semibold text-foreground">
                청크 목록
              </h2>
              <p className="mt-0.5 truncate text-sm text-muted-foreground">
                {selectedDocument.filename}
              </p>
            </div>
            <div className="max-h-[600px] overflow-y-auto p-4">
              <DocumentChunks
                documentId={selectedDocumentId!}
                onChunkUpdate={() => {
                  fetchDocuments();
                  onUpdate();
                }}
                showSearch
              />
            </div>
          </>
        ) : (
          <div className="flex h-full items-center justify-center p-12 text-center text-muted-foreground">
            <div>
              <FileText className="mx-auto h-12 w-12 opacity-50" />
              <p className="mt-4">문서를 선택하면 청크 목록이 표시됩니다</p>
            </div>
          </div>
        )}
      </div>

      {/* 문서 처리 상태 모달 */}
      {progressModalDocId && (
        <DocumentProgressModal
          documentId={progressModalDocId}
          isOpen={!!progressModalDocId}
          onClose={() => setProgressModalDocId(null)}
          onReprocess={() => {
            handleReprocess(progressModalDocId);
            setProgressModalDocId(null);
          }}
        />
      )}
    </div>
  );
}

// 상태 배지 컴포넌트
function StatusBadge({
  status,
  progressPercent,
  errorMessage,
}: {
  status: string;
  progressPercent: number | null;
  errorMessage: string | null;
}) {
  const config: Record<string, { label: string; className: string }> = {
    uploaded: { label: '업로드됨', className: 'bg-muted text-muted-foreground' },
    processing: { label: '처리중', className: 'bg-primary/10 text-primary' },
    chunked: { label: '청킹완료', className: 'bg-purple-500/10 text-purple-500' },
    reviewing: { label: '검토중', className: 'bg-yellow-500/10 text-yellow-500' },
    approved: { label: '승인됨', className: 'bg-green-500/10 text-green-500' },
    failed: { label: '실패', className: 'bg-destructive/10 text-destructive' },
  };

  const { label, className } = config[status] || {
    label: status,
    className: 'bg-muted text-muted-foreground',
  };

  return (
    <div className="flex items-center gap-1">
      <span
        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${className}`}
        title={errorMessage || undefined}
      >
        {label}
        {status === 'processing' && progressPercent !== null && (
          <span className="ml-1">({progressPercent}%)</span>
        )}
      </span>
      {status === 'failed' && errorMessage && (
        <span className="text-xs text-destructive" title={errorMessage}>
          ⚠️
        </span>
      )}
    </div>
  );
}

// 파일 타입 아이콘
function FileTypeIcon({ fileType }: { fileType: string | null }) {
  const isPdf = fileType?.includes('pdf');

  return (
    <div
      className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg ${
        isPdf ? 'bg-red-500/10' : 'bg-primary/10'
      }`}
    >
      {isPdf ? (
        <span className="text-xs font-bold text-red-500">PDF</span>
      ) : (
        <span className="text-xs font-bold text-primary">TXT</span>
      )}
    </div>
  );
}

// 유틸리티 함수
function formatFileSize(bytes: number | null): string {
  if (bytes === null) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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
