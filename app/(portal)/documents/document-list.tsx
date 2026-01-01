'use client';

/**
 * 문서 목록 컴포넌트
 * [Week 9] 문서 목록 표시 및 삭제
 */

import { useState, useEffect, useTransition } from 'react';
import { deleteDocument, reprocessDocument, refreshDocumentStatus, type DocumentItem } from './actions';
import { DocumentProgressModal } from '@/components/document-progress-modal';
import { useAlertDialog } from '@/components/ui/alert-dialog';

interface DocumentListProps {
  documents: DocumentItem[];
}

export function DocumentList({ documents: initialDocuments }: DocumentListProps) {
  const [documents, setDocuments] = useState(initialDocuments);
  const [isPending, startTransition] = useTransition();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [reprocessingId, setReprocessingId] = useState<string | null>(null);
  const [progressModalDocId, setProgressModalDocId] = useState<string | null>(null);
  const { confirm } = useAlertDialog();

  // 처리 중인 문서 폴링
  useEffect(() => {
    const processingDocs = documents.filter(
      (d) => d.status === 'processing' || d.status === 'uploaded'
    );

    if (processingDocs.length === 0) return;

    const interval = setInterval(() => {
      processingDocs.forEach(async (doc) => {
        const updated = await refreshDocumentStatus(doc.id);
        if (updated && updated.status !== doc.status) {
          setDocuments((prev) =>
            prev.map((d) =>
              d.id === doc.id
                ? { ...d, ...updated }
                : d
            )
          );
        }
      });
    }, 3000);

    return () => clearInterval(interval);
  }, [documents]);

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
      const result = await deleteDocument(documentId);

      if (result.success) {
        setDocuments((prev) => prev.filter((d) => d.id !== documentId));
      } else {
        alert(result.error || '삭제에 실패했습니다.');
      }

      setDeletingId(null);
    });
  };

  const handleReprocess = async (documentId: string) => {
    setReprocessingId(documentId);

    startTransition(async () => {
      const result = await reprocessDocument(documentId);

      if (result.success) {
        // 상태를 processing으로 업데이트
        setDocuments((prev) =>
          prev.map((d) =>
            d.id === documentId
              ? { ...d, status: 'processing', progressPercent: 0, errorMessage: null }
              : d
          )
        );
      } else {
        alert(result.error || '재처리 요청에 실패했습니다.');
      }

      setReprocessingId(null);
    });
  };

  if (documents.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-12 text-center">
        <DocumentIcon className="mx-auto h-12 w-12 text-muted-foreground" />
        <h3 className="mt-4 text-lg font-medium text-foreground">문서가 없습니다</h3>
        <p className="mt-2 text-muted-foreground">
          위의 업로드 영역에 파일을 드래그하거나 클릭하여 문서를 추가하세요.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-lg border border-border bg-card">
        <div className="border-b border-border px-6 py-4">
          <h2 className="text-lg font-semibold text-foreground">
            업로드된 문서 ({documents.length})
          </h2>
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
                  <span>{formatDate(doc.createdAt)}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <StatusBadge
                status={doc.status}
                progressPercent={doc.progressPercent}
                errorMessage={doc.errorMessage}
                onClick={() => {
                  // processing, uploaded, failed 상태에서 모달 열기
                  if (['processing', 'uploaded', 'failed'].includes(doc.status)) {
                    setProgressModalDocId(doc.id);
                  }
                }}
              />

              {/* 재처리 버튼 - uploaded 또는 failed 상태에서만 표시 */}
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
                    <RefreshIcon className="h-5 w-5" />
                  )}
                </button>
              )}

              <button
                onClick={() => handleDelete(doc.id)}
                disabled={isPending || deletingId === doc.id}
                className="rounded p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                title="삭제"
              >
                {deletingId === doc.id ? (
                  <LoadingSpinner className="h-5 w-5" />
                ) : (
                  <TrashIcon className="h-5 w-5" />
                )}
              </button>
            </div>
          </div>
        ))}
        </div>
      </div>

      {/* 처리 상태 모달 */}
      {progressModalDocId && (
        <DocumentProgressModal
          documentId={progressModalDocId}
          isOpen={true}
          onClose={() => setProgressModalDocId(null)}
          onReprocess={() => handleReprocess(progressModalDocId)}
        />
      )}
    </>
  );
}

// 상태 배지 컴포넌트
function StatusBadge({
  status,
  progressPercent,
  errorMessage,
  onClick,
}: {
  status: string;
  progressPercent: number | null;
  errorMessage: string | null;
  onClick?: () => void;
}) {
  const isClickable = ['processing', 'uploaded', 'failed'].includes(status);
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
    <div
      className={`flex items-center gap-2 ${isClickable ? 'cursor-pointer' : ''}`}
      onClick={isClickable ? onClick : undefined}
    >
      <span
        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${className} ${isClickable ? 'hover:ring-2 hover:ring-offset-1 hover:ring-primary/30' : ''}`}
        title={isClickable ? '클릭하여 처리 상태 보기' : (errorMessage || undefined)}
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
    hour: '2-digit',
    minute: '2-digit',
  });
}

// 아이콘 컴포넌트들
function DocumentIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
      />
    </svg>
  );
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
      />
    </svg>
  );
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
