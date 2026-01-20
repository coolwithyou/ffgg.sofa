'use client';

/**
 * Console Error Boundary
 * Console 내 모든 페이지에서 발생하는 에러를 처리합니다.
 */

import { useEffect } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import Link from 'next/link';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ConsoleError({ error, reset }: ErrorProps) {
  useEffect(() => {
    // 에러 로깅
    console.error('Console Error Boundary:', error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center p-8">
      <div className="w-full max-w-lg rounded-xl border border-border bg-card p-8 text-center shadow-lg">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
          <AlertTriangle className="h-8 w-8 text-destructive" />
        </div>

        <h1 className="mb-2 text-2xl font-semibold text-foreground">
          문제가 발생했습니다
        </h1>
        <p className="mb-6 text-muted-foreground">
          Console에서 예상치 못한 오류가 발생했습니다.
          <br />
          작업 내용이 저장되지 않았을 수 있습니다.
        </p>

        {/* 개발 환경에서만 에러 상세 표시 */}
        {process.env.NODE_ENV === 'development' && (
          <details className="mb-6 text-left">
            <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
              에러 상세 보기
            </summary>
            <pre className="mt-2 overflow-auto rounded-md bg-muted p-3 text-xs text-muted-foreground">
              {error.message}
              {error.stack && (
                <>
                  {'\n\n'}
                  {error.stack}
                </>
              )}
            </pre>
          </details>
        )}

        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button
            onClick={reset}
            className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <RefreshCw className="h-4 w-4" />
            다시 시도
          </button>
          <Link
            href="/console"
            className="inline-flex items-center justify-center gap-2 rounded-md border border-border px-6 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            <Home className="h-4 w-4" />
            대시보드로
          </Link>
        </div>
      </div>
    </div>
  );
}
