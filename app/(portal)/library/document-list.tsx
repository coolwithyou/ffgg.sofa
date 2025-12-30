'use client';

/**
 * 라이브러리 문서 목록 컴포넌트
 * 라이브러리(데이터셋 미배치) 문서 표시
 */

import { useState } from 'react';
import type { LibraryDocument, LibraryChunk, DatasetOption } from './actions';
import { getLibraryChunks } from './actions';
import { ChunkSelector } from './chunk-selector';

interface LibraryDocumentListProps {
  documents: LibraryDocument[];
  datasets: DatasetOption[];
}

export function LibraryDocumentList({ documents: initialDocuments, datasets }: LibraryDocumentListProps) {
  const [documents] = useState(initialDocuments);
  const [selectedDocument, setSelectedDocument] = useState<LibraryDocument | null>(null);
  const [chunks, setChunks] = useState<LibraryChunk[]>([]);
  const [isLoadingChunks, setIsLoadingChunks] = useState(false);

  const handleDocumentClick = async (doc: LibraryDocument) => {
    if (selectedDocument?.id === doc.id) {
      setSelectedDocument(null);
      setChunks([]);
      return;
    }

    setSelectedDocument(doc);
    setIsLoadingChunks(true);

    try {
      const chunkList = await getLibraryChunks(doc.id);
      setChunks(chunkList);
    } catch (error) {
      console.error('청크 로딩 실패:', error);
      alert('청크를 불러오는데 실패했습니다.');
    } finally {
      setIsLoadingChunks(false);
    }
  };

  if (documents.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-12 text-center">
        <LibraryIcon className="mx-auto h-12 w-12 text-muted-foreground" />
        <h3 className="mt-4 text-lg font-medium text-foreground">라이브러리가 비어있습니다</h3>
        <p className="mt-2 text-muted-foreground">
          문서 관리에서 &quot;라이브러리에 저장&quot; 옵션으로 문서를 업로드하면 이곳에 표시됩니다.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* 문서 목록 */}
      <div className="rounded-lg border border-border bg-card">
        <div className="border-b border-border px-6 py-4">
          <h2 className="text-lg font-semibold text-foreground">
            라이브러리 문서 ({documents.length})
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            문서를 클릭하여 청크를 확인하고 데이터셋에 복사하세요
          </p>
        </div>

        <div className="divide-y divide-border">
          {documents.map((doc) => (
            <button
              key={doc.id}
              onClick={() => handleDocumentClick(doc)}
              className={`w-full px-6 py-4 text-left transition-colors ${
                selectedDocument?.id === doc.id
                  ? 'bg-primary/10'
                  : 'hover:bg-muted/50'
              }`}
            >
              <div className="flex items-center gap-4">
                <FileTypeIcon fileType={doc.fileType} />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground truncate">{doc.filename}</p>
                  <div className="mt-1 flex items-center gap-3 text-sm text-muted-foreground">
                    <span>{formatFileSize(doc.fileSize)}</span>
                    <span>•</span>
                    <span>{doc.chunkCount}개 청크</span>
                    <span>•</span>
                    <StatusBadge status={doc.status} />
                  </div>
                </div>
                <ChevronIcon
                  className={`h-5 w-5 text-muted-foreground transition-transform ${
                    selectedDocument?.id === doc.id ? 'rotate-180' : ''
                  }`}
                />
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* 청크 선택 패널 */}
      <div className="rounded-lg border border-border bg-card">
        {!selectedDocument ? (
          <div className="flex h-full min-h-[400px] items-center justify-center p-8 text-center">
            <div>
              <DocumentIcon className="mx-auto h-12 w-12 text-muted-foreground" />
              <p className="mt-4 text-muted-foreground">
                왼쪽에서 문서를 선택하면 청크가 표시됩니다
              </p>
            </div>
          </div>
        ) : isLoadingChunks ? (
          <div className="flex h-full min-h-[400px] items-center justify-center">
            <LoadingSpinner className="h-8 w-8 text-primary" />
          </div>
        ) : (
          <ChunkSelector
            document={selectedDocument}
            chunks={chunks}
            datasets={datasets}
          />
        )}
      </div>
    </div>
  );
}

// 상태 배지
function StatusBadge({ status }: { status: string }) {
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
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${className}`}>
      {label}
    </span>
  );
}

// 파일 타입 아이콘
function FileTypeIcon({ fileType }: { fileType: string | null }) {
  const isPdf = fileType?.includes('pdf');

  return (
    <div
      className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg ${
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

// 아이콘 컴포넌트들
function LibraryIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z"
      />
    </svg>
  );
}

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

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
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
