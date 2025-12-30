/**
 * 데이터셋 상세 컨테이너 컴포넌트
 */

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Database,
  FileText,
  Layers,
  HardDrive,
  Bot,
  Pencil,
  Check,
  X,
  Upload,
  CheckCircle2,
} from 'lucide-react';
import { DatasetDocuments } from './dataset-documents';

interface DatasetData {
  id: string;
  name: string;
  description: string | null;
  status: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
  stats: {
    documentCount: number;
    totalStorageBytes: number;
    chunkCount: number;
    approvedChunkCount: number;
    connectedChatbots: number;
  };
}

interface DatasetDetailProps {
  datasetId: string;
}

export function DatasetDetail({ datasetId }: DatasetDetailProps) {
  const [dataset, setDataset] = useState<DatasetData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchDataset();
  }, [datasetId]);

  const fetchDataset = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/datasets/${datasetId}`);
      if (!response.ok) {
        if (response.status === 404) {
          setError('데이터셋을 찾을 수 없습니다');
        } else {
          setError('데이터셋 정보를 불러오는데 실패했습니다');
        }
        return;
      }
      const data = await response.json();
      setDataset(data.dataset);
      setEditName(data.dataset.name);
      setEditDescription(data.dataset.description || '');
    } catch (err) {
      setError('데이터셋 정보를 불러오는데 실패했습니다');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!editName.trim()) return;

    setIsSaving(true);
    try {
      const response = await fetch(`/api/datasets/${datasetId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName.trim(),
          description: editDescription.trim() || null,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setDataset((prev) =>
          prev
            ? {
                ...prev,
                name: data.dataset.name,
                description: data.dataset.description,
              }
            : null
        );
        setIsEditing(false);
      }
    } catch (err) {
      console.error('Save error:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (error || !dataset) {
    return (
      <div className="rounded-lg border border-border bg-card p-12 text-center">
        <Database className="mx-auto h-12 w-12 text-muted-foreground" />
        <h3 className="mt-4 text-lg font-medium text-foreground">
          {error || '데이터셋을 찾을 수 없습니다'}
        </h3>
        <Link
          href="/datasets"
          className="mt-4 inline-flex items-center gap-2 text-sm text-primary hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          데이터셋 목록으로 돌아가기
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <Link
            href="/datasets"
            className="mt-1 rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            {isEditing ? (
              <div className="space-y-2">
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="rounded-md border border-border bg-background px-3 py-1.5 text-lg font-bold text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder="데이터셋 이름"
                />
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder="설명 (선택사항)"
                  rows={2}
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleSaveEdit}
                    disabled={isSaving || !editName.trim()}
                    className="flex items-center gap-1 rounded-md bg-primary px-3 py-1 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                  >
                    <Check className="h-4 w-4" />
                    저장
                  </button>
                  <button
                    onClick={() => {
                      setIsEditing(false);
                      setEditName(dataset.name);
                      setEditDescription(dataset.description || '');
                    }}
                    className="flex items-center gap-1 rounded-md border border-border px-3 py-1 text-sm text-foreground hover:bg-muted"
                  >
                    <X className="h-4 w-4" />
                    취소
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-bold text-foreground">
                    {dataset.name}
                  </h1>
                  {dataset.isDefault && (
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                      기본
                    </span>
                  )}
                  {dataset.status === 'archived' && (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                      보관됨
                    </span>
                  )}
                  <button
                    onClick={() => setIsEditing(true)}
                    className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                </div>
                {dataset.description && (
                  <p className="mt-1 text-muted-foreground">
                    {dataset.description}
                  </p>
                )}
              </>
            )}
          </div>
        </div>

        {/* 업로드 버튼 */}
        <Link
          href={`/documents?datasetId=${datasetId}`}
          className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Upload className="h-4 w-4" />
          문서 업로드
        </Link>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <FileText className="h-4 w-4" />
            <span className="text-xs">문서</span>
          </div>
          <p className="mt-2 text-2xl font-bold text-foreground">
            {dataset.stats.documentCount}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Layers className="h-4 w-4" />
            <span className="text-xs">청크</span>
          </div>
          <p className="mt-2 text-2xl font-bold text-foreground">
            {dataset.stats.chunkCount}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <CheckCircle2 className="h-4 w-4" />
            <span className="text-xs">승인됨</span>
          </div>
          <p className="mt-2 text-2xl font-bold text-foreground">
            {dataset.stats.approvedChunkCount}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <HardDrive className="h-4 w-4" />
            <span className="text-xs">저장 용량</span>
          </div>
          <p className="mt-2 text-2xl font-bold text-foreground">
            {formatBytes(dataset.stats.totalStorageBytes)}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Bot className="h-4 w-4" />
            <span className="text-xs">연결된 챗봇</span>
          </div>
          <p className="mt-2 text-2xl font-bold text-foreground">
            {dataset.stats.connectedChatbots}
          </p>
        </div>
      </div>

      {/* 문서 목록 */}
      <DatasetDocuments datasetId={datasetId} onUpdate={fetchDataset} />
    </div>
  );
}
