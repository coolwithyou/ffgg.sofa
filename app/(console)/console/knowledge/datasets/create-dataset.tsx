/**
 * 데이터셋 생성 컴포넌트
 * Console 마이그레이션
 */

'use client';

import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { createDataset } from './actions';

export function CreateDataset() {
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClose = () => {
    setIsOpen(false);
    setName('');
    setDescription('');
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      setError('데이터셋 이름을 입력하세요.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const result = await createDataset({
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
        새 데이터셋
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* 반투명 배경 */}
          <div
            className="fixed inset-0 bg-black/50"
            onClick={handleClose}
          />

          {/* 다이얼로그 */}
          <div className="relative z-10 w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-lg">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-medium text-foreground">새 데이터셋 생성</h3>
              <button
                onClick={handleClose}
                className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">
                  이름 <span className="text-destructive">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="예: 고객 지원 FAQ"
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
                  placeholder="이 데이터셋의 용도를 설명하세요"
                  rows={2}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  maxLength={500}
                />
              </div>

              {error && (
                <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {error}
                </div>
              )}

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={handleClose}
                  className="rounded-md border border-border px-4 py-2 text-sm text-foreground hover:bg-muted"
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
          </div>
        </div>
      )}
    </>
  );
}
