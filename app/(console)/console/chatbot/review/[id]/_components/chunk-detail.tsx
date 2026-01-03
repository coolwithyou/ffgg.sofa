'use client';

/**
 * 청크 상세 보기/편집 컴포넌트
 * Console 마이그레이션 - 경로 업데이트
 */

import { useState, useEffect, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAlertDialog } from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import type { ChunkReviewItem, ChunkStatus } from '@/lib/review/types';

interface ChunkDetailProps {
  chunkId: string;
}

export function ChunkDetail({ chunkId }: ChunkDetailProps) {
  const router = useRouter();
  const [chunk, setChunk] = useState<ChunkReviewItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [isPending, startTransition] = useTransition();
  const { confirm } = useAlertDialog();

  // 청크 조회
  useEffect(() => {
    async function fetchChunk() {
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
  }, [chunkId]);

  // 상태 변경
  const handleStatusChange = async (status: ChunkStatus) => {
    if (!chunk) return;

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
      } catch (err) {
        toast.error('상태 변경 실패', { description: '상태 변경에 실패했습니다.' });
      }
    });
  };

  // 내용 저장
  const handleSaveContent = async () => {
    if (!chunk) return;

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
      } catch (err) {
        toast.error('저장 실패', { description: '저장에 실패했습니다.' });
      }
    });
  };

  // 삭제
  const handleDelete = async () => {
    await confirm({
      title: '청크 삭제',
      message: '이 청크를 삭제하시겠습니까?',
      confirmText: '삭제',
      cancelText: '취소',
      variant: 'destructive',
      onConfirm: async () => {
        const response = await fetch(`/api/review/chunks/${chunkId}`, {
          method: 'DELETE',
        });

        if (!response.ok) {
          throw new Error('삭제에 실패했습니다.');
        }

        router.push('/console/chatbot/review');
      },
    });
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (error || !chunk) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center">
        <p className="text-destructive">{error || '청크를 찾을 수 없습니다.'}</p>
        <Link
          href="/console/chatbot/review"
          className="mt-4 inline-block text-primary hover:underline"
        >
          목록으로 돌아가기
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/console/chatbot/review"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-muted hover:bg-muted/80"
          >
            <BackIcon className="h-5 w-5 text-muted-foreground" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              청크 #{chunk.chunkIndex + 1}
            </h1>
            <p className="text-muted-foreground">{chunk.documentName}</p>
          </div>
        </div>
        <StatusBadge status={chunk.status} autoApproved={chunk.autoApproved} />
      </div>

      {/* 메타 정보 */}
      <div className="grid grid-cols-4 gap-4">
        <MetaCard label="품질 점수" value={chunk.qualityScore?.toString() ?? '-'} />
        <MetaCard
          label="컨텍스트"
          value={chunk.hasContext ? '생성됨' : '없음'}
          highlight={chunk.hasContext}
        />
        <MetaCard label="생성일" value={formatDate(chunk.createdAt)} />
        <MetaCard label="수정일" value={formatDate(chunk.updatedAt)} />
      </div>

      {/* 컨텍스트 정보 (Contextual Retrieval) */}
      {chunk.hasContext && (
        <ContextSection
          contextPrefix={chunk.contextPrefix}
          contextPrompt={chunk.contextPrompt}
        />
      )}

      {/* 내용 */}
      <div className="rounded-lg border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="text-lg font-semibold text-foreground">청크 내용</h2>
          {!isEditing && (
            <button
              onClick={() => setIsEditing(true)}
              className="text-sm text-primary hover:underline"
            >
              편집
            </button>
          )}
        </div>
        <div className="p-6">
          {isEditing ? (
            <div className="space-y-4">
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="h-64 w-full rounded-md border border-border bg-background p-4 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => {
                    setIsEditing(false);
                    setEditContent(chunk.content);
                  }}
                  className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
                >
                  취소
                </button>
                <button
                  onClick={handleSaveContent}
                  disabled={isPending}
                  className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  저장
                </button>
              </div>
            </div>
          ) : (
            <div className="whitespace-pre-wrap text-sm text-foreground">
              {chunk.content}
            </div>
          )}
        </div>
      </div>

      {/* 액션 버튼 */}
      <div className="flex items-center justify-between rounded-lg border border-border bg-card p-6">
        <button
          onClick={handleDelete}
          disabled={isPending}
          className="rounded-md border border-destructive/30 px-4 py-2 text-sm font-medium text-destructive hover:bg-destructive/10 disabled:opacity-50"
        >
          삭제
        </button>
        <div className="flex gap-2">
          {chunk.status !== 'rejected' && (
            <button
              onClick={() => handleStatusChange('rejected')}
              disabled={isPending}
              className="rounded-md bg-destructive px-6 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
            >
              거부
            </button>
          )}
          {chunk.status !== 'approved' && (
            <button
              onClick={() => handleStatusChange('approved')}
              disabled={isPending}
              className="rounded-md bg-green-600 px-6 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
            >
              승인
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// 메타 카드
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
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p
        className={`mt-1 text-lg font-semibold ${
          highlight ? 'text-purple-500' : 'text-foreground'
        }`}
      >
        {value}
      </p>
    </div>
  );
}

// 컨텍스트 섹션 (Contextual Retrieval)
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
      <div className="flex items-center justify-between border-b border-purple-500/20 px-6 py-4">
        <div className="flex items-center gap-2">
          <SparklesIcon className="h-5 w-5 text-purple-500" />
          <h2 className="text-lg font-semibold text-foreground">
            AI 컨텍스트 (Contextual Retrieval)
          </h2>
        </div>
        {contextPrompt && (
          <button
            onClick={() => setShowPrompt(!showPrompt)}
            className="text-sm text-purple-500 hover:underline"
          >
            {showPrompt ? '프롬프트 숨기기' : '프롬프트 보기'}
          </button>
        )}
      </div>

      <div className="space-y-4 p-6">
        {/* 생성된 컨텍스트 */}
        <div>
          <h3 className="mb-2 text-sm font-medium text-purple-500">생성된 컨텍스트</h3>
          <div className="rounded-md border border-border bg-card p-4">
            <p className="whitespace-pre-wrap text-sm text-foreground">
              {contextPrefix || '(컨텍스트 없음)'}
            </p>
          </div>
        </div>

        {/* 프롬프트 (토글) */}
        {showPrompt && contextPrompt && (
          <div>
            <h3 className="mb-2 text-sm font-medium text-purple-500">사용된 프롬프트</h3>
            <div className="max-h-80 overflow-y-auto rounded-md border border-border bg-background p-4">
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

// 상태 배지
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
      className={`inline-flex items-center gap-1 rounded-full px-4 py-1.5 text-sm font-medium ${className}`}
    >
      {label}
      {autoApproved && <span className="text-xs">(자동)</span>}
    </span>
  );
}

// 날짜 포맷
function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// 아이콘
function BackIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M15 19l-7-7 7-7"
      />
    </svg>
  );
}
