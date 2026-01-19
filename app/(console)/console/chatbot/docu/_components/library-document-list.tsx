'use client';

/**
 * 라이브러리 문서 목록 컴포넌트
 * 모든 문서 표시 (배치됨/미배치 구분)
 */

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import type { LibraryDocument, DatasetOption } from '../actions';
import { DocumentMapper } from './document-mapper';
import { DocumentStatusBadge } from '@/components/ui/document-status-badge';

type FilterType = 'all' | 'assigned' | 'unassigned';

interface LibraryDocumentListProps {
  documents: LibraryDocument[];
  datasets: DatasetOption[];
}

export function LibraryDocumentList({ documents: initialDocuments, datasets }: LibraryDocumentListProps) {
  const router = useRouter();
  const [documents] = useState(initialDocuments);
  const [selectedDocument, setSelectedDocument] = useState<LibraryDocument | null>(null);
  const [filter, setFilter] = useState<FilterType>('all');

  // 필터링된 문서 목록
  const filteredDocuments = useMemo(() => {
    switch (filter) {
      case 'assigned':
        return documents.filter((doc) => doc.datasetId !== null);
      case 'unassigned':
        return documents.filter((doc) => doc.datasetId === null);
      default:
        return documents;
    }
  }, [documents, filter]);

  // 각 필터별 문서 개수
  const counts = useMemo(() => ({
    all: documents.length,
    assigned: documents.filter((doc) => doc.datasetId !== null).length,
    unassigned: documents.filter((doc) => doc.datasetId === null).length,
  }), [documents]);

  const handleDocumentClick = (doc: LibraryDocument) => {
    if (selectedDocument?.id === doc.id) {
      setSelectedDocument(null);
      return;
    }
    setSelectedDocument(doc);
  };

  const handleMappingSuccess = () => {
    setSelectedDocument(null);
    router.refresh();
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
            문서 목록
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            문서를 클릭하여 청크를 확인하고 데이터셋에 복사하세요
          </p>
        </div>

        {/* 필터 탭 */}
        <div className="flex border-b border-border">
          <FilterTab
            label="전체"
            count={counts.all}
            isActive={filter === 'all'}
            onClick={() => setFilter('all')}
          />
          <FilterTab
            label="배치됨"
            count={counts.assigned}
            isActive={filter === 'assigned'}
            onClick={() => setFilter('assigned')}
          />
          <FilterTab
            label="미배치"
            count={counts.unassigned}
            isActive={filter === 'unassigned'}
            onClick={() => setFilter('unassigned')}
          />
        </div>

        <div className="divide-y divide-border max-h-[600px] overflow-y-auto">
          {filteredDocuments.length === 0 ? (
            <div className="px-6 py-8 text-center text-muted-foreground">
              {filter === 'assigned' && '배치된 문서가 없습니다.'}
              {filter === 'unassigned' && '미배치 문서가 없습니다.'}
              {filter === 'all' && '문서가 없습니다.'}
            </div>
          ) : (
            filteredDocuments.map((doc) => (
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
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-foreground truncate">{doc.filename}</p>
                      <DatasetBadge datasetName={doc.datasetName} />
                    </div>
                    <div className="mt-1 flex items-center gap-3 text-sm text-muted-foreground">
                      <span>{formatFileSize(doc.fileSize)}</span>
                      <span>•</span>
                      <span>{doc.chunkCount}개 청크</span>
                      <span>•</span>
                      <DocumentStatusBadge status={doc.status} />
                    </div>
                  </div>
                  <ChevronIcon
                    className={`h-5 w-5 text-muted-foreground transition-transform ${
                      selectedDocument?.id === doc.id ? 'rotate-180' : ''
                    }`}
                  />
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* 문서 맵핑 패널 */}
      <div className="rounded-lg border border-border bg-card">
        <DocumentMapper
          document={selectedDocument}
          datasets={datasets}
          onSuccess={handleMappingSuccess}
        />
      </div>
    </div>
  );
}

// 필터 탭 컴포넌트
function FilterTab({
  label,
  count,
  isActive,
  onClick,
}: {
  label: string;
  count: number;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
        isActive
          ? 'border-b-2 border-primary text-primary'
          : 'text-muted-foreground hover:text-foreground'
      }`}
    >
      {label} ({count})
    </button>
  );
}

// 데이터셋 배치 상태 배지
function DatasetBadge({ datasetName }: { datasetName: string | null }) {
  if (datasetName) {
    return (
      <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
        {datasetName}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
      미배치
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

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  );
}
