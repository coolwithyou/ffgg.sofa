'use client';

/**
 * 청크 상세 다이얼로그
 * 목록에서 빠르게 상세 보기 및 액션 수행
 * - 키보드 단축키: A(승인), R(거부), E(편집), ←→(네비게이션)
 * - 이전/다음 청크 네비게이션
 */

import { useState, useEffect, useTransition, useCallback } from 'react';
import { Dialog } from '@/components/ui/dialog';
import { useAlertDialog } from '@/components/ui/alert-dialog';
import { useToast } from '@/components/ui/toast';
import type { ChunkReviewItem, ChunkStatus } from '@/lib/review/types';

interface ChunkDetailDialogProps {
  chunkId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onChunkUpdated: (chunkId: string, updates: Partial<ChunkReviewItem>) => void;
  onChunkDeleted: (chunkId: string) => void;
  // 네비게이션 관련
  chunkIds: string[];
  onNavigate: (chunkId: string) => void;
}

export function ChunkDetailDialog({
  chunkId,
  isOpen,
  onClose,
  onChunkUpdated,
  onChunkDeleted,
  chunkIds,
  onNavigate,
}: ChunkDetailDialogProps) {
  const [chunk, setChunk] = useState<ChunkReviewItem | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [isPending, startTransition] = useTransition();
  const { confirm } = useAlertDialog();
  const { error: showError } = useToast();

  // 현재 인덱스 계산
  const currentIndex = chunkId ? chunkIds.indexOf(chunkId) : -1;
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < chunkIds.length - 1;

  // 청크 조회
  useEffect(() => {
    if (!chunkId || !isOpen) {
      setChunk(null);
      setError(null);
      setIsEditing(false);
      return;
    }

    async function fetchChunk() {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/review/chunks/${chunkId}`);
        if (!response.ok) {
          if (response.status === 404) {
            setError('청크를 찾을 수 없습니다.');
          } else {
            setError('청크를 불러오는데 실패했습니다.');
          }
          return;
        }
        const data = await response.json();
        setChunk(data.chunk);
        setEditContent(data.chunk.content);
      } catch (err) {
        setError('네트워크 오류가 발생했습니다.');
      } finally {
        setIsLoading(false);
      }
    }

    fetchChunk();
  }, [chunkId, isOpen]);

  // 상태 변경
  const handleStatusChange = useCallback(
    async (status: ChunkStatus) => {
      if (!chunk || !chunkId) return;

      startTransition(async () => {
        try {
          const response = await fetch(`/api/review/chunks/${chunkId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status }),
          });

          if (!response.ok) {
            throw new Error('Failed to update status');
          }

          const data = await response.json();
          setChunk(data.chunk);
          onChunkUpdated(chunkId, { status: data.chunk.status });
        } catch (err) {
          showError('상태 변경 실패', '상태 변경에 실패했습니다.');
        }
      });
    },
    [chunk, chunkId, onChunkUpdated, showError]
  );

  // 내용 저장
  const handleSaveContent = async () => {
    if (!chunk || !chunkId) return;

    startTransition(async () => {
      try {
        const response = await fetch(`/api/review/chunks/${chunkId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: editContent,
            status: 'modified' as ChunkStatus,
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to save content');
        }

        const data = await response.json();
        setChunk(data.chunk);
        setIsEditing(false);
        onChunkUpdated(chunkId, {
          content: data.chunk.content,
          status: data.chunk.status,
        });
      } catch (err) {
        showError('저장 실패', '저장에 실패했습니다.');
      }
    });
  };

  // 삭제
  const handleDelete = async () => {
    if (!chunkId) return;

    const confirmed = await confirm({
      title: '청크 삭제',
      message: '이 청크를 삭제하시겠습니까?',
      confirmText: '삭제',
      cancelText: '취소',
      variant: 'destructive',
    });

    if (!confirmed) return;

    startTransition(async () => {
      try {
        const response = await fetch(`/api/review/chunks/${chunkId}`, {
          method: 'DELETE',
        });

        if (!response.ok) {
          throw new Error('Failed to delete');
        }

        onChunkDeleted(chunkId);
      } catch (err) {
        showError('삭제 실패', '삭제에 실패했습니다.');
      }
    });
  };

  // 네비게이션
  const goToPrev = useCallback(() => {
    if (hasPrev) {
      onNavigate(chunkIds[currentIndex - 1]);
    }
  }, [hasPrev, chunkIds, currentIndex, onNavigate]);

  const goToNext = useCallback(() => {
    if (hasNext) {
      onNavigate(chunkIds[currentIndex + 1]);
    }
  }, [hasNext, chunkIds, currentIndex, onNavigate]);

  // 키보드 단축키
  useEffect(() => {
    if (!isOpen || isEditing) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // 입력 필드에서는 무시
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      switch (e.key.toLowerCase()) {
        case 'a':
          if (!e.ctrlKey && !e.metaKey && chunk?.status !== 'approved') {
            e.preventDefault();
            handleStatusChange('approved');
          }
          break;
        case 'r':
          if (!e.ctrlKey && !e.metaKey && chunk?.status !== 'rejected') {
            e.preventDefault();
            handleStatusChange('rejected');
          }
          break;
        case 'e':
          if (!e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            setIsEditing(true);
          }
          break;
        case 'arrowleft':
          e.preventDefault();
          goToPrev();
          break;
        case 'arrowright':
          e.preventDefault();
          goToNext();
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isEditing, chunk, handleStatusChange, goToPrev, goToNext]);

  // 다이얼로그 타이틀 생성
  const dialogTitle = chunk
    ? `청크 #${chunk.chunkIndex + 1}`
    : '청크 상세';

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={dialogTitle}
      description={chunk?.documentName}
      maxWidth="4xl"
    >
      <div className="max-h-[70vh] overflow-y-auto">
        {isLoading ? (
          <div className="flex h-48 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : error || !chunk ? (
          <div className="rounded-lg border border-border bg-muted/50 p-8 text-center">
            <p className="text-destructive">{error || '청크를 찾을 수 없습니다.'}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* 네비게이션 & 상태 */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  onClick={goToPrev}
                  disabled={!hasPrev}
                  className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent"
                  title="이전 청크 (←)"
                >
                  <ChevronLeftIcon className="h-5 w-5" />
                </button>
                <span className="text-sm text-muted-foreground">
                  {currentIndex + 1} / {chunkIds.length}
                </span>
                <button
                  onClick={goToNext}
                  disabled={!hasNext}
                  className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent"
                  title="다음 청크 (→)"
                >
                  <ChevronRightIcon className="h-5 w-5" />
                </button>
              </div>
              <StatusBadge status={chunk.status} autoApproved={chunk.autoApproved} />
            </div>

            {/* 메타 정보 */}
            <div className="grid grid-cols-4 gap-3">
              <MetaCard label="품질 점수" value={chunk.qualityScore?.toString() ?? '-'} />
              <MetaCard
                label="컨텍스트"
                value={chunk.hasContext ? '생성됨' : '없음'}
                highlight={chunk.hasContext}
              />
              <MetaCard label="생성일" value={formatDate(chunk.createdAt)} />
              <MetaCard label="수정일" value={formatDate(chunk.updatedAt)} />
            </div>

            {/* 컨텍스트 정보 */}
            {chunk.hasContext && (
              <ContextSection
                contextPrefix={chunk.contextPrefix}
                contextPrompt={chunk.contextPrompt}
              />
            )}

            {/* 내용 */}
            <div className="rounded-lg border border-border bg-card">
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <h3 className="text-sm font-semibold text-foreground">청크 내용</h3>
                {!isEditing && (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="text-sm text-primary hover:underline"
                  >
                    편집 (E)
                  </button>
                )}
              </div>
              <div className="p-4">
                {isEditing ? (
                  <div className="space-y-3">
                    <textarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      className="h-48 w-full rounded-md border border-border bg-background p-3 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => {
                          setIsEditing(false);
                          setEditContent(chunk.content);
                        }}
                        className="rounded-md border border-border px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted"
                      >
                        취소
                      </button>
                      <button
                        onClick={handleSaveContent}
                        disabled={isPending}
                        className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                      >
                        저장
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="max-h-48 overflow-y-auto whitespace-pre-wrap text-sm text-foreground">
                    {chunk.content}
                  </div>
                )}
              </div>
            </div>

            {/* 액션 버튼 */}
            <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 p-4">
              <button
                onClick={handleDelete}
                disabled={isPending}
                className="rounded-md border border-destructive/30 px-3 py-1.5 text-sm font-medium text-destructive hover:bg-destructive/10 disabled:opacity-50"
              >
                삭제
              </button>
              <div className="flex gap-2">
                {chunk.status !== 'rejected' && (
                  <button
                    onClick={() => handleStatusChange('rejected')}
                    disabled={isPending}
                    className="rounded-md bg-destructive px-4 py-1.5 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
                  >
                    거부 (R)
                  </button>
                )}
                {chunk.status !== 'approved' && (
                  <button
                    onClick={() => handleStatusChange('approved')}
                    disabled={isPending}
                    className="rounded-md bg-green-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                  >
                    승인 (A)
                  </button>
                )}
              </div>
            </div>

            {/* 키보드 단축키 안내 */}
            <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
              <span>
                <kbd className="rounded border border-border bg-muted px-1.5 py-0.5">A</kbd> 승인
              </span>
              <span>
                <kbd className="rounded border border-border bg-muted px-1.5 py-0.5">R</kbd> 거부
              </span>
              <span>
                <kbd className="rounded border border-border bg-muted px-1.5 py-0.5">E</kbd> 편집
              </span>
              <span>
                <kbd className="rounded border border-border bg-muted px-1.5 py-0.5">←</kbd>
                <kbd className="ml-0.5 rounded border border-border bg-muted px-1.5 py-0.5">→</kbd> 이동
              </span>
            </div>
          </div>
        )}
      </div>
    </Dialog>
  );
}

// ========================================
// 서브 컴포넌트
// ========================================

function MetaCard({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={`mt-0.5 text-sm font-semibold ${
          highlight ? 'text-purple-500' : 'text-foreground'
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function ContextSection({
  contextPrefix,
  contextPrompt,
}: {
  contextPrefix?: string | null;
  contextPrompt?: string | null;
}) {
  const [showPrompt, setShowPrompt] = useState(false);

  return (
    <div className="rounded-lg border border-purple-500/20 bg-purple-500/10">
      <div className="flex items-center justify-between border-b border-purple-500/20 px-4 py-3">
        <div className="flex items-center gap-2">
          <SparklesIcon className="h-4 w-4 text-purple-500" />
          <h3 className="text-sm font-semibold text-foreground">AI 컨텍스트</h3>
        </div>
        {contextPrompt && (
          <button
            onClick={() => setShowPrompt(!showPrompt)}
            className="text-xs text-purple-500 hover:underline"
          >
            {showPrompt ? '프롬프트 숨기기' : '프롬프트 보기'}
          </button>
        )}
      </div>
      <div className="space-y-3 p-4">
        <div>
          <h4 className="mb-1 text-xs font-medium text-purple-500">생성된 컨텍스트</h4>
          <div className="rounded-md border border-border bg-card p-3">
            <p className="whitespace-pre-wrap text-sm text-foreground">
              {contextPrefix || '(컨텍스트 없음)'}
            </p>
          </div>
        </div>
        {showPrompt && contextPrompt && (
          <div>
            <h4 className="mb-1 text-xs font-medium text-purple-500">사용된 프롬프트</h4>
            <div className="max-h-40 overflow-y-auto rounded-md border border-border bg-background p-3">
              <pre className="whitespace-pre-wrap text-xs text-muted-foreground">
                {contextPrompt}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatusBadge({
  status,
  autoApproved,
}: {
  status: ChunkStatus;
  autoApproved: boolean;
}) {
  const config: Record<ChunkStatus, { label: string; className: string }> = {
    pending: { label: '대기', className: 'bg-muted text-muted-foreground' },
    approved: { label: '승인', className: 'bg-green-500/10 text-green-500' },
    rejected: { label: '거부', className: 'bg-destructive/10 text-destructive' },
    modified: { label: '수정됨', className: 'bg-primary/10 text-primary' },
  };

  const { label, className } = config[status];

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium ${className}`}
    >
      {label}
      {autoApproved && <span className="text-[10px]">(자동)</span>}
    </span>
  );
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('ko-KR', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ========================================
// 아이콘
// ========================================

function ChevronLeftIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
    </svg>
  );
}

function ChevronRightIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  );
}

function SparklesIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
      />
    </svg>
  );
}
