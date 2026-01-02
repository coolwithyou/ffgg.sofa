/**
 * FAQ 빌더 페이지
 * Console 마이그레이션
 */

import { Suspense } from 'react';
import { getFAQDrafts } from './actions';
import { FAQEditor } from './faq-editor';

export default async function FAQBuilderPage() {
  const drafts = await getFAQDrafts();

  return (
    <div className="h-full">
      <Suspense
        fallback={
          <div className="flex h-64 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        }
      >
        <FAQEditor initialDrafts={drafts} />
      </Suspense>
    </div>
  );
}
