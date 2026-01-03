'use client';

import { useAutoSaveContext } from '../hooks/use-auto-save';
import { Check, Loader2, AlertCircle, Circle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * 저장 상태 표시 인디케이터
 *
 * 상태별 표시:
 * - saved: 녹색 체크 + "저장됨"
 * - saving: 스피너 + "저장 중..."
 * - error: 빨간색 경고 + "저장 오류" + 재시도 버튼
 * - unsaved: 회색 점 + "저장되지 않음"
 */
export function SaveStatusIndicator() {
  const { saveStatus, error, retry } = useAutoSaveContext();

  const config = {
    saved: {
      icon: Check,
      text: '저장됨',
      className: 'text-green-500',
    },
    saving: {
      icon: Loader2,
      text: '저장 중...',
      className: 'text-muted-foreground',
      iconClassName: 'animate-spin',
    },
    error: {
      icon: AlertCircle,
      text: '저장 오류',
      className: 'text-destructive',
    },
    unsaved: {
      icon: Circle,
      text: '저장되지 않음',
      className: 'text-muted-foreground',
    },
  };

  const current = config[saveStatus];
  const Icon = current.icon;

  // 에러 상태일 때 확장된 UI
  if (saveStatus === 'error' && error) {
    return (
      <div className="flex items-center gap-2">
        <div
          className={cn('flex items-center gap-1.5 text-sm', current.className)}
          title={`${error.message}${error.retryCount > 0 ? ` (재시도 ${error.retryCount}회 실패)` : ''}`}
        >
          <Icon className="h-4 w-4" />
          <span>{current.text}</span>
        </div>

        {error.canRetry && (
          <Button
            variant="ghost"
            size="sm"
            onClick={retry}
            className="h-7 gap-1 px-2 text-xs"
          >
            <RefreshCw className="h-3 w-3" />
            재시도
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className={cn('flex items-center gap-1.5 text-sm', current.className)}>
      <Icon
        className={cn(
          'h-4 w-4',
          'iconClassName' in current && current.iconClassName
        )}
      />
      <span>{current.text}</span>
    </div>
  );
}
