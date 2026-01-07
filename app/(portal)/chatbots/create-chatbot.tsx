/**
 * 챗봇 생성 컴포넌트
 */

'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { SimpleDialog } from '@/components/ui/dialog';
import { createChatbot } from './actions';

export function CreateChatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClose = () => {
    if (isSubmitting) return; // 제출 중에는 닫기 방지
    setIsOpen(false);
    setName('');
    setDescription('');
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      setError('챗봇 이름을 입력하세요.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const result = await createChatbot({
      name: name.trim(),
      description: description.trim() || undefined,
    });

    setIsSubmitting(false);

    if (result.success) {
      handleClose();
    } else {
      setError(result.error || '오류가 발생했습니다.');
    }
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
      >
        <Plus className="h-4 w-4" />
        새 챗봇
      </button>

      <SimpleDialog
        isOpen={isOpen}
        onClose={handleClose}
        title="새 챗봇 생성"
        description="챗봇을 생성하고 데이터셋을 연결하여 배포하세요."
      >
        <form onSubmit={handleSubmit} className="space-y-4">
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
              disabled={isSubmitting}
              className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
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
      </SimpleDialog>
    </>
  );
}
