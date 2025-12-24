/**
 * 로딩 컴포넌트들
 * [Week 11] UI 안정화
 */

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function Spinner({ size = 'md', className = '' }: SpinnerProps) {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-6 w-6',
    lg: 'h-8 w-8',
  };

  return (
    <div
      className={`animate-spin rounded-full border-2 border-current border-t-transparent ${sizeClasses[size]} ${className}`}
      role="status"
      aria-label="로딩 중"
    />
  );
}

interface LoadingOverlayProps {
  message?: string;
}

export function LoadingOverlay({ message = '로딩 중...' }: LoadingOverlayProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20">
      <div className="rounded-lg bg-white p-6 shadow-xl">
        <div className="flex items-center gap-3">
          <Spinner size="lg" className="text-orange-500" />
          <span className="text-gray-700">{message}</span>
        </div>
      </div>
    </div>
  );
}

interface PageLoadingProps {
  message?: string;
}

export function PageLoading({ message = '페이지를 불러오는 중...' }: PageLoadingProps) {
  return (
    <div className="flex min-h-[400px] items-center justify-center">
      <div className="text-center">
        <Spinner size="lg" className="mx-auto text-orange-500" />
        <p className="mt-4 text-gray-600">{message}</p>
      </div>
    </div>
  );
}

export function ButtonLoading() {
  return <Spinner size="sm" className="text-white" />;
}
