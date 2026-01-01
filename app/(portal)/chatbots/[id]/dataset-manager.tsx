/**
 * 데이터셋 연결 관리 컴포넌트
 */

'use client';

import { useState, useEffect } from 'react';
import { Database, Plus, Unlink, FileText, Layers } from 'lucide-react';
import { useAlertDialog } from '@/components/ui/alert-dialog';

interface LinkedDataset {
  id: string;
  name: string;
  documentCount: number;
  chunkCount: number;
  weight: number;
}

interface DatasetOption {
  id: string;
  name: string;
  documentCount: number;
}

interface DatasetManagerProps {
  chatbotId: string;
  linkedDatasets: LinkedDataset[];
  onUpdate: () => void;
}

export function DatasetManager({
  chatbotId,
  linkedDatasets,
  onUpdate,
}: DatasetManagerProps) {
  const [availableDatasets, setAvailableDatasets] = useState<DatasetOption[]>(
    []
  );
  const [isLoading, setIsLoading] = useState(false);
  const [isLinking, setIsLinking] = useState(false);
  const [selectedDatasetId, setSelectedDatasetId] = useState('');
  const [unlinkingId, setUnlinkingId] = useState<string | null>(null);
  const { confirm } = useAlertDialog();

  useEffect(() => {
    fetchAvailableDatasets();
  }, [linkedDatasets]);

  const fetchAvailableDatasets = async () => {
    try {
      const response = await fetch('/api/datasets');
      if (response.ok) {
        const data = await response.json();
        // 이미 연결된 데이터셋 제외
        const linkedIds = new Set(linkedDatasets.map((d) => d.id));
        const available = data.datasets.filter(
          (d: DatasetOption) => !linkedIds.has(d.id)
        );
        setAvailableDatasets(available);
      }
    } catch (err) {
      console.error('Failed to fetch datasets:', err);
    }
  };

  const handleLink = async () => {
    if (!selectedDatasetId) return;

    setIsLinking(true);
    try {
      const response = await fetch(`/api/chatbots/${chatbotId}/datasets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ datasetId: selectedDatasetId }),
      });

      if (response.ok) {
        setSelectedDatasetId('');
        onUpdate();
      }
    } catch (err) {
      console.error('Link error:', err);
    } finally {
      setIsLinking(false);
    }
  };

  const handleUnlink = async (datasetId: string) => {
    const confirmed = await confirm({
      title: '데이터셋 연결 해제',
      message: '이 데이터셋 연결을 해제하시겠습니까?',
      confirmText: '연결 해제',
      cancelText: '취소',
    });

    if (!confirmed) return;

    setUnlinkingId(datasetId);
    try {
      const response = await fetch(
        `/api/chatbots/${chatbotId}/datasets/${datasetId}`,
        { method: 'DELETE' }
      );

      if (response.ok) {
        onUpdate();
      }
    } catch (err) {
      console.error('Unlink error:', err);
    } finally {
      setUnlinkingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* 데이터셋 연결 폼 */}
      <div className="rounded-lg border border-border bg-card p-4">
        <h3 className="mb-4 flex items-center gap-2 font-medium text-foreground">
          <Plus className="h-5 w-5" />
          데이터셋 연결
        </h3>
        <div className="flex gap-3">
          <select
            value={selectedDatasetId}
            onChange={(e) => setSelectedDatasetId(e.target.value)}
            className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="">연결할 데이터셋 선택...</option>
            {availableDatasets.map((dataset) => (
              <option key={dataset.id} value={dataset.id}>
                {dataset.name} ({dataset.documentCount}개 문서)
              </option>
            ))}
          </select>
          <button
            onClick={handleLink}
            disabled={!selectedDatasetId || isLinking}
            className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLinking ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            연결
          </button>
        </div>
        {availableDatasets.length === 0 && (
          <p className="mt-2 text-sm text-muted-foreground">
            연결 가능한 데이터셋이 없습니다. 먼저 데이터셋을 생성해주세요.
          </p>
        )}
      </div>

      {/* 연결된 데이터셋 목록 */}
      <div>
        <h3 className="mb-4 flex items-center gap-2 font-medium text-foreground">
          <Database className="h-5 w-5" />
          연결된 데이터셋 ({linkedDatasets.length})
        </h3>

        {linkedDatasets.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-card p-8 text-center">
            <Database className="mx-auto h-12 w-12 text-muted-foreground" />
            <p className="mt-4 text-muted-foreground">
              연결된 데이터셋이 없습니다.
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              데이터셋을 연결해야 챗봇이 답변할 수 있습니다.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {linkedDatasets.map((dataset) => (
              <div
                key={dataset.id}
                className="flex items-center justify-between rounded-lg border border-border bg-card p-4"
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <Database className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h4 className="font-medium text-foreground">
                      {dataset.name}
                    </h4>
                    <div className="mt-1 flex gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <FileText className="h-3.5 w-3.5" />
                        {dataset.documentCount}개 문서
                      </span>
                      <span className="flex items-center gap-1">
                        <Layers className="h-3.5 w-3.5" />
                        {dataset.chunkCount}개 청크
                      </span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => handleUnlink(dataset.id)}
                  disabled={unlinkingId === dataset.id}
                  className="flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
                >
                  {unlinkingId === dataset.id ? (
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
                  ) : (
                    <Unlink className="h-4 w-4" />
                  )}
                  연결 해제
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 안내 메시지 */}
      <div className="rounded-lg bg-muted/50 p-4">
        <h4 className="text-sm font-medium text-foreground">
          데이터셋 연결 안내
        </h4>
        <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
          <li>• 여러 데이터셋을 연결하면 모든 데이터셋에서 답변을 검색합니다.</li>
          <li>• 데이터셋이 없으면 위젯과 카카오 연동을 활성화할 수 없습니다.</li>
          <li>• 데이터셋 연결/해제는 즉시 반영됩니다.</li>
        </ul>
      </div>
    </div>
  );
}
