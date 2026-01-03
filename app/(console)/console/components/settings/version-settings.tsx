'use client';

import { useVersions, type HistoryVersion } from '../../hooks/use-versions';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useAlertDialog } from '@/components/ui/alert-dialog';
import {
  RotateCcw,
  History,
  Clock,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';

/**
 * 버전 관리 설정 패널
 *
 * - 현재 발행 버전 정보 표시 (발행일, 메모)
 * - 되돌리기: published → draft 복원
 * - 히스토리 목록 및 롤백 기능
 */
export function VersionSettings() {
  const {
    versions,
    hasChanges,
    isLoading,
    isReverting,
    revert,
    rollback,
    refreshVersions,
  } = useVersions();
  const { confirm } = useAlertDialog();

  // 발행 버전 되돌리기 핸들러
  const handleRevert = async () => {
    if (!versions?.published) return;

    const confirmed = await confirm({
      title: '발행 버전으로 되돌리기',
      message:
        '현재 편집 중인 내용을 폐기하고 마지막 발행 버전으로 되돌립니다. 이 작업은 되돌릴 수 없습니다.',
      confirmText: '되돌리기',
      cancelText: '취소',
      variant: 'destructive',
    });

    if (!confirmed) return;

    try {
      await revert();
      toast.success('되돌리기 완료', { description: '마지막 발행 버전으로 복원되었습니다.' });
      // 페이지 새로고침하여 draft 내용 반영
      window.location.reload();
    } catch (error) {
      toast.error('되돌리기 실패', {
        description: error instanceof Error ? error.message : '잠시 후 다시 시도해주세요.',
      });
    }
  };

  // 히스토리 버전 롤백 핸들러
  const handleRollback = async (version: HistoryVersion) => {
    const confirmed = await confirm({
      title: '이전 버전으로 롤백',
      message: `버전 ${version.versionNumber || '?'}을 초안으로 복원합니다. 현재 편집 중인 내용은 폐기됩니다.`,
      confirmText: '롤백',
      cancelText: '취소',
      variant: 'destructive',
    });

    if (!confirmed) return;

    try {
      await rollback(version.id);
      toast.success('롤백 완료', { description: `버전 ${version.versionNumber}이 초안으로 복원되었습니다.` });
      window.location.reload();
    } catch (error) {
      toast.error('롤백 실패', {
        description: error instanceof Error ? error.message : '잠시 후 다시 시도해주세요.',
      });
    }
  };

  // 날짜 포맷팅
  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('ko-KR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4 pt-2">
      {/* 현재 상태 */}
      <div className="rounded-lg border border-border bg-muted/50 p-3">
        <div className="flex items-center gap-2">
          {hasChanges ? (
            <>
              <AlertCircle className="h-4 w-4 text-yellow-500" />
              <span className="text-sm font-medium text-foreground">
                미발행 변경사항 있음
              </span>
            </>
          ) : (
            <>
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span className="text-sm font-medium text-foreground">
                최신 상태
              </span>
            </>
          )}
        </div>
        {hasChanges && (
          <p className="mt-1 text-xs text-muted-foreground">
            헤더의 &quot;발행&quot; 버튼으로 변경사항을 공개할 수 있습니다.
          </p>
        )}
      </div>

      {/* 현재 발행 버전 정보 */}
      {versions?.published && (
        <div className="space-y-2">
          <h4 className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Clock className="h-4 w-4 text-muted-foreground" />
            현재 발행 버전
          </h4>
          <div className="rounded-lg border border-border p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">버전</span>
              <span className="text-sm font-medium text-foreground">
                v{versions.published.versionNumber || 1}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">발행일</span>
              <span className="text-sm text-foreground">
                {formatDate(versions.published.publishedAt)}
              </span>
            </div>
            {versions.published.publishNote && (
              <div className="pt-1">
                <span className="text-xs text-muted-foreground">메모</span>
                <p className="mt-0.5 text-sm text-foreground">
                  {versions.published.publishNote}
                </p>
              </div>
            )}

            {/* 되돌리기 버튼 */}
            {hasChanges && (
              <Button
                variant="outline"
                size="sm"
                className="mt-2 w-full"
                onClick={handleRevert}
                disabled={isReverting}
              >
                {isReverting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RotateCcw className="mr-2 h-4 w-4" />
                )}
                발행 버전으로 되돌리기
              </Button>
            )}
          </div>
        </div>
      )}

      {/* 버전 히스토리 */}
      {versions?.history && versions.history.length > 0 && (
        <div className="space-y-2">
          <h4 className="flex items-center gap-2 text-sm font-medium text-foreground">
            <History className="h-4 w-4 text-muted-foreground" />
            이전 버전
          </h4>
          <div className="space-y-2">
            {versions.history.map((version) => (
              <div
                key={version.id}
                className="rounded-lg border border-border p-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground">
                    v{version.versionNumber || '?'}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatDate(version.publishedAt)}
                  </span>
                </div>
                {version.publishNote && (
                  <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                    {version.publishNote}
                  </p>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-2 h-7 w-full text-xs"
                  onClick={() => handleRollback(version)}
                  disabled={isReverting}
                >
                  <RotateCcw className="mr-1.5 h-3 w-3" />
                  이 버전으로 롤백
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 히스토리가 없는 경우 */}
      {(!versions?.history || versions.history.length === 0) && !versions?.published && (
        <div className="py-4 text-center">
          <History className="mx-auto h-8 w-8 text-muted-foreground/50" />
          <p className="mt-2 text-sm text-muted-foreground">
            아직 발행된 버전이 없습니다.
          </p>
        </div>
      )}
    </div>
  );
}
