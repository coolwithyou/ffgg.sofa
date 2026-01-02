'use client';

/**
 * 문서 업로드 컴포넌트
 * [Week 9] 드래그앤드롭 파일 업로드
 * [Week 13] 업로드 전 미리보기 기능 추가
 * [Week 14] 데이터셋 선택 기능 추가
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ChevronDown, Database, Library } from 'lucide-react';
import { PreviewModal } from './preview-modal';
import { DocumentProgressModal } from '@/components/document-progress-modal';

interface DatasetOption {
  id: string;
  name: string;
  isDefault: boolean;
}

const ALLOWED_TYPES = [
  'application/pdf',
  'text/plain',
  'text/markdown',
  'text/csv',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];
const ALLOWED_EXTENSIONS = ['.pdf', '.txt', '.md', '.csv', '.docx'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

interface UploadState {
  status: 'idle' | 'previewing' | 'uploading' | 'success' | 'error';
  progress: number;
  message?: string;
}

interface PreviewData {
  structure: {
    hasQAPairs: boolean;
    hasHeaders: boolean;
    hasTables: boolean;
    hasLists: boolean;
  };
  chunks: Array<{
    index: number;
    content: string;
    contentPreview: string;
    qualityScore: number;
    metadata: {
      isQAPair: boolean;
      hasHeader: boolean;
      isTable: boolean;
      isList: boolean;
    };
    autoApproved: boolean;
  }>;
  summary: {
    totalChunks: number;
    avgQualityScore: number;
    autoApprovedCount: number;
    pendingCount: number;
    warnings: Array<{
      type: 'too_short' | 'too_long' | 'incomplete_qa' | 'low_quality';
      count: number;
      message: string;
    }>;
  };
}

export function DocumentUpload() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadState, setUploadState] = useState<UploadState>({
    status: 'idle',
    progress: 0,
  });

  // 저장 위치 선택 상태
  const [destination, setDestination] = useState<'dataset' | 'library'>('dataset');

  // 데이터셋 선택 상태
  const [datasets, setDatasets] = useState<DatasetOption[]>([]);
  const [selectedDatasetId, setSelectedDatasetId] = useState<string | null>(null);
  const [showDatasetDropdown, setShowDatasetDropdown] = useState(false);
  const [isLoadingDatasets, setIsLoadingDatasets] = useState(true);

  // 미리보기 관련 상태
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  // 처리 상태 모달 관련 상태
  const [uploadedDocumentId, setUploadedDocumentId] = useState<string | null>(null);
  const [showProgressModal, setShowProgressModal] = useState(false);

  // 데이터셋 목록 로드
  useEffect(() => {
    async function fetchDatasets() {
      try {
        const response = await fetch('/api/datasets');
        if (response.ok) {
          const data = await response.json();
          setDatasets(data.datasets || []);

          // URL 파라미터에 datasetId가 있으면 해당 데이터셋 선택
          const urlDatasetId = searchParams.get('datasetId');
          if (urlDatasetId) {
            const exists = data.datasets?.some((d: DatasetOption) => d.id === urlDatasetId);
            if (exists) {
              setSelectedDatasetId(urlDatasetId);
            }
          }

          // 없으면 기본 데이터셋 선택
          if (!selectedDatasetId) {
            const defaultDataset = data.datasets?.find((d: DatasetOption) => d.isDefault);
            if (defaultDataset) {
              setSelectedDatasetId(defaultDataset.id);
            } else if (data.datasets?.length > 0) {
              setSelectedDatasetId(data.datasets[0].id);
            }
          }
        }
      } catch (err) {
        console.error('Failed to fetch datasets:', err);
      } finally {
        setIsLoadingDatasets(false);
      }
    }
    fetchDatasets();
  }, [searchParams]);

  const selectedDataset = datasets.find((d) => d.id === selectedDatasetId);

  const validateFile = (file: File): string | null => {
    // MIME 타입 또는 확장자로 검증
    const extension = '.' + file.name.split('.').pop()?.toLowerCase();
    const isValidType = ALLOWED_TYPES.includes(file.type);
    const isValidExtension = ALLOWED_EXTENSIONS.includes(extension);

    if (!isValidType && !isValidExtension) {
      return 'PDF, TXT, MD, CSV, DOCX 파일만 업로드할 수 있습니다.';
    }
    if (file.size > MAX_FILE_SIZE) {
      return '파일 크기는 10MB를 초과할 수 없습니다.';
    }
    return null;
  };

  // 미리보기 API 호출
  const fetchPreview = useCallback(async (file: File) => {
    const validationError = validateFile(file);
    if (validationError) {
      setUploadState({ status: 'error', progress: 0, message: validationError });
      return;
    }

    setSelectedFile(file);
    setUploadState({ status: 'previewing', progress: 0, message: '분석 중...' });

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/documents/preview', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || '미리보기 생성에 실패했습니다.');
      }

      const data = await response.json();
      setPreviewData(data.preview);
      setShowPreview(true);
      setUploadState({ status: 'idle', progress: 0 });
    } catch (error) {
      setUploadState({
        status: 'error',
        progress: 0,
        message: error instanceof Error ? error.message : '미리보기 생성에 실패했습니다.',
      });
      setSelectedFile(null);
    }
  }, []);

  // 실제 업로드 실행
  const uploadFile = useCallback(async () => {
    if (!selectedFile) return;

    setShowPreview(false);
    setUploadState({ status: 'uploading', progress: 0 });

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('destination', destination);
      if (destination === 'dataset' && selectedDatasetId) {
        formData.append('datasetId', selectedDatasetId);
      }

      const response = await fetch('/api/documents/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || '업로드에 실패했습니다.');
      }

      const result = await response.json();
      const documentId = result.data?.id;

      // 상태 초기화
      setUploadState({ status: 'idle', progress: 0 });
      setSelectedFile(null);
      setPreviewData(null);

      // 문서 처리 상태 모달 표시
      if (documentId) {
        setUploadedDocumentId(documentId);
        setShowProgressModal(true);
      }

      // 페이지 새로고침하여 목록 갱신
      router.refresh();
    } catch (error) {
      setUploadState({
        status: 'error',
        progress: 0,
        message: error instanceof Error ? error.message : '업로드에 실패했습니다.',
      });
    }
  }, [selectedFile, selectedDatasetId, destination, router]);

  const handleClosePreview = useCallback(() => {
    setShowPreview(false);
    setSelectedFile(null);
    setPreviewData(null);
    setUploadState({ status: 'idle', progress: 0 });
  }, []);

  const handleCloseProgressModal = useCallback(() => {
    setShowProgressModal(false);
    setUploadedDocumentId(null);
    router.refresh(); // 모달 닫을 때 목록 갱신
  }, [router]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) {
        fetchPreview(files[0]);
      }
    },
    [fetchPreview]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        fetchPreview(files[0]);
      }
      // 같은 파일 재선택 가능하도록 초기화
      e.target.value = '';
    },
    [fetchPreview]
  );

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <>
      {/* 업로드 설정 카드 */}
      <div className="rounded-lg border border-border bg-card p-6">
        {/* 저장 위치 선택 - 탭 스타일 */}
        <div className="mb-6">
          <label className="mb-3 block text-sm font-medium text-foreground">
            저장 위치
          </label>
          <div className="flex rounded-lg border border-border bg-muted p-1">
            <button
              type="button"
              onClick={() => setDestination('dataset')}
              className={`flex flex-1 items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm font-medium transition-colors ${
                destination === 'dataset'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Database className="h-4 w-4" />
              데이터셋에 저장
            </button>
            <button
              type="button"
              onClick={() => setDestination('library')}
              className={`flex flex-1 items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm font-medium transition-colors ${
                destination === 'library'
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Library className="h-4 w-4" />
              라이브러리에 저장
            </button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {destination === 'dataset'
              ? '문서가 선택한 데이터셋에 바로 추가되어 챗봇 검색에 활용됩니다.'
              : '문서가 라이브러리에 저장되고, 나중에 청크를 원하는 데이터셋에 복사할 수 있습니다.'}
          </p>
        </div>

        {/* 데이터셋 선택 (destination이 'dataset'일 때만 표시) */}
        {destination === 'dataset' && (
          <div>
            <label className="mb-2 block text-sm font-medium text-foreground">
              업로드할 데이터셋
            </label>
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowDatasetDropdown(!showDatasetDropdown)}
                disabled={isLoadingDatasets || datasets.length === 0}
                className="flex w-full items-center justify-between rounded-md border border-border bg-background px-4 py-2.5 text-left text-sm text-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
              >
                <div className="flex items-center gap-2">
                  <Database className="h-4 w-4 text-muted-foreground" />
                  {isLoadingDatasets ? (
                    <span className="text-muted-foreground">로딩 중...</span>
                  ) : selectedDataset ? (
                    <span>
                      {selectedDataset.name}
                      {selectedDataset.isDefault && (
                        <span className="ml-2 text-xs text-muted-foreground">(기본)</span>
                      )}
                    </span>
                  ) : datasets.length === 0 ? (
                    <span className="text-muted-foreground">데이터셋이 없습니다</span>
                  ) : (
                    <span className="text-muted-foreground">데이터셋 선택</span>
                  )}
                </div>
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </button>

              {showDatasetDropdown && datasets.length > 0 && (
                <div className="absolute z-10 mt-1 w-full rounded-md border border-border bg-card shadow-lg">
                  <div className="max-h-60 overflow-auto py-1">
                    {datasets.map((dataset) => (
                      <button
                        key={dataset.id}
                        type="button"
                        onClick={() => {
                          setSelectedDatasetId(dataset.id);
                          setShowDatasetDropdown(false);
                        }}
                        className={`flex w-full items-center gap-2 px-4 py-2 text-left text-sm hover:bg-muted ${
                          selectedDatasetId === dataset.id
                            ? 'bg-primary/10 text-primary'
                            : 'text-foreground'
                        }`}
                      >
                        <Database className="h-4 w-4" />
                        <span>{dataset.name}</span>
                        {dataset.isDefault && (
                          <span className="ml-auto text-xs text-muted-foreground">(기본)</span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            {datasets.length === 0 && !isLoadingDatasets && (
              <p className="mt-2 text-sm text-muted-foreground">
                먼저 <a href="/console/chatbot/datasets" className="text-primary hover:underline">데이터셋을 생성</a>하세요.
              </p>
            )}
          </div>
        )}
      </div>

      {/* 드래그 앤 드롭 영역 */}
      <div
        onClick={handleClick}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          relative mt-6 cursor-pointer rounded-lg border-2 border-dashed p-8 text-center transition-colors
          ${isDragging ? 'border-primary bg-primary/5' : 'border-border bg-card hover:border-muted-foreground'}
          ${uploadState.status === 'uploading' || uploadState.status === 'previewing' ? 'pointer-events-none' : ''}
          ${destination === 'dataset' && datasets.length === 0 ? 'pointer-events-none opacity-50' : ''}
        `}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.txt,.md,.csv,.docx,application/pdf,text/plain,text/markdown,text/csv,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          onChange={handleFileSelect}
          className="hidden"
          disabled={destination === 'dataset' && datasets.length === 0}
        />

        {uploadState.status === 'idle' && (
          <>
            <UploadIcon className="mx-auto h-12 w-12 text-muted-foreground" />
            <p className="mt-4 text-lg font-medium text-foreground">
              파일을 드래그하거나 클릭하여 업로드
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              PDF, TXT, MD, CSV, DOCX 파일 (최대 10MB)
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              업로드 전 품질 미리보기를 제공합니다
            </p>
          </>
        )}

        {uploadState.status === 'previewing' && (
          <>
            <AnalyzeIcon className="mx-auto h-12 w-12 text-primary" />
            <p className="mt-4 text-lg font-medium text-foreground">문서 분석 중...</p>
            <p className="mt-2 text-sm text-muted-foreground">
              청킹 결과와 품질 점수를 계산하고 있습니다
            </p>
          </>
        )}

        {uploadState.status === 'uploading' && (
          <>
            <LoadingSpinner className="mx-auto h-12 w-12 text-primary" />
            <p className="mt-4 text-lg font-medium text-foreground">업로드 중...</p>
            <div className="mx-auto mt-4 h-2 w-64 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${uploadState.progress}%` }}
              />
            </div>
          </>
        )}

        {uploadState.status === 'success' && (
          <>
            <CheckIcon className="mx-auto h-12 w-12 text-green-500" />
            <p className="mt-4 text-lg font-medium text-green-500">{uploadState.message}</p>
          </>
        )}

        {uploadState.status === 'error' && (
          <>
            <ErrorIcon className="mx-auto h-12 w-12 text-destructive" />
            <p className="mt-4 text-lg font-medium text-destructive">{uploadState.message}</p>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setUploadState({ status: 'idle', progress: 0 });
                setSelectedFile(null);
                setPreviewData(null);
              }}
              className="mt-4 text-sm text-primary hover:text-primary/80"
            >
              다시 시도
            </button>
          </>
        )}
      </div>

      {/* 미리보기 모달 */}
      <PreviewModal
        isOpen={showPreview}
        onClose={handleClosePreview}
        onConfirm={uploadFile}
        previewData={previewData}
        filename={selectedFile?.name || ''}
        isUploading={uploadState.status === 'uploading'}
      />

      {/* 처리 상태 모달 */}
      {uploadedDocumentId && (
        <DocumentProgressModal
          documentId={uploadedDocumentId}
          isOpen={showProgressModal}
          onClose={handleCloseProgressModal}
        />
      )}
    </>
  );
}

// 아이콘 컴포넌트들
function UploadIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
      />
    </svg>
  );
}

function AnalyzeIcon({ className }: { className?: string }) {
  return (
    <svg className={`animate-pulse ${className}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
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

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}

function ErrorIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}
