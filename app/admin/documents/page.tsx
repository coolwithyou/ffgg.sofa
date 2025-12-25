/**
 * 관리자 문서 관리 페이지
 * 전체 문서 현황 조회 및 재처리 기능
 */

import { Suspense } from 'react';
import { DocumentsTable } from './documents-table';

export const dynamic = 'force-dynamic';

export default function AdminDocumentsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">문서 관리</h1>
        <p className="text-gray-500">
          전체 테넌트의 문서 현황을 확인하고 재처리할 수 있습니다.
        </p>
      </div>

      <Suspense fallback={<DocumentsTableSkeleton />}>
        <DocumentsTable />
      </Suspense>
    </div>
  );
}

function DocumentsTableSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="flex gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-20 w-40 rounded-lg bg-gray-200" />
        ))}
      </div>
      <div className="h-96 rounded-lg bg-gray-200" />
    </div>
  );
}
