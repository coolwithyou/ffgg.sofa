/**
 * 데이터셋 상세 페이지
 * Console 마이그레이션
 */

import { Suspense } from 'react';
import { DatasetDetail } from './dataset-detail';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function DatasetDetailPage({ params }: PageProps) {
  const { id } = await params;

  return (
    <div className="flex flex-col gap-6 p-6">
      <Suspense
        fallback={
          <div className="flex h-64 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        }
      >
        <DatasetDetail datasetId={id} />
      </Suspense>
    </div>
  );
}
