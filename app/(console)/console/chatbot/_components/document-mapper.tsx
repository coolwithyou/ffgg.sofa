'use client';

/**
 * 문서 데이터셋 맵핑 컴포넌트
 * 문서를 선택하여 데이터셋에 이동 또는 복제
 */

import { useState } from 'react';
import type { LibraryDocument, DatasetOption } from '../actions';
import { moveDocumentToDataset, duplicateDocumentToDataset } from '../actions';
import { useAlertDialog } from '@/components/ui/alert-dialog';
import { toast } from 'sonner';

interface DocumentMapperProps {
  document: LibraryDocument | null;
  datasets: DatasetOption[];
  onSuccess?: () => void;
}

export function DocumentMapper({ document, datasets, onSuccess }: DocumentMapperProps) {
  const [targetDatasetId, setTargetDatasetId] = useState<string>(
    datasets.find((d) => d.isDefault)?.id || datasets[0]?.id || ''
  );
  const { confirm } = useAlertDialog();

  // 문서가 선택되지 않은 경우
  if (!document) {
    return (
      <div className="flex h-full min-h-[400px] items-center justify-center p-8 text-center">
        <div>
          <DocumentIcon className="mx-auto h-12 w-12 text-muted-foreground" />
          <p className="mt-4 font-medium text-foreground">문서를 선택하세요</p>
          <p className="mt-2 text-sm text-muted-foreground">
            좌측 목록에서 문서를 클릭하면 데이터셋에 맵핑할 수 있습니다.
          </p>
        </div>
      </div>
    );
  }

  // 문서가 라이브러리에 있는지 (datasetId === null) 확인
  const isLibraryDocument = document.datasetId === null;

  const handleAction = async () => {
    if (!targetDatasetId) {
      toast.warning('데이터셋 선택 필요', { description: '대상 데이터셋을 선택해주세요.' });
      return;
    }

    // 같은 데이터셋 선택 시 방지
    if (document.datasetId === targetDatasetId) {
      toast.warning('동일 데이터셋', { description: '이미 해당 데이터셋에 속한 문서입니다.' });
      return;
    }

    const actionLabel = isLibraryDocument ? '이동' : '복제';
    const confirmMessage = isLibraryDocument
      ? `"${document.filename}"을(를) 선택한 데이터셋으로 이동하시겠습니까?`
      : `"${document.filename}"을(를) 선택한 데이터셋으로 복제하시겠습니까?\n(원본 문서는 그대로 유지됩니다)`;

    await confirm({
      title: `문서 ${actionLabel}`,
      message: confirmMessage,
      confirmText: actionLabel,
      cancelText: '취소',
      onConfirm: async () => {
        if (isLibraryDocument) {
          // 라이브러리 문서 → 이동
          const result = await moveDocumentToDataset(document.id, targetDatasetId);
          if (!result.success) {
            throw new Error(result.error || '이동에 실패했습니다.');
          }
          toast.success('이동 완료', { description: '문서가 성공적으로 이동되었습니다.' });
          onSuccess?.();
        } else {
          // 이미 배치된 문서 → 복제
          const result = await duplicateDocumentToDataset(document.id, targetDatasetId);
          if (!result.success) {
            throw new Error(result.error || '복제에 실패했습니다.');
          }
          toast.success('복제 완료', { description: `문서가 성공적으로 복제되었습니다. (${result.copiedChunkCount}개 청크 복제됨)` });
          onSuccess?.();
        }
      },
    });
  };

  return (
    <div className="flex h-full flex-col">
      {/* 문서 정보 헤더 */}
      <div className="border-b border-border px-6 py-4">
        <h3 className="font-semibold text-foreground truncate">{document.filename}</h3>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span>{formatFileSize(document.fileSize)}</span>
          <span>•</span>
          <span>{document.chunkCount}개 청크</span>
          {document.approvedCount > 0 && (
            <>
              <span>•</span>
              <span className="text-green-500">{document.approvedCount}개 승인됨</span>
            </>
          )}
        </div>
      </div>

      {/* 문서 상태 */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        <div className="space-y-4">
          {/* 현재 상태 카드 */}
          <div className="rounded-lg border border-border bg-card p-4">
            <h4 className="text-sm font-medium text-muted-foreground">현재 상태</h4>
            <div className="mt-2 flex items-center gap-2">
              {isLibraryDocument ? (
                <>
                  <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                    라이브러리
                  </span>
                  <span className="text-sm text-muted-foreground">
                    아직 데이터셋에 배치되지 않음
                  </span>
                </>
              ) : (
                <>
                  <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                    {document.datasetName}
                  </span>
                  <span className="text-sm text-muted-foreground">에 배치됨</span>
                </>
              )}
            </div>
          </div>

          {/* 액션 설명 */}
          <div className="rounded-lg border border-border bg-card p-4">
            <h4 className="text-sm font-medium text-muted-foreground">
              {isLibraryDocument ? '이동하기' : '복제하기'}
            </h4>
            <p className="mt-2 text-sm text-foreground">
              {isLibraryDocument
                ? '이 문서를 선택한 데이터셋으로 이동합니다. 문서와 모든 청크가 해당 데이터셋에 배치되어 챗봇 검색에 활용됩니다.'
                : '이 문서를 선택한 데이터셋으로 복제합니다. 원본 문서는 현재 위치에 그대로 유지되고, 새로운 복사본이 대상 데이터셋에 생성됩니다.'}
            </p>
          </div>

          {/* 청크 정보 */}
          <div className="rounded-lg border border-border bg-card p-4">
            <h4 className="text-sm font-medium text-muted-foreground">청크 정보</h4>
            <div className="mt-2 grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-foreground">{document.chunkCount}</div>
                <div className="text-xs text-muted-foreground">전체</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-green-500">{document.approvedCount}</div>
                <div className="text-xs text-muted-foreground">승인됨</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-yellow-500">{document.pendingCount}</div>
                <div className="text-xs text-muted-foreground">검토대기</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 액션 영역 */}
      <div className="border-t border-border p-4">
        <div className="flex items-center gap-3">
          <select
            value={targetDatasetId}
            onChange={(e) => setTargetDatasetId(e.target.value)}
            className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:ring-1 focus:ring-primary disabled:opacity-50"
          >
            {datasets.length === 0 ? (
              <option value="">데이터셋 없음</option>
            ) : (
              datasets
                .filter((d) => d.id !== document.datasetId) // 현재 데이터셋 제외
                .map((dataset) => (
                  <option key={dataset.id} value={dataset.id}>
                    {dataset.name} {dataset.isDefault && '(기본)'}
                  </option>
                ))
            )}
          </select>
          <button
            onClick={handleAction}
            disabled={!targetDatasetId}
            className={`rounded-md px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50 disabled:cursor-not-allowed ${
              isLibraryDocument
                ? 'bg-primary hover:bg-primary/90'
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {isLibraryDocument ? '이동' : '복제'}
          </button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          {isLibraryDocument
            ? '이동하면 라이브러리에서 사라지고 데이터셋에서만 관리됩니다.'
            : '복제하면 원본은 그대로 유지되고 새 복사본이 생성됩니다.'}
        </p>
      </div>
    </div>
  );
}

// 파일 크기 포맷팅
function formatFileSize(bytes: number | null): string {
  if (bytes === null) return '알 수 없음';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// 아이콘 컴포넌트들
function DocumentIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
      />
    </svg>
  );
}

