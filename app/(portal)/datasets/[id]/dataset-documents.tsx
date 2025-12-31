/**
 * 데이터셋 문서 목록 컴포넌트
 */

'use client';

import { useState, useEffect, useTransition } from 'react';
import Link from 'next/link';
import { FileText, Trash2, RotateCcw, ExternalLink } from 'lucide-react';
import { DocumentProgressModal } from '@/components/document-progress-modal';

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
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);

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

  const handleDelete = async (documentId: string) => {
    if (!confirm('이 문서를 삭제하시겠습니까? 관련된 모든 청크도 함께 삭제됩니다.')) {
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
    <div className="rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-6 py-4">
        <h2 className="text-lg font-semibold text-foreground">
          문서 목록 ({documents.length})
        </h2>
        <Link
          href={`/documents?datasetId=${datasetId}`}
          className="flex items-center gap-1 text-sm text-primary hover:underline"
        >
          문서 업로드
          <ExternalLink className="h-3 w-3" />
        </Link>
      </div>

      <div className="divide-y divide-border">
        {documents.map((doc) => (
          <div
            key={doc.id}
            className="flex items-center justify-between px-6 py-4 hover:bg-muted/50"
          >
            <div className="flex items-center gap-4">
              <FileTypeIcon fileType={doc.fileType} />
              <div>
                <p className="font-medium text-foreground">{doc.filename}</p>
                <div className="mt-1 flex items-center gap-3 text-sm text-muted-foreground">
                  <span>{formatFileSize(doc.fileSize)}</span>
                  <span>•</span>
                  <span>청크 {doc.chunkCount}개</span>
                  {doc.approvedCount > 0 && (
                    <>
                      <span>•</span>
                      <span className="text-green-500">승인 {doc.approvedCount}개</span>
                    </>
                  )}
                  <span>•</span>
                  <span>{formatDate(doc.createdAt)}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4">
              {/* 클릭하면 진행 상태 모달 표시 */}
              <button
                onClick={() => setSelectedDocumentId(doc.id)}
                className="cursor-pointer hover:opacity-80"
                title="처리 상태 상세 보기"
              >
                <StatusBadge
                  status={doc.status}
                  progressPercent={doc.progressPercent}
                  errorMessage={doc.errorMessage}
                />
              </button>

              {/* 재처리 버튼 */}
              {['uploaded', 'failed'].includes(doc.status) && (
                <button
                  onClick={() => handleReprocess(doc.id)}
                  disabled={isPending || reprocessingId === doc.id}
                  className="rounded p-2 text-muted-foreground hover:bg-primary/10 hover:text-primary disabled:opacity-50"
                  title="재처리"
                >
                  {reprocessingId === doc.id ? (
                    <LoadingSpinner className="h-5 w-5" />
                  ) : (
                    <RotateCcw className="h-5 w-5" />
                  )}
                </button>
              )}

              {/* 삭제 버튼 */}
              <button
                onClick={() => handleDelete(doc.id)}
                disabled={isPending || deletingId === doc.id}
                className="rounded p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                title="삭제"
              >
                {deletingId === doc.id ? (
                  <LoadingSpinner className="h-5 w-5" />
                ) : (
                  <Trash2 className="h-5 w-5" />
                )}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* 문서 처리 상태 모달 */}
      {selectedDocumentId && (
        <DocumentProgressModal
          documentId={selectedDocumentId}
          isOpen={!!selectedDocumentId}
          onClose={() => setSelectedDocumentId(null)}
          onReprocess={() => {
            handleReprocess(selectedDocumentId);
            setSelectedDocumentId(null);
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
    <div className="flex items-center gap-2">
      <span
        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${className}`}
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
      className={`flex h-10 w-10 items-center justify-center rounded-lg ${
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

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
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
