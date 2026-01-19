'use client';

/**
 * 메시지 액션 컴포넌트
 *
 * AI 응답 메시지에 표시되는 피드백/액션 버튼들
 * - 복사: 메시지 내용을 클립보드에 복사
 * - 좋아요/싫어요: 응답 품질 피드백
 * - 재생성: 응답 다시 생성 (선택적)
 */

import { useState, useCallback } from 'react';
import { Copy, Check, ThumbsUp, ThumbsDown, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface MessageActionsProps {
  /** 메시지 ID (피드백 전송용) */
  messageId: string;
  /** 메시지 내용 (복사용) */
  content: string;
  /** 재생성 콜백 (없으면 버튼 숨김) */
  onRegenerate?: () => void;
  /** 피드백 콜백 (없으면 로컬 상태만 관리) */
  onFeedback?: (messageId: string, feedback: 'up' | 'down') => Promise<void>;
  /** 컴팩트 모드 (위젯용) */
  compact?: boolean;
  /** 프라이머리 색상 (위젯 테마용) */
  primaryColor?: string;
  /** 항상 표시 (기본: hover 시에만 표시) */
  alwaysVisible?: boolean;
}

export function MessageActions({
  messageId,
  content,
  onRegenerate,
  onFeedback,
  compact = false,
  primaryColor,
  alwaysVisible = false,
}: MessageActionsProps) {
  const [feedback, setFeedback] = useState<'up' | 'down' | null>(null);
  const [copied, setCopied] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 클립보드 복사
  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('복사 실패:', err);
    }
  }, [content]);

  // 피드백 처리
  const handleFeedback = useCallback(
    async (type: 'up' | 'down') => {
      // 이미 같은 피드백이면 취소
      if (feedback === type) {
        setFeedback(null);
        return;
      }

      setFeedback(type);

      if (onFeedback) {
        setIsSubmitting(true);
        try {
          await onFeedback(messageId, type);
        } catch (err) {
          console.error('피드백 전송 실패:', err);
          // 실패 시 롤백
          setFeedback(null);
        } finally {
          setIsSubmitting(false);
        }
      }
    },
    [feedback, messageId, onFeedback]
  );

  const buttonBaseClass = cn(
    'flex items-center justify-center rounded-md transition-colors',
    compact ? 'h-7 w-7' : 'h-8 w-8',
    'hover:bg-muted text-muted-foreground hover:text-foreground',
    'disabled:opacity-50 disabled:cursor-not-allowed'
  );

  const iconSize = compact ? 'h-3.5 w-3.5' : 'h-4 w-4';

  return (
    <div
      className={cn(
        'flex items-center gap-0.5',
        !alwaysVisible && 'opacity-0 transition-opacity group-hover:opacity-100'
      )}
    >
      {/* 복사 버튼 */}
      <button
        onClick={handleCopy}
        className={buttonBaseClass}
        aria-label={copied ? '복사됨' : '복사'}
        title="복사"
      >
        {copied ? (
          <Check className={cn(iconSize, 'text-green-500')} />
        ) : (
          <Copy className={iconSize} />
        )}
      </button>

      {/* 재생성 버튼 (콜백이 있을 때만) */}
      {onRegenerate && (
        <button
          onClick={onRegenerate}
          className={buttonBaseClass}
          aria-label="다시 생성"
          title="다시 생성"
        >
          <RotateCcw className={iconSize} />
        </button>
      )}

      {/* 구분선 */}
      <div className="mx-1 h-4 w-px bg-border" />

      {/* 좋아요 버튼 */}
      <button
        onClick={() => handleFeedback('up')}
        disabled={isSubmitting}
        className={cn(
          buttonBaseClass,
          feedback === 'up' && 'bg-green-500/10 text-green-500 hover:bg-green-500/20 hover:text-green-500'
        )}
        style={feedback === 'up' && primaryColor ? { color: primaryColor } : undefined}
        aria-label="좋아요"
        aria-pressed={feedback === 'up'}
        title="좋아요"
      >
        <ThumbsUp className={iconSize} />
      </button>

      {/* 싫어요 버튼 */}
      <button
        onClick={() => handleFeedback('down')}
        disabled={isSubmitting}
        className={cn(
          buttonBaseClass,
          feedback === 'down' && 'bg-destructive/10 text-destructive hover:bg-destructive/20 hover:text-destructive'
        )}
        aria-label="싫어요"
        aria-pressed={feedback === 'down'}
        title="싫어요"
      >
        <ThumbsDown className={iconSize} />
      </button>
    </div>
  );
}
