/**
 * 문서 관리 페이지
 * [Week 9] 문서 목록 및 업로드
 * [Week 13] 템플릿 다운로드 및 작성 가이드 추가
 */

import { Suspense } from 'react';
import { getDocuments } from './actions';
import { DocumentList } from './document-list';
import { DocumentUpload } from './document-upload';
import { TemplateDownload } from './template-download';
import { UploadGuide } from './upload-guide';

export default async function DocumentsPage() {
  const documents = await getDocuments();

  return (
    <div className="space-y-6">
      {/* 페이지 타이틀 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">문서 관리</h1>
          <p className="text-muted-foreground">
            학습용 문서를 업로드하고 관리하세요. 템플릿을 활용하면 더 높은 품질의 데이터를 만들 수 있습니다.
          </p>
        </div>
      </div>

      {/* 작성 가이드 */}
      <UploadGuide />

      {/* 템플릿 다운로드 */}
      <TemplateDownload />

      {/* 업로드 영역 */}
      <DocumentUpload />

      {/* 문서 목록 */}
      <Suspense
        fallback={
          <div className="flex h-32 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        }
      >
        <DocumentList documents={documents} />
      </Suspense>
    </div>
  );
}
