'use client';

/**
 * 문서 업로드 컴포넌트
 * [Week 9] 드래그앤드롭 파일 업로드
 */

import { useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';

const ALLOWED_TYPES = ['application/pdf', 'text/plain'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

interface UploadState {
  status: 'idle' | 'uploading' | 'success' | 'error';
  progress: number;
  message?: string;
}

export function DocumentUpload() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadState, setUploadState] = useState<UploadState>({
    status: 'idle',
    progress: 0,
  });

  const validateFile = (file: File): string | null => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      return 'PDF 또는 TXT 파일만 업로드할 수 있습니다.';
    }
    if (file.size > MAX_FILE_SIZE) {
      return '파일 크기는 10MB를 초과할 수 없습니다.';
    }
    return null;
  };

  const uploadFile = useCallback(async (file: File) => {
    const validationError = validateFile(file);
    if (validationError) {
      setUploadState({ status: 'error', progress: 0, message: validationError });
      return;
    }

    setUploadState({ status: 'uploading', progress: 0 });

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/documents/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || '업로드에 실패했습니다.');
      }

      setUploadState({
        status: 'success',
        progress: 100,
        message: '업로드가 완료되었습니다.',
      });

      // 페이지 새로고침하여 목록 갱신
      router.refresh();

      // 3초 후 상태 초기화
      setTimeout(() => {
        setUploadState({ status: 'idle', progress: 0 });
      }, 3000);
    } catch (error) {
      setUploadState({
        status: 'error',
        progress: 0,
        message: error instanceof Error ? error.message : '업로드에 실패했습니다.',
      });
    }
  }, [router]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      uploadFile(files[0]);
    }
  }, [uploadFile]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      uploadFile(files[0]);
    }
    // 같은 파일 재선택 가능하도록 초기화
    e.target.value = '';
  }, [uploadFile]);

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div
      onClick={handleClick}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`
        relative cursor-pointer rounded-lg border-2 border-dashed p-8 text-center transition-colors
        ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-white hover:border-gray-400'}
        ${uploadState.status === 'uploading' ? 'pointer-events-none' : ''}
      `}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.txt,application/pdf,text/plain"
        onChange={handleFileSelect}
        className="hidden"
      />

      {uploadState.status === 'idle' && (
        <>
          <UploadIcon className="mx-auto h-12 w-12 text-gray-400" />
          <p className="mt-4 text-lg font-medium text-gray-900">
            파일을 드래그하거나 클릭하여 업로드
          </p>
          <p className="mt-2 text-sm text-gray-500">
            PDF, TXT 파일 (최대 10MB)
          </p>
        </>
      )}

      {uploadState.status === 'uploading' && (
        <>
          <LoadingSpinner className="mx-auto h-12 w-12 text-blue-500" />
          <p className="mt-4 text-lg font-medium text-gray-900">업로드 중...</p>
          <div className="mx-auto mt-4 h-2 w-64 overflow-hidden rounded-full bg-gray-200">
            <div
              className="h-full bg-blue-500 transition-all duration-300"
              style={{ width: `${uploadState.progress}%` }}
            />
          </div>
        </>
      )}

      {uploadState.status === 'success' && (
        <>
          <CheckIcon className="mx-auto h-12 w-12 text-green-500" />
          <p className="mt-4 text-lg font-medium text-green-700">
            {uploadState.message}
          </p>
        </>
      )}

      {uploadState.status === 'error' && (
        <>
          <ErrorIcon className="mx-auto h-12 w-12 text-red-500" />
          <p className="mt-4 text-lg font-medium text-red-700">
            {uploadState.message}
          </p>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setUploadState({ status: 'idle', progress: 0 });
            }}
            className="mt-4 text-sm text-blue-600 hover:text-blue-700"
          >
            다시 시도
          </button>
        </>
      )}
    </div>
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
