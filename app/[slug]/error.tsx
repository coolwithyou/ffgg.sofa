'use client';

/**
 * 공개 페이지 Error Boundary
 * 슬러그 기반 공개 페이지에서 발생하는 에러를 처리합니다.
 */

import { useEffect } from 'react';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function PublicPageError({ error, reset }: ErrorProps) {
  useEffect(() => {
    // 에러 로깅
    console.error('Public Page Error Boundary:', error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-muted">
          <svg
            className="h-10 w-10 text-muted-foreground"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>

        <h1 className="mb-3 text-2xl font-semibold text-foreground">
          페이지를 불러올 수 없습니다
        </h1>
        <p className="mb-8 text-muted-foreground">
          일시적인 문제가 발생했습니다.
          <br />
          잠시 후 다시 시도해주세요.
        </p>

        <button
          onClick={reset}
          className="inline-flex items-center justify-center rounded-full bg-primary px-8 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          새로고침
        </button>
      </div>
    </div>
  );
}
