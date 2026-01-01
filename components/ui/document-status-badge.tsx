'use client';

/**
 * 문서 처리 상태 배지 컴포넌트
 * 모든 문서 목록 페이지에서 일관된 상태 표시를 위해 사용
 */

import { cn } from '@/lib/utils';

export type DocumentStatus =
  | 'uploaded'
  | 'processing'
  | 'chunked'
  | 'reviewing'
  | 'approved'
  | 'failed';

interface DocumentStatusBadgeProps {
  status: DocumentStatus | string;
  className?: string;
  /** 클릭 가능 상태일 때 true (자동 감지 가능) */
  clickable?: boolean;
  /** 처리 진행률 (processing 상태일 때) */
  progressPercent?: number | null;
  /** 에러 메시지 (failed 상태일 때 아이콘 표시) */
  errorMessage?: string | null;
  /** 클릭 핸들러 */
  onClick?: () => void;
}

const STATUS_CONFIG: Record<
  DocumentStatus,
  { label: string; className: string }
> = {
  uploaded: {
    label: '업로드됨',
    className: 'bg-muted text-muted-foreground',
  },
  processing: {
    label: '처리중',
    className: 'bg-primary/10 text-primary',
  },
  chunked: {
    label: '청킹완료',
    className: 'bg-purple-500/10 text-purple-500',
  },
  reviewing: {
    label: '검토중',
    className: 'bg-yellow-500/10 text-yellow-500',
  },
  approved: {
    label: '승인됨',
    className: 'bg-green-500/10 text-green-500',
  },
  failed: {
    label: '실패',
    className: 'bg-destructive/10 text-destructive',
  },
};

/**
 * 클릭 가능한 상태인지 확인
 * processing, uploaded, failed 상태에서 모달을 열 수 있음
 */
export function isClickableStatus(status: string): boolean {
  return ['processing', 'uploaded', 'failed'].includes(status);
}

export function DocumentStatusBadge({
  status,
  className,
  clickable,
  progressPercent,
  errorMessage,
  onClick,
}: DocumentStatusBadgeProps) {
  const config = STATUS_CONFIG[status as DocumentStatus] || {
    label: status,
    className: 'bg-muted text-muted-foreground',
  };

  // clickable이 명시되지 않으면 자동 감지
  const isClickable = clickable ?? isClickableStatus(status);

  return (
    <div
      className={cn(
        'flex items-center gap-2',
        isClickable && onClick && 'cursor-pointer'
      )}
      onClick={isClickable && onClick ? onClick : undefined}
    >
      <span
        className={cn(
          'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
          config.className,
          isClickable && onClick && 'hover:ring-2 hover:ring-offset-1 hover:ring-primary/30',
          className
        )}
        title={isClickable ? '클릭하여 처리 상태 보기' : (errorMessage || undefined)}
      >
        {config.label}
        {status === 'processing' && progressPercent != null && (
          <span className="ml-1">({progressPercent}%)</span>
        )}
      </span>
      {status === 'failed' && errorMessage && (
        <span className="text-xs text-destructive" title={errorMessage}>
          ⚠️
        </span>
      )}
    </div>
  );
}
