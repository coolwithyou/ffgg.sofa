'use client';

/**
 * 템플릿 다운로드 컴포넌트
 * FAQ, 가이드 문서 템플릿을 다운로드할 수 있는 UI
 */

import { useState } from 'react';

interface Template {
  id: string;
  name: string;
  description: string;
  filename: string;
  format: 'md' | 'csv';
  icon: React.ReactNode;
}

const TEMPLATES: Template[] = [
  {
    id: 'faq-md',
    name: 'FAQ 템플릿',
    description: 'Q&A 형식의 Markdown 문서. 가장 높은 품질 점수를 받을 수 있습니다.',
    filename: 'faq-template.md',
    format: 'md',
    icon: <MarkdownIcon />,
  },
  {
    id: 'faq-csv',
    name: 'FAQ 템플릿 (CSV)',
    description: 'Excel이나 Google Sheets에서 편집 가능한 스프레드시트 형식입니다.',
    filename: 'faq-template.csv',
    format: 'csv',
    icon: <SpreadsheetIcon />,
  },
  {
    id: 'guide-md',
    name: '가이드 문서 템플릿',
    description: '정책, 매뉴얼, 사용 가이드 작성에 적합한 구조화된 문서입니다.',
    filename: 'guide-document.md',
    format: 'md',
    icon: <DocumentIcon />,
  },
];

export function TemplateDownload() {
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const handleDownload = async (template: Template) => {
    setDownloadingId(template.id);

    try {
      // 정적 파일 다운로드
      const response = await fetch(`/templates/${template.filename}`);
      const blob = await response.blob();

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = template.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('템플릿 다운로드 실패:', error);
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="border-b border-border px-6 py-4">
        <h2 className="text-lg font-semibold text-foreground">템플릿 다운로드</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          템플릿을 다운로드하여 내용을 채운 후 업로드하세요.
        </p>
      </div>

      <div className="grid gap-4 p-6">
        {TEMPLATES.map((template) => (
          <div
            key={template.id}
            className="group relative rounded-lg border border-border bg-background p-4 transition-colors hover:border-primary/30 hover:bg-muted/30"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                {template.icon}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-medium text-foreground">{template.name}</h3>
                  <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase text-muted-foreground">
                    {template.format}
                  </span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                  {template.description}
                </p>
              </div>
            </div>

            <button
              onClick={() => handleDownload(template)}
              disabled={downloadingId === template.id}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
            >
              {downloadingId === template.id ? (
                <>
                  <LoadingSpinner />
                  다운로드 중...
                </>
              ) : (
                <>
                  <DownloadIcon />
                  다운로드
                </>
              )}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// 아이콘 컴포넌트들
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

function SpreadsheetIcon() {
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

function DocumentIcon() {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
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
