/**
 * 데이터셋 관리 페이지
 */

import { Suspense } from 'react';
import { getDatasets } from './actions';
import { DatasetList } from './dataset-list';
import { CreateDataset } from './create-dataset';

export default async function DatasetsPage() {
  const datasets = await getDatasets();

  return (
    <div className="space-y-6">
      {/* 페이지 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">데이터셋 관리</h1>
          <p className="text-muted-foreground">
            문서를 데이터셋으로 그룹화하여 챗봇에 연결하세요.
          </p>
        </div>
        <CreateDataset />
      </div>

      {/* 데이터셋 목록 */}
      <Suspense
        fallback={
          <div className="flex h-32 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        }
      >
        <DatasetList datasets={datasets} />
      </Suspense>
    </div>
  );
}
