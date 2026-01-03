/**
 * 청크 검토 페이지
 * 문서 청크를 검토하고 승인/거부/수정
 * Console 마이그레이션 - [v2] URL searchParams로 초기 필터 지원 (documentId, status)
 */

import { Suspense } from 'react';
import { ReviewContent } from './_components/review-content';
import type { FilterState } from './_components/review-filters';
import type { ChunkStatus } from '@/lib/review/types';

interface ReviewPageProps {
  searchParams: Promise<{
    documentId?: string;
    status?: string | string[];
  }>;
}

export default async function ReviewPage({ searchParams }: ReviewPageProps) {
  const params = await searchParams;

  // URL 쿼리에서 초기 필터 구성
  const initialFilters: Partial<FilterState> = {};

  if (params.documentId) {
    initialFilters.documentId = params.documentId;
    // documentName은 첫 청크 로드 후 자동 설정됨
  }

  if (params.status) {
    initialFilters.status = Array.isArray(params.status)
      ? (params.status as ChunkStatus[])
      : ([params.status] as ChunkStatus[]);
  }

  return (
    <div className="space-y-6 p-6">
      {/* 페이지 타이틀 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">청크 검토</h1>
          <p className="text-muted-foreground">AI가 생성한 청크를 검토하고 승인하세요.</p>
        </div>
      </div>

      {/* 검토 콘텐츠 */}
      <Suspense
        fallback={
          <div className="flex h-32 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        }
      >
        <ReviewContent initialFilters={initialFilters} />
      </Suspense>
    </div>
  );
}
