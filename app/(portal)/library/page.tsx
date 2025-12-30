/**
 * 라이브러리 페이지
 * 모든 문서를 중앙에서 관리하고 청크를 데이터셋에 복사
 */

import { Suspense } from 'react';
import { getLibraryDocuments, getDatasets } from './actions';
import { LibraryDocumentList } from './document-list';

export default async function LibraryPage() {
  const [documents, datasets] = await Promise.all([
    getLibraryDocuments(),
    getDatasets(),
  ]);

  return (
    <div className="space-y-6">
      {/* 페이지 타이틀 */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">라이브러리</h1>
        <p className="text-muted-foreground">
          업로드된 모든 문서를 관리합니다. 청크를 선택하여 데이터셋에 복사할 수 있습니다.
        </p>
      </div>

      {/* 안내 카드 */}
      <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
        <div className="flex gap-3">
          <InfoIcon className="h-5 w-5 flex-shrink-0 text-primary" />
          <div className="text-sm">
            <p className="font-medium text-foreground">라이브러리 사용 가이드</p>
            <ul className="mt-2 list-disc pl-5 text-muted-foreground space-y-1">
              <li><strong>배치됨</strong>: 데이터셋에 포함된 문서로, 챗봇 검색에 사용됩니다.</li>
              <li><strong>미배치</strong>: 아직 데이터셋에 포함되지 않은 문서입니다.</li>
              <li>문서의 청크를 선택하여 원하는 데이터셋에 복사할 수 있습니다.</li>
              <li>하나의 청크를 여러 데이터셋에 복사할 수 있습니다.</li>
            </ul>
          </div>
        </div>
      </div>

      {/* 문서 목록 */}
      <Suspense
        fallback={
          <div className="flex h-32 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        }
      >
        <LibraryDocumentList documents={documents} datasets={datasets} />
      </Suspense>
    </div>
  );
}

// 아이콘 컴포넌트
function InfoIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}
