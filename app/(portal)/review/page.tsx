/**
 * 청크 검토 페이지
 * 문서 청크를 검토하고 승인/거부/수정
 */

import { Suspense } from 'react';
import { ReviewContent } from './_components/review-content';

export default function ReviewPage() {
  return (
    <div className="space-y-6">
      {/* 페이지 타이틀 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">청크 검토</h1>
          <p className="text-gray-600">AI가 생성한 청크를 검토하고 승인하세요.</p>
        </div>
      </div>

      {/* 검토 콘텐츠 */}
      <Suspense
        fallback={
          <div className="flex h-32 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
          </div>
        }
      >
        <ReviewContent />
      </Suspense>
    </div>
  );
}
