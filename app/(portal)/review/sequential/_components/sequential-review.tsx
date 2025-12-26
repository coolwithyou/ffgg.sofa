'use client';

/**
 * 순차 리뷰 컴포넌트
 * 키보드 단축키 지원
 */

import { useState, useEffect, useCallback, useTransition } from 'react';
import Link from 'next/link';
import type { ChunkReviewItem, ChunkStatus } from '@/lib/review/types';

interface ReviewStats {
  total: number;
  reviewed: number;
  pending: number;
}

export function SequentialReview() {
  const [chunk, setChunk] = useState<ChunkReviewItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState<ReviewStats>({ total: 0, reviewed: 0, pending: 0 });
  const [history, setHistory] = useState<string[]>([]);
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  // 다음 청크 가져오기
  const fetchNextChunk = useCallback(async (currentChunkId?: string) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (currentChunkId) {
        params.set('currentChunkId', currentChunkId);
      }

      const response = await fetch(`/api/review/next?${params.toString()}`);
      if (!response.ok) {
        throw new Error('Failed to fetch next chunk');
      }

      const data = await response.json();
      setChunk(data.chunk);

      if (!data.chunk) {
        setMessage(data.message || '검토할 청크가 없습니다.');
      } else {
        setMessage(null);
      }
    } catch (error) {
      console.error('Error fetching next chunk:', error);
      setMessage('청크를 불러오는데 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 통계 가져오기
  const fetchStats = useCallback(async () => {
    try {
      const response = await fetch('/api/review/chunks?limit=1');
      if (response.ok) {
        const data = await response.json();
        setStats({
          total: data.total,
          reviewed: data.total - (data.chunks.filter((c: ChunkReviewItem) => c.status === 'pending').length),
          pending: data.chunks.filter((c: ChunkReviewItem) => c.status === 'pending').length,
        });
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  }, []);

  // 초기 로드
  useEffect(() => {
    fetchNextChunk();
    fetchStats();
  }, [fetchNextChunk, fetchStats]);

  // 상태 변경 및 다음으로 이동
  const handleAction = useCallback(async (status: ChunkStatus) => {
    if (!chunk) return;

    startTransition(async () => {
      try {
        const response = await fetch(`/api/review/chunks/${chunk.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status }),
        });

        if (!response.ok) {
          throw new Error('Failed to update chunk');
        }

        // 히스토리에 추가
        setHistory((prev) => [...prev, chunk.id]);

        // 다음 청크 가져오기
        await fetchNextChunk(chunk.id);
        await fetchStats();
      } catch (error) {
        console.error('Error updating chunk:', error);
        alert('상태 변경에 실패했습니다.');
      }
    });
  }, [chunk, fetchNextChunk, fetchStats]);

  // 건너뛰기
  const handleSkip = useCallback(async () => {
    if (!chunk) return;
    setHistory((prev) => [...prev, chunk.id]);
    await fetchNextChunk(chunk.id);
  }, [chunk, fetchNextChunk]);

  // 키보드 단축키
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 입력 필드에서는 무시
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      if (isPending || isLoading || !chunk) return;

      switch (e.key.toLowerCase()) {
        case 'a':
          handleAction('approved');
          break;
        case 'r':
          handleAction('rejected');
          break;
        case 's':
          handleSkip();
          break;
        case 'arrowright':
          handleSkip();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [chunk, isPending, isLoading, handleAction, handleSkip]);

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
      </div>
    );
  }

  if (!chunk) {
    return (
      <div className="space-y-6">
        <Header stats={stats} />
        <div className="rounded-lg border bg-white p-12 text-center">
          <CompletedIcon className="mx-auto h-16 w-16 text-green-500" />
          <h2 className="mt-4 text-xl font-bold text-gray-900">
            {message || '모든 청크를 검토했습니다!'}
          </h2>
          <p className="mt-2 text-gray-600">
            {history.length > 0
              ? `이번 세션에서 ${history.length}개의 청크를 검토했습니다.`
              : '검토할 청크가 없습니다.'}
          </p>
          <Link
            href="/review"
            className="mt-6 inline-block rounded-md bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            목록으로 돌아가기
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Header stats={stats} />

      {/* 진행률 바 */}
      <div className="overflow-hidden rounded-full bg-gray-200">
        <div
          className="h-2 bg-green-500 transition-all duration-300"
          style={{
            width: `${stats.total > 0 ? (stats.reviewed / stats.total) * 100 : 0}%`,
          }}
        />
      </div>

      {/* 청크 카드 */}
      <div className="rounded-lg border bg-white shadow-sm">
        {/* 헤더 */}
        <div className="border-b px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                {chunk.documentName}
              </h2>
              <p className="text-sm text-gray-500">
                청크 #{chunk.chunkIndex + 1}
              </p>
            </div>
            <QualityBadge score={chunk.qualityScore} />
          </div>
        </div>

        {/* 내용 */}
        <div className="max-h-[400px] overflow-y-auto p-6">
          <div className="whitespace-pre-wrap text-gray-700">{chunk.content}</div>
        </div>

        {/* 액션 버튼 */}
        <div className="border-t bg-gray-50 px-6 py-4">
          <div className="flex items-center justify-between">
            <Link
              href={`/review/${chunk.id}`}
              className="text-sm text-blue-600 hover:underline"
            >
              상세 보기 / 편집
            </Link>
            <div className="flex gap-3">
              <button
                onClick={handleSkip}
                disabled={isPending}
                className="rounded-md border px-6 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50"
              >
                건너뛰기
                <kbd className="ml-2 rounded bg-gray-200 px-1.5 py-0.5 text-xs font-semibold text-gray-600">
                  S
                </kbd>
              </button>
              <button
                onClick={() => handleAction('rejected')}
                disabled={isPending}
                className="rounded-md bg-red-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                거부
                <kbd className="ml-2 rounded bg-red-500 px-1.5 py-0.5 text-xs font-semibold text-red-100">
                  R
                </kbd>
              </button>
              <button
                onClick={() => handleAction('approved')}
                disabled={isPending}
                className="rounded-md bg-green-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
              >
                승인
                <kbd className="ml-2 rounded bg-green-500 px-1.5 py-0.5 text-xs font-semibold text-green-100">
                  A
                </kbd>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 단축키 안내 */}
      <div className="rounded-lg border bg-gray-50 px-4 py-3 text-center text-sm text-gray-600">
        <span className="font-medium">단축키:</span>{' '}
        <kbd className="rounded bg-white px-1.5 py-0.5 text-xs font-semibold shadow-sm">A</kbd>{' '}
        승인 ·{' '}
        <kbd className="rounded bg-white px-1.5 py-0.5 text-xs font-semibold shadow-sm">R</kbd>{' '}
        거부 ·{' '}
        <kbd className="rounded bg-white px-1.5 py-0.5 text-xs font-semibold shadow-sm">S</kbd> 또는{' '}
        <kbd className="rounded bg-white px-1.5 py-0.5 text-xs font-semibold shadow-sm">→</kbd>{' '}
        건너뛰기
      </div>
    </div>
  );
}

// 헤더
function Header({ stats }: { stats: ReviewStats }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-4">
        <Link
          href="/review"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200"
        >
          <BackIcon className="h-5 w-5 text-gray-600" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">순차 리뷰</h1>
          <p className="text-gray-600">
            {stats.reviewed}/{stats.total} 완료
          </p>
        </div>
      </div>
    </div>
  );
}

// 품질 점수 배지
function QualityBadge({ score }: { score: number | null }) {
  if (score === null) {
    return <span className="text-sm text-gray-400">품질 점수 없음</span>;
  }

  let colorClass = 'bg-gray-100 text-gray-700';
  if (score >= 85) {
    colorClass = 'bg-green-100 text-green-700';
  } else if (score >= 70) {
    colorClass = 'bg-yellow-100 text-yellow-700';
  } else if (score >= 50) {
    colorClass = 'bg-orange-100 text-orange-700';
  } else {
    colorClass = 'bg-red-100 text-red-700';
  }

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm font-medium ${colorClass}`}
    >
      품질: {score}점
    </span>
  );
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

function CompletedIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}
