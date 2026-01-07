'use client';

import { useState } from 'react';
import { useVersions, type HistoryVersion, type PublishedVersion } from '../hooks/use-versions';
import { useAutoSaveContext } from '../hooks/use-auto-save';
import { toast } from 'sonner';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useAlertDialog } from '@/components/ui/alert-dialog';
import { useEmailVerification } from '@/components/email-verification-modal';
import {
  Rocket,
  RotateCcw,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  FileText,
  Calendar,
  History,
} from 'lucide-react';

interface VersionManagementDialogProps {
  isOpen: boolean;
  onClose: () => void;
  mode?: 'public-page' | 'widget';
}

type SelectedVersion =
  | { type: 'draft' }
  | { type: 'published'; data: PublishedVersion }
  | { type: 'history'; data: HistoryVersion };

/**
 * 버전 관리 다이얼로그
 *
 * 좌측: 버전 히스토리 목록
 * 우측: 선택된 버전 상세 정보
 * 하단: 발행 액션
 */
export function VersionManagementDialog({
  isOpen,
  onClose,
  mode = 'public-page',
}: VersionManagementDialogProps) {
  const {
    versions,
    hasChanges,
    isPublishing,
    isReverting,
    publish,
    revert,
    rollback,
  } = useVersions();
  const { saveStatus, saveNow } = useAutoSaveContext();
  const { confirm } = useAlertDialog();
  const { requireEmailVerification } = useEmailVerification();

  const [publishNote, setPublishNote] = useState('');
  const [selectedVersion, setSelectedVersion] = useState<SelectedVersion>({
    type: 'draft',
  });

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

  // 발행 핸들러
  const handlePublish = async () => {
    // 이메일 인증 확인 (Delayed Verification)
    const verified = await requireEmailVerification();
    if (!verified) return; // 인증 취소 시 발행 중단

    // 저장되지 않은 변경사항이 있으면 먼저 저장
    if (saveStatus === 'unsaved') {
      await saveNow();
    }

    try {
      await publish(publishNote || undefined);
      setPublishNote('');
      toast.success('발행 완료', { description: '변경사항이 공개 페이지에 적용되었습니다.' });
      onClose();
    } catch (error) {
      toast.error('발행 실패', {
        description: error instanceof Error ? error.message : '잠시 후 다시 시도해주세요.',
      });
    }
  };

  // 되돌리기 핸들러 (published → draft)
  const handleRevert = async () => {
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
      onClose();
      // Note: window.location.reload() 제거 - useVersions의 revert()에서 Console 상태를 직접 동기화
    } catch (error) {
      toast.error('되돌리기 실패', {
        description: error instanceof Error ? error.message : '잠시 후 다시 시도해주세요.',
      });
    }
  };

  // 롤백 핸들러 (history → draft)
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
      toast.success('롤백 완료', {
        description: `버전 ${version.versionNumber}이 초안으로 복원되었습니다.`,
      });
      onClose();
      // Note: window.location.reload() 제거 - useVersions의 rollback()에서 Console 상태를 직접 동기화
    } catch (error) {
      toast.error('롤백 실패', {
        description: error instanceof Error ? error.message : '잠시 후 다시 시도해주세요.',
      });
    }
  };

  const handleDialogClose = () => {
    if (!isPublishing && !isReverting) {
      setPublishNote('');
      setSelectedVersion({ type: 'draft' });
      onClose();
    }
  };

  const modeLabel = mode === 'widget' ? '위젯' : '공개 페이지';

  return (
    <Dialog
      isOpen={isOpen}
      onClose={handleDialogClose}
      title="버전 관리"
      description={`${modeLabel}의 발행 버전을 관리합니다.`}
      maxWidth="2xl"
    >
      <div className="flex h-[450px] gap-4">
        {/* 좌측: 버전 목록 */}
        <div className="w-48 flex-shrink-0 border-r border-border pr-4">
          <h4 className="mb-3 flex items-center gap-2 text-sm font-medium text-foreground">
            <History className="h-4 w-4" />
            버전 히스토리
          </h4>

          <div className="h-[380px] overflow-y-auto">
            <div className="space-y-2 pr-2">
              {/* 현재 초안 */}
              <button
                onClick={() => setSelectedVersion({ type: 'draft' })}
                className={`w-full rounded-lg border p-3 text-left transition-colors ${
                  selectedVersion.type === 'draft'
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:bg-muted/50'
                }`}
              >
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">현재 초안</span>
                </div>
                {hasChanges && (
                  <span className="mt-1 inline-block rounded-full bg-yellow-500/10 px-2 py-0.5 text-xs text-yellow-600 dark:text-yellow-400">
                    수정됨
                  </span>
                )}
              </button>

              {/* 현재 발행 버전 */}
              {versions?.published && (
                <button
                  onClick={() =>
                    setSelectedVersion({
                      type: 'published',
                      data: versions.published!,
                    })
                  }
                  className={`w-full rounded-lg border p-3 text-left transition-colors ${
                    selectedVersion.type === 'published'
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:bg-muted/50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <span className="text-sm font-medium">
                      v{versions.published.versionNumber || 1}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatDate(versions.published.publishedAt)}
                  </p>
                </button>
              )}

              {/* 히스토리 버전 */}
              {versions?.history?.map((version) => (
                <button
                  key={version.id}
                  onClick={() =>
                    setSelectedVersion({ type: 'history', data: version })
                  }
                  className={`w-full rounded-lg border p-3 text-left transition-colors ${
                    selectedVersion.type === 'history' &&
                    selectedVersion.data.id === version.id
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:bg-muted/50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">
                      v{version.versionNumber || '?'}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatDate(version.publishedAt)}
                  </p>
                </button>
              ))}

              {/* 히스토리 없음 */}
              {!versions?.published && !versions?.history?.length && (
                <div className="py-8 text-center">
                  <AlertCircle className="mx-auto h-8 w-8 text-muted-foreground/50" />
                  <p className="mt-2 text-xs text-muted-foreground">
                    아직 발행된 버전이 없습니다.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 우측: 선택된 버전 상세 + 발행 액션 */}
        <div className="flex flex-1 flex-col">
          {/* 상세 정보 */}
          <div className="flex-1">
            {selectedVersion.type === 'draft' && (
              <DraftDetail
                hasChanges={hasChanges}
                publishNote={publishNote}
                onPublishNoteChange={setPublishNote}
              />
            )}

            {selectedVersion.type === 'published' && (
              <PublishedDetail
                version={selectedVersion.data}
                hasChanges={hasChanges}
                onRevert={handleRevert}
                isReverting={isReverting}
                formatDate={formatDate}
              />
            )}

            {selectedVersion.type === 'history' && (
              <HistoryDetail
                version={selectedVersion.data}
                onRollback={() => handleRollback(selectedVersion.data)}
                isReverting={isReverting}
                formatDate={formatDate}
              />
            )}
          </div>

          {/* 하단 액션 버튼 */}
          <div className="flex justify-end gap-2 border-t border-border pt-4">
            <Button
              variant="outline"
              onClick={handleDialogClose}
              disabled={isPublishing || isReverting}
            >
              닫기
            </Button>

            {selectedVersion.type === 'draft' && hasChanges && (
              <Button
                onClick={handlePublish}
                disabled={isPublishing || saveStatus === 'saving'}
              >
                {isPublishing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    발행 중...
                  </>
                ) : (
                  <>
                    <Rocket className="mr-2 h-4 w-4" />
                    발행하기
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    </Dialog>
  );
}

// 초안 상세 컴포넌트
function DraftDetail({
  hasChanges,
  publishNote,
  onPublishNoteChange,
}: {
  hasChanges: boolean;
  publishNote: string;
  onPublishNoteChange: (note: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-foreground">현재 초안</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          편집 중인 내용입니다. 발행하면 방문자에게 공개됩니다.
        </p>
      </div>

      {hasChanges ? (
        <>
          <div className="flex items-center gap-2 rounded-lg bg-yellow-500/10 p-3">
            <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
            <div>
              <p className="text-sm font-medium text-foreground">
                미발행 변경사항이 있습니다
              </p>
              <p className="text-xs text-muted-foreground">
                발행하면 모든 방문자가 변경된 내용을 볼 수 있습니다.
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="publish-note">발행 메모 (선택)</Label>
            <Textarea
              id="publish-note"
              placeholder="이번 발행의 변경사항을 간단히 기록하세요..."
              value={publishNote}
              onChange={(e) => onPublishNoteChange(e.target.value)}
              rows={3}
            />
            <p className="text-xs text-muted-foreground">
              나중에 버전 히스토리에서 확인할 수 있습니다.
            </p>
          </div>
        </>
      ) : (
        <div className="flex items-center gap-2 rounded-lg bg-green-500/10 p-3">
          <CheckCircle2 className="h-5 w-5 text-green-500" />
          <div>
            <p className="text-sm font-medium text-foreground">최신 상태</p>
            <p className="text-xs text-muted-foreground">
              현재 초안과 발행된 버전이 동일합니다.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// 발행 버전 상세 컴포넌트
function PublishedDetail({
  version,
  hasChanges,
  onRevert,
  isReverting,
  formatDate,
}: {
  version: PublishedVersion;
  hasChanges: boolean;
  onRevert: () => void;
  isReverting: boolean;
  formatDate: (date: string | null) => string;
}) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-foreground">
          버전 {version.versionNumber || 1} (현재 공개 중)
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          현재 방문자에게 공개된 버전입니다.
        </p>
      </div>

      <div className="rounded-lg border border-border p-4 space-y-3">
        <div className="flex items-center gap-3">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <div>
            <p className="text-xs text-muted-foreground">발행일</p>
            <p className="text-sm font-medium text-foreground">
              {formatDate(version.publishedAt)}
            </p>
          </div>
        </div>

        {version.publishNote && (
          <div className="flex items-start gap-3">
            <FileText className="mt-0.5 h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">발행 메모</p>
              <p className="text-sm text-foreground">{version.publishNote}</p>
            </div>
          </div>
        )}
      </div>

      {hasChanges && (
        <Button
          variant="outline"
          onClick={onRevert}
          disabled={isReverting}
          className="w-full"
        >
          {isReverting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RotateCcw className="mr-2 h-4 w-4" />
          )}
          이 버전으로 초안 되돌리기
        </Button>
      )}
    </div>
  );
}

// 히스토리 버전 상세 컴포넌트
function HistoryDetail({
  version,
  onRollback,
  isReverting,
  formatDate,
}: {
  version: HistoryVersion;
  onRollback: () => void;
  isReverting: boolean;
  formatDate: (date: string | null) => string;
}) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-foreground">
          버전 {version.versionNumber || '?'}
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          이전에 발행되었던 버전입니다.
        </p>
      </div>

      <div className="rounded-lg border border-border p-4 space-y-3">
        <div className="flex items-center gap-3">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <div>
            <p className="text-xs text-muted-foreground">발행일</p>
            <p className="text-sm font-medium text-foreground">
              {formatDate(version.publishedAt)}
            </p>
          </div>
        </div>

        {version.publishNote && (
          <div className="flex items-start gap-3">
            <FileText className="mt-0.5 h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">발행 메모</p>
              <p className="text-sm text-foreground">{version.publishNote}</p>
            </div>
          </div>
        )}
      </div>

      <Button
        variant="outline"
        onClick={onRollback}
        disabled={isReverting}
        className="w-full"
      >
        {isReverting ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <RotateCcw className="mr-2 h-4 w-4" />
        )}
        이 버전으로 초안 복원
      </Button>
    </div>
  );
}
