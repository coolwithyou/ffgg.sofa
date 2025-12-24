/**
 * 문서 관리 페이지
 * [Week 9] 문서 목록 및 업로드
 */

import { Suspense } from 'react';
import { getDocuments } from './actions';
import { DocumentList } from './document-list';
import { DocumentUpload } from './document-upload';

export default async function DocumentsPage() {
  const documents = await getDocuments();

  return (
    <div className="space-y-6">
      {/* 페이지 타이틀 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">문서 관리</h1>
          <p className="text-gray-600">PDF, TXT 파일을 업로드하고 관리하세요.</p>
        </div>
      </div>

      {/* 업로드 영역 */}
      <DocumentUpload />

      {/* 문서 목록 */}
      <Suspense
        fallback={
          <div className="flex h-32 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
          </div>
        }
      >
        <DocumentList documents={documents} />
      </Suspense>
    </div>
  );
}
