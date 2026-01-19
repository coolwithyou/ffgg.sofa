'use client';

/**
 * 채팅 에러 메시지 컴포넌트
 *
 * 에러 발생 시 메시지와 재시도 버튼을 표시
 * - 에러 코드별 맞춤 메시지
 * - 재시도 버튼
 * - 컴팩트/풀 사이즈 모드
 */

import { RotateCcw, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ErrorCode = 'INSUFFICIENT_POINTS' | 'RATE_LIMIT' | 'VALIDATION_ERROR';

export interface ChatError {
  message: string;
  code?: ErrorCode;
}

interface ErrorMessageProps {
  error: ChatError;
  onRetry?: () => void;
  isRetrying?: boolean;
  /** 컴팩트 모드 (위젯용) */
  compact?: boolean;
  /** 프라이머리 색상 (위젯 테마용) */
  primaryColor?: string;
}

/**
 * 에러 코드별 추가 메시지
 */
function getErrorHint(code?: ErrorCode): string | null {
  switch (code) {
    case 'INSUFFICIENT_POINTS':
      return '서비스 이용이 일시적으로 제한되었습니다.';
    case 'RATE_LIMIT':
      return '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.';
    case 'VALIDATION_ERROR':
      return '입력 내용을 확인해주세요.';
    default:
      return null;
  }
}

/**
 * 재시도 가능한 에러인지 판단
 */
function isRetryable(code?: ErrorCode): boolean {
  // VALIDATION_ERROR는 재시도해도 동일한 결과
  return code !== 'VALIDATION_ERROR';
}

export function ErrorMessage({
  error,
  onRetry,
  isRetrying = false,
  compact = false,
  primaryColor,
}: ErrorMessageProps) {
  const hint = getErrorHint(error.code);
  const canRetry = isRetryable(error.code) && onRetry;

  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-lg bg-destructive/10 text-destructive',
        compact ? 'p-3 text-sm' : 'p-4'
      )}
    >
      <AlertCircle className={cn('flex-shrink-0', compact ? 'h-4 w-4' : 'h-5 w-5')} />

      <div className="flex-1 space-y-1">
        <p className={compact ? 'text-sm' : 'text-sm font-medium'}>{error.message}</p>
        {hint && (
          <p className={cn('opacity-80', compact ? 'text-xs' : 'text-sm')}>{hint}</p>
        )}
      </div>

      {canRetry && (
        <button
          onClick={onRetry}
          disabled={isRetrying}
          className={cn(
            'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
            'bg-destructive/20 hover:bg-destructive/30',
            'disabled:opacity-50 disabled:cursor-not-allowed'
          )}
          style={primaryColor ? { color: primaryColor } : undefined}
        >
          <RotateCcw className={cn('h-4 w-4', isRetrying && 'animate-spin')} />
          {isRetrying ? '재시도 중...' : '다시 시도'}
        </button>
      )}
    </div>
  );
}
