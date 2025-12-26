/**
 * 순차 리뷰 페이지
 * 한 번에 하나씩 청크를 검토
 */

import { SequentialReview } from './_components/sequential-review';

export default function SequentialReviewPage() {
  return (
    <div className="mx-auto max-w-4xl">
      <SequentialReview />
    </div>
  );
}
