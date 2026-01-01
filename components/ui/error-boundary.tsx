'use client';

/**
 * 에러 바운더리 컴포넌트
 * [Week 11] UI 안정화
 */

import { Component, ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: { componentStack: string }) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: { componentStack: string }): void {
    // 에러 로깅
    console.error('ErrorBoundary caught an error:', error, errorInfo);

    // 커스텀 에러 핸들러 호출
    this.props.onError?.(error, errorInfo);
  }

  handleRetry = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex min-h-[200px] items-center justify-center rounded-lg border border-red-200 bg-red-50 p-6">
          <div className="text-center">
            <div className="mb-4 flex justify-center">
              <ErrorIcon className="h-12 w-12 text-red-500" />
            </div>
            <h3 className="mb-2 text-lg font-semibold text-gray-900">
              오류가 발생했습니다
            </h3>
            <p className="mb-4 text-sm text-gray-600">
              페이지를 불러오는 중 문제가 발생했습니다.
            </p>
            <button
              onClick={this.handleRetry}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
            >
              다시 시도
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

function ErrorIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
      />
    </svg>
  );
}

/**
 * 전역 에러 페이지 컴포넌트
 */
interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export function GlobalError({ error, reset }: GlobalErrorProps) {
  return (
    <html>
      <body>
        <div className="flex min-h-screen items-center justify-center bg-gray-100">
          <div className="rounded-lg bg-white p-8 shadow-lg">
            <div className="mb-4 flex justify-center">
              <ErrorIcon className="h-16 w-16 text-red-500" />
            </div>
            <h1 className="mb-2 text-center text-xl font-bold text-gray-900">
              서비스 오류
            </h1>
            <p className="mb-6 text-center text-gray-600">
              서비스에 일시적인 문제가 발생했습니다.
              <br />
              잠시 후 다시 시도해주세요.
            </p>
            <div className="flex justify-center">
              <button
                onClick={reset}
                className="rounded-lg bg-orange-600 px-6 py-2 font-medium text-white hover:bg-orange-700"
              >
                다시 시도
              </button>
            </div>
            {process.env.NODE_ENV === 'development' && error.digest && (
              <p className="mt-4 text-center text-xs text-gray-400">
                Error ID: {error.digest}
              </p>
            )}
          </div>
        </div>
      </body>
    </html>
  );
}

/**
 * 페이지 레벨 에러 컴포넌트
 */
interface PageErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export function PageError({ error, reset }: PageErrorProps) {
  return (
    <div className="flex min-h-[400px] items-center justify-center">
      <div className="text-center">
        <div className="mb-4 flex justify-center">
          <ErrorIcon className="h-16 w-16 text-red-500" />
        </div>
        <h2 className="mb-2 text-xl font-bold text-gray-900">
          페이지를 불러올 수 없습니다
        </h2>
        <p className="mb-6 text-gray-600">
          문제가 지속되면 관리자에게 문의해주세요.
        </p>
        <button
          onClick={reset}
          className="rounded-lg bg-orange-600 px-6 py-2 font-medium text-white hover:bg-orange-700"
        >
          다시 시도
        </button>
        {process.env.NODE_ENV === 'development' && (
          <details className="mt-4 text-left">
            <summary className="cursor-pointer text-sm text-gray-500">
              에러 상세 정보
            </summary>
            <pre className="mt-2 overflow-auto rounded bg-muted p-4 text-xs text-destructive">
              {error.message}
              {error.stack && `\n\n${error.stack}`}
            </pre>
          </details>
        )}
      </div>
    </div>
  );
}
