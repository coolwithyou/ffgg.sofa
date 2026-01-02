'use client';

/**
 * 일괄 액션 바
 * Console 마이그레이션
 */

interface ReviewActionsProps {
  selectedCount: number;
  onApprove: () => void;
  onReject: () => void;
  onClear: () => void;
  isPending: boolean;
}

export function ReviewActions({
  selectedCount,
  onApprove,
  onReject,
  onClear,
  isPending,
}: ReviewActionsProps) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-primary/30 bg-primary/10 px-4 py-3">
      <span className="text-sm font-medium text-primary">
        {selectedCount}개 선택됨
      </span>
      <div className="flex items-center gap-2">
        <button
          onClick={onApprove}
          disabled={isPending}
          className="inline-flex items-center gap-1.5 rounded-md bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
        >
          <CheckIcon className="h-4 w-4" />
          일괄 승인
        </button>
        <button
          onClick={onReject}
          disabled={isPending}
          className="inline-flex items-center gap-1.5 rounded-md bg-destructive px-3 py-1.5 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
        >
          <XIcon className="h-4 w-4" />
          일괄 거부
        </button>
        <button
          onClick={onClear}
          className="rounded-md px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary/20"
        >
          선택 해제
        </button>
      </div>
    </div>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M5 13l4 4L19 7"
      />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M6 18L18 6M6 6l12 12"
      />
    </svg>
  );
}
