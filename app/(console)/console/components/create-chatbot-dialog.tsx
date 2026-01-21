/**
 * 콘솔용 챗봇 생성 다이얼로그
 *
 * 사이드바 챗봇 스위처에서 "새 챗봇 추가" 클릭 시 표시
 * - 티어 제한 사전 체크
 * - 생성 성공 시 새 챗봇으로 자동 전환
 */

'use client';

import { useState, useEffect } from 'react';
import { Plus, Loader2, AlertTriangle } from 'lucide-react';
import { SimpleDialog } from '@/components/ui/dialog';
import { createChatbot } from '@/lib/actions/chatbot-actions';
import { useConsole } from '../hooks/use-console-state';
import { TIER_LIMITS, TIER_NAMES, type Tier } from '@/lib/tier/constants';

interface CreateChatbotDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CreateChatbotDialog({
  isOpen,
  onClose,
}: CreateChatbotDialogProps) {
  const { chatbots, tier, reloadChatbots, selectChatbotById } = useConsole();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 티어 제한 사전 체크
  const maxChatbots = TIER_LIMITS[tier as Tier]?.maxChatbots ?? 1;
  const isLimitReached = chatbots.length >= maxChatbots;
  const tierName = TIER_NAMES[tier as Tier] ?? '베이직';

  // 다이얼로그 닫힐 때 상태 초기화
  useEffect(() => {
    if (!isOpen) {
      setName('');
      setDescription('');
      setError(null);
    }
  }, [isOpen]);

  const handleClose = () => {
    if (isSubmitting) return;
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      setError('챗봇 이름을 입력하세요.');
      return;
    }

    if (isLimitReached) return;

    setIsSubmitting(true);
    setError(null);

    const result = await createChatbot({
      name: name.trim(),
      description: description.trim() || undefined,
    });

    setIsSubmitting(false);

    if (result.success && result.chatbotId) {
      // 챗봇 목록 새로고침 후 새 챗봇 선택
      await reloadChatbots();
      selectChatbotById(result.chatbotId);
      handleClose();
    } else {
      setError(result.error || '챗봇 생성 중 오류가 발생했습니다.');
    }
  };

  return (
    <SimpleDialog isOpen={isOpen} onClose={handleClose} title="새 챗봇 생성">
      {isLimitReached ? (
        // 티어 제한 도달 시 안내
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-4">
            <AlertTriangle className="h-5 w-5 shrink-0 text-yellow-500" />
            <div>
              <p className="font-medium text-foreground">
                챗봇 생성 한도에 도달했습니다
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                현재 {tierName} 플랜에서는 최대 {maxChatbots}개의 챗봇을 생성할
                수 있습니다. 더 많은 챗봇이 필요하시면 플랜을 업그레이드해
                주세요.
              </p>
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={handleClose}
              className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
            >
              닫기
            </button>
            <button
              type="button"
              disabled
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground opacity-50 cursor-not-allowed"
            >
              플랜 업그레이드
            </button>
          </div>
        </div>
      ) : (
        // 생성 폼
        <form onSubmit={handleSubmit} className="space-y-4">
          <p className="text-sm text-muted-foreground">
            챗봇을 생성하고 데이터셋을 연결하여 배포하세요.
          </p>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">
              이름 <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예: 고객지원 챗봇"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              maxLength={100}
              autoFocus
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-foreground">
              설명 <span className="text-muted-foreground">(선택)</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="이 챗봇의 용도를 설명하세요"
              rows={3}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              maxLength={500}
            />
          </div>

          {error && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={handleClose}
              disabled={isSubmitting}
              className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !name.trim()}
              className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  생성 중...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4" />
                  생성
                </>
              )}
            </button>
          </div>
        </form>
      )}
    </SimpleDialog>
  );
}
