'use client';

/**
 * 버전 히스토리 모달
 *
 * 페이지의 발행 버전 히스토리를 조회하고,
 * 이전 버전의 콘텐츠를 미리보거나 복원할 수 있습니다.
 */

import { useState, useEffect, useCallback } from 'react';
import { History, Clock, Check, RotateCcw, Eye, FileText, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useAlertDialog } from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { getPageVersions, restoreVersion } from '../actions';
import { cn } from '@/lib/utils';

interface Version {
  id: string;
  versionNumber: number;
  versionType: 'published' | 'history';
  title: string;
  content: string;
  path: string;
  publishedAt: Date;
}

interface VersionHistoryModalProps {
  pageId: string;
  /** 버전이 복원된 후 호출되는 콜백 */
  onRestore: () => void;
  /** 발행 버전 존재 여부 (버튼 비활성화용) */
  hasPublishedVersion: boolean;
}

export function VersionHistoryModal({
  pageId,
  onRestore,
  hasPublishedVersion,
}: VersionHistoryModalProps) {
  const [open, setOpen] = useState(false);
  const [versions, setVersions] = useState<Version[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState<Version | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const { confirm } = useAlertDialog();

  // 버전 목록 로드
  const loadVersions = useCallback(async () => {
    if (!pageId) return;

    setIsLoading(true);
    try {
      const result = await getPageVersions(pageId);
      if (result.success && result.versions) {
        setVersions(result.versions);
        // 첫 번째 버전 자동 선택 (현재 발행 버전)
        if (result.versions.length > 0 && !selectedVersion) {
          setSelectedVersion(result.versions[0]);
        }
      } else {
        toast.error(result.error || '버전 목록을 불러오는데 실패했습니다.');
      }
    } catch {
      toast.error('버전 목록을 불러오는 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, [pageId, selectedVersion]);

  // 모달 열릴 때 버전 목록 로드
  useEffect(() => {
    if (open) {
      loadVersions();
    }
  }, [open, loadVersions]);

  // 날짜 포맷팅
  const formatDate = (date: Date) => {
    const d = new Date(date);
    return d.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // 버전 복원 핸들러
  const handleRestore = async (version: Version) => {
    await confirm({
      title: '버전 복원',
      message: `버전 ${version.versionNumber}의 내용을 현재 편집본으로 복원하시겠습니까?\n\n현재 편집 중인 내용은 덮어쓰여집니다.`,
      confirmText: '복원',
      cancelText: '취소',
      variant: 'default',
      onConfirm: async () => {
        setIsRestoring(true);
        try {
          const result = await restoreVersion(version.id);
          if (result.success) {
            toast.success(`버전 ${version.versionNumber}이(가) 복원되었습니다.`);
            setOpen(false);
            onRestore();
          } else {
            throw new Error(result.error || '복원에 실패했습니다.');
          }
        } finally {
          setIsRestoring(false);
        }
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          title="버전 히스토리"
          disabled={!hasPublishedVersion}
        >
          <History className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            버전 히스토리
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex h-[400px] items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : versions.length === 0 ? (
          <div className="flex h-[400px] flex-col items-center justify-center gap-3 text-center">
            <FileText className="h-12 w-12 text-muted-foreground/50" />
            <div>
              <p className="text-sm font-medium text-foreground">버전 히스토리가 없습니다</p>
              <p className="text-xs text-muted-foreground">페이지를 발행하면 버전이 기록됩니다.</p>
            </div>
          </div>
        ) : (
          <div className="flex h-[500px] gap-4">
            {/* 좌측: 버전 목록 */}
            <div className="w-64 shrink-0 overflow-y-auto border-r border-border pr-4">
              <div className="space-y-2">
                {versions.map((version) => (
                  <button
                    key={version.id}
                    onClick={() => setSelectedVersion(version)}
                    className={cn(
                      'w-full rounded-lg border p-3 text-left transition-colors',
                      selectedVersion?.id === version.id
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:bg-muted/50'
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">v{version.versionNumber}</span>
                      {version.versionType === 'published' ? (
                        <Badge variant="default" className="text-[10px]">
                          <Check className="mr-1 h-3 w-3" />
                          현재
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-[10px]">
                          히스토리
                        </Badge>
                      )}
                    </div>
                    <p className="mt-1 truncate text-xs text-muted-foreground">{version.title}</p>
                    <div className="mt-2 flex items-center text-[10px] text-muted-foreground">
                      <Clock className="mr-1 h-3 w-3" />
                      {formatDate(version.publishedAt)}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* 우측: 선택된 버전 미리보기 */}
            <div className="flex flex-1 flex-col overflow-hidden">
              {selectedVersion ? (
                <>
                  {/* 버전 정보 헤더 */}
                  <div className="mb-3 flex items-center justify-between border-b border-border pb-3">
                    <div>
                      <h3 className="text-sm font-semibold">
                        버전 {selectedVersion.versionNumber} - {selectedVersion.title}
                      </h3>
                      <p className="text-xs text-muted-foreground">{selectedVersion.path}</p>
                    </div>
                    {selectedVersion.versionType === 'history' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleRestore(selectedVersion)}
                        disabled={isRestoring}
                      >
                        <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                        복원
                      </Button>
                    )}
                  </div>

                  {/* 콘텐츠 미리보기 */}
                  <div className="flex-1 overflow-y-auto rounded-lg border border-border bg-muted/20 p-4">
                    <article className="prose prose-sm max-w-none dark:prose-invert prose-headings:font-semibold prose-p:text-muted-foreground">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {selectedVersion.content || '*내용 없음*'}
                      </ReactMarkdown>
                    </article>
                  </div>
                </>
              ) : (
                <div className="flex h-full items-center justify-center text-muted-foreground">
                  <Eye className="mr-2 h-5 w-5" />
                  버전을 선택하면 미리보기가 표시됩니다.
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
