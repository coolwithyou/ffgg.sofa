'use client';

/**
 * 내보내기 모달 컴포넌트
 * Markdown, CSV 다운로드 및 문서로 직접 업로드
 * Console 마이그레이션 - router.push 경로 업데이트
 */

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { exportAsDocument } from './actions';
import { generateMarkdown, generateCSV, type Category, type QAPair } from './utils';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  draftId: string | null;
  draftName: string;
  categories: Category[];
  qaPairs: QAPair[];
  onSave: () => Promise<void>;
}

type ExportFormat = 'markdown' | 'csv' | 'document';

export function ExportModal({
  isOpen,
  onClose,
  draftId,
  draftName,
  categories,
  qaPairs,
  onSave,
}: ExportModalProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('markdown');
  const [isExporting, setIsExporting] = useState(false);
  const [exportResult, setExportResult] = useState<{
    success: boolean;
    message: string;
    documentId?: string;
  } | null>(null);

  if (!isOpen) return null;

  const handleDownload = (format: 'markdown' | 'csv') => {
    let content: string;
    let filename: string;
    let mimeType: string;

    if (format === 'markdown') {
      content = generateMarkdown(categories, qaPairs);
      filename = `${draftName.replace(/[^a-zA-Z0-9가-힣]/g, '_')}.md`;
      mimeType = 'text/markdown';
    } else {
      content = generateCSV(categories, qaPairs);
      filename = `${draftName.replace(/[^a-zA-Z0-9가-힣]/g, '_')}.csv`;
      mimeType = 'text/csv';
    }

    const blob = new Blob([content], { type: mimeType });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);

    setExportResult({
      success: true,
      message: `${filename} 파일이 다운로드되었습니다.`,
    });
  };

  const handleExportAsDocument = async () => {
    setIsExporting(true);
    setExportResult(null);

    try {
      // 먼저 저장
      await onSave();

      if (!draftId) {
        throw new Error('FAQ를 먼저 저장해주세요.');
      }

      // 문서로 내보내기
      const result = await exportAsDocument(draftId);

      setExportResult({
        success: true,
        message: '문서가 성공적으로 생성되었습니다.',
        documentId: result.documentId,
      });

      // 3초 후 문서 관리 페이지로 이동 (Console 경로로 업데이트)
      setTimeout(() => {
        router.push('/console/chatbot');
      }, 2000);
    } catch (error) {
      setExportResult({
        success: false,
        message: error instanceof Error ? error.message : '내보내기에 실패했습니다.',
      });
    } finally {
      setIsExporting(false);
    }
  };

  const exportOptions = [
    {
      id: 'markdown' as const,
      title: 'Markdown 다운로드',
      description: 'Q&A 형식의 Markdown 파일로 다운로드합니다.',
      icon: <MarkdownIcon />,
    },
    {
      id: 'csv' as const,
      title: 'CSV 다운로드',
      description: 'Excel이나 Google Sheets에서 열 수 있는 CSV 파일로 다운로드합니다.',
      icon: <CSVIcon />,
    },
    {
      id: 'document' as const,
      title: '문서로 직접 업로드',
      description: 'FAQ를 바로 학습용 문서로 변환하여 업로드합니다.',
      icon: <UploadIcon />,
      badge: '추천',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* 오버레이 */}
      <div
        className="absolute inset-0 bg-background/80 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* 모달 */}
      <div className="relative z-10 mx-4 w-full max-w-lg rounded-lg border border-border bg-card shadow-lg">
        {/* 헤더 */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="text-lg font-semibold text-foreground">FAQ 내보내기</h2>
          <button
            onClick={onClose}
            className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <CloseIcon />
          </button>
        </div>

        {/* 본문 */}
        <div className="p-6">
          {/* 요약 */}
          <div className="mb-6 rounded-lg bg-muted/50 p-4">
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{draftName}</span> ·{' '}
              {categories.length}개 카테고리 · {qaPairs.length}개 Q&A
            </p>
          </div>

          {/* 내보내기 옵션 */}
          <div className="space-y-3">
            {exportOptions.map((option) => (
              <button
                key={option.id}
                onClick={() => setSelectedFormat(option.id)}
                className={`flex w-full items-start gap-4 rounded-lg border p-4 text-left transition-colors ${
                  selectedFormat === option.id
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-muted-foreground hover:bg-muted/30'
                }`}
              >
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                    selectedFormat === option.id
                      ? 'bg-primary/10 text-primary'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {option.icon}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-foreground">{option.title}</p>
                    {option.badge && (
                      <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                        {option.badge}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {option.description}
                  </p>
                </div>
                <div
                  className={`h-5 w-5 rounded-full border-2 ${
                    selectedFormat === option.id
                      ? 'border-primary bg-primary'
                      : 'border-muted-foreground'
                  }`}
                >
                  {selectedFormat === option.id && (
                    <CheckIcon className="h-full w-full text-primary-foreground" />
                  )}
                </div>
              </button>
            ))}
          </div>

          {/* 결과 메시지 */}
          {exportResult && (
            <div
              className={`mt-4 rounded-lg p-4 ${
                exportResult.success
                  ? 'bg-green-500/10 text-green-500'
                  : 'bg-destructive/10 text-destructive'
              }`}
            >
              <p className="text-sm">{exportResult.message}</p>
              {exportResult.documentId && (
                <p className="mt-1 text-xs">
                  잠시 후 문서 관리 페이지로 이동합니다...
                </p>
              )}
            </div>
          )}
        </div>

        {/* 푸터 */}
        <div className="flex justify-end gap-3 border-t border-border px-6 py-4">
          <button
            onClick={onClose}
            disabled={isExporting}
            className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
          >
            취소
          </button>
          <button
            onClick={() => {
              if (selectedFormat === 'document') {
                handleExportAsDocument();
              } else {
                handleDownload(selectedFormat);
              }
            }}
            disabled={isExporting || qaPairs.length === 0}
            className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {isExporting ? (
              <>
                <LoadingSpinner />
                처리 중...
              </>
            ) : selectedFormat === 'document' ? (
              <>
                <UploadIcon />
                문서로 업로드
              </>
            ) : (
              <>
                <DownloadIcon />
                다운로드
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// 아이콘 컴포넌트들
function CloseIcon() {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M6 18L18 6M6 6l12 12"
      />
    </svg>
  );
}

function MarkdownIcon() {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"
      />
    </svg>
  );
}

function CSVIcon() {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
      />
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
      />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
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
        strokeWidth={3}
        d="M5 13l4 4L19 7"
      />
    </svg>
  );
}

function LoadingSpinner() {
  return (
    <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
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
