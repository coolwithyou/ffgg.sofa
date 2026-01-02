/**
 * 데이터셋 목록 컴포넌트
 * Console 마이그레이션 - Link href 업데이트
 */

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { FolderOpen, FileText, MoreVertical, Pencil, Trash2, Star } from 'lucide-react';
import { useAlertDialog } from '@/components/ui/alert-dialog';
import { useToast } from '@/components/ui/toast';
import type { DatasetSummary } from './actions';
import { deleteDataset, updateDataset, setDefaultDataset } from './actions';

interface DatasetListProps {
  datasets: DatasetSummary[];
}

export function DatasetList({ datasets }: DatasetListProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSettingDefault, setIsSettingDefault] = useState(false);
  const { confirm } = useAlertDialog();
  const { error } = useToast();

  const handleEdit = (dataset: DatasetSummary) => {
    setEditingId(dataset.id);
    setEditName(dataset.name);
    setEditDescription(dataset.description || '');
    setMenuOpenId(null);
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;

    const result = await updateDataset(editingId, {
      name: editName,
      description: editDescription,
    });

    if (result.success) {
      setEditingId(null);
    } else {
      error('저장 실패', result.error);
    }
  };

  const handleDelete = async (id: string) => {
    const confirmed = await confirm({
      title: '데이터셋 삭제',
      message: '이 데이터셋을 삭제하시겠습니까? 연결된 모든 문서와 청크도 함께 삭제됩니다.',
      confirmText: '삭제',
      cancelText: '취소',
      variant: 'destructive',
    });

    if (!confirmed) return;

    setIsDeleting(true);
    const result = await deleteDataset(id);
    setIsDeleting(false);
    setMenuOpenId(null);

    if (!result.success) {
      error('삭제 실패', result.error);
    }
  };

  const handleSetDefault = async (id: string) => {
    setIsSettingDefault(true);
    const result = await setDefaultDataset(id);
    setIsSettingDefault(false);
    setMenuOpenId(null);

    if (!result.success) {
      error('설정 실패', result.error);
    }
  };

  if (datasets.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-12 text-center">
        <FolderOpen className="mx-auto h-12 w-12 text-muted-foreground" />
        <h3 className="mt-4 text-lg font-medium text-foreground">데이터셋이 없습니다</h3>
        <p className="mt-2 text-muted-foreground">
          새 데이터셋을 생성하여 문서를 구성하세요.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="grid grid-cols-1 divide-y divide-border">
        {datasets.map((dataset) => (
          <div
            key={dataset.id}
            className="flex items-center justify-between p-4 hover:bg-muted/50"
          >
            <div className="flex items-center gap-4 flex-1 min-w-0">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <FolderOpen className="h-5 w-5 text-primary" />
              </div>

              <div className="min-w-0 flex-1">
                {editingId === dataset.id ? (
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
                      placeholder="데이터셋 이름"
                    />
                    <input
                      type="text"
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground"
                      placeholder="설명 (선택사항)"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={handleSaveEdit}
                        className="rounded-md bg-primary px-3 py-1 text-sm text-primary-foreground hover:bg-primary/90"
                      >
                        저장
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="rounded-md border border-border px-3 py-1 text-sm text-foreground hover:bg-muted"
                      >
                        취소
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/console/chatbot/datasets/${dataset.id}`}
                        className="truncate font-medium text-foreground hover:text-primary"
                      >
                        {dataset.name}
                      </Link>
                      {dataset.isDefault && (
                        <span className="flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                          <Star className="h-3 w-3" />
                          기본
                        </span>
                      )}
                    </div>
                    {dataset.description && (
                      <p className="mt-1 truncate text-sm text-muted-foreground">
                        {dataset.description}
                      </p>
                    )}
                  </>
                )}
              </div>
            </div>

            {editingId !== dataset.id && (
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <FileText className="h-4 w-4" />
                    {dataset.documentCount}개 문서
                  </span>
                  <span>{dataset.chunkCount}개 청크</span>
                </div>

                <div className="relative">
                  <button
                    onClick={() => setMenuOpenId(menuOpenId === dataset.id ? null : dataset.id)}
                    className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <MoreVertical className="h-5 w-5" />
                  </button>

                  {menuOpenId === dataset.id && (
                    <div className="absolute right-0 top-full z-10 mt-1 w-40 rounded-lg border border-border bg-card py-1 shadow-lg">
                      <button
                        onClick={() => handleEdit(dataset)}
                        className="flex w-full items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-muted"
                      >
                        <Pencil className="h-4 w-4" />
                        수정
                      </button>
                      {!dataset.isDefault && (
                        <>
                          <button
                            onClick={() => handleSetDefault(dataset.id)}
                            disabled={isSettingDefault}
                            className="flex w-full items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-muted"
                          >
                            <Star className="h-4 w-4" />
                            기본으로 설정
                          </button>
                          <button
                            onClick={() => handleDelete(dataset.id)}
                            disabled={isDeleting}
                            className="flex w-full items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="h-4 w-4" />
                            삭제
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
