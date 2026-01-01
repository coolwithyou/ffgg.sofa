'use client';

/**
 * 문서 처리 상태 배지 컴포넌트
 * 모든 문서 목록 페이지에서 일관된 상태 표시를 위해 사용
 */

import { cn } from '@/lib/utils';
import { isDocumentStalled } from '@/lib/constants/document';

export type DocumentStatus =
  | 'uploaded'
  | 'processing'
  | 'stalled'
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
  /** 마지막 업데이트 시각 (stalled 판단용) */
  updatedAt?: string | null;
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
  stalled: {
    label: '중단됨',
    className: 'bg-orange-500/10 text-orange-500',
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
 * processing, stalled, uploaded, failed 상태에서 모달을 열 수 있음
 */
export function isClickableStatus(status: string): boolean {
  return ['processing', 'stalled', 'uploaded', 'failed'].includes(status);
}

export function DocumentStatusBadge({
  status,
  className,
  clickable,
  progressPercent,
  errorMessage,
  updatedAt,
  onClick,
}: DocumentStatusBadgeProps) {
  // stalled 상태 감지: processing 상태에서 5분 이상 업데이트 없으면 stalled로 표시
  const isStalled = isDocumentStalled(status, updatedAt);
  const effectiveStatus = isStalled ? 'stalled' : status;

  const config = STATUS_CONFIG[effectiveStatus as DocumentStatus] || {
    label: status,
    className: 'bg-muted text-muted-foreground',
  };

  // clickable이 명시되지 않으면 자동 감지
  const isClickable = clickable ?? isClickableStatus(effectiveStatus);

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
        title={
          isStalled
            ? '처리가 중단되었습니다. 재시작하려면 클릭하세요.'
            : isClickable
              ? '클릭하여 처리 상태 보기'
              : (errorMessage || undefined)
        }
      >
        {config.label}
        {status === 'processing' && !isStalled && progressPercent != null && (
          <span className="ml-1">({progressPercent}%)</span>
        )}
      </span>
      {isStalled && (
        <span className="text-xs text-orange-500" title="서버 재시작 등으로 처리가 중단되었습니다">
          ⏸️
        </span>
      )}
      {status === 'failed' && errorMessage && (
        <span className="text-xs text-destructive" title={errorMessage}>
          ⚠️
        </span>
      )}
    </div>
  );
}
