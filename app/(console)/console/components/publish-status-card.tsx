'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useCurrentChatbot } from '../hooks/use-console-state';
import { useAutoSaveContext } from '../hooks/use-auto-save';
import { useVersions } from '../hooks/use-versions';
import { VersionManagementDialog } from './version-management-dialog';
import { Button } from '@/components/ui/button';
import {
  ExternalLink,
  Rocket,
  Check,
  Loader2,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';

interface PublishStatusCardProps {
  /**
   * 'public-page' | 'widget' 모드
   */
  mode?: 'public-page' | 'widget';
}

/**
 * 발행 상태 카드
 *
 * 우측 사이드바 상단에 배치되어:
 * - 현재 발행 버전 vs 수정 버전 상태 표시
 * - 미리보기 버튼
 * - 발행 버튼 (클릭 시 버전 관리 다이얼로그 열림)
 */
export function PublishStatusCard({ mode = 'public-page' }: PublishStatusCardProps) {
  const { currentChatbot } = useCurrentChatbot();
  const { saveStatus } = useAutoSaveContext();
  const { versions, hasChanges, isPublishing } = useVersions();

  const [showVersionDialog, setShowVersionDialog] = useState(false);

  if (!currentChatbot) return null;

  const publishedVersion = versions?.published;
  const isWidgetMode = mode === 'widget';

  // 미리보기 URL
  const previewUrl = isWidgetMode
    ? `/widgets/${currentChatbot.id}/preview`
    : `/${currentChatbot.slug}`;

  // 미리보기 가능 여부
  const canPreview = isWidgetMode
    ? currentChatbot.widgetEnabled
    : currentChatbot.publicPageEnabled && currentChatbot.slug;

  return (
    <>
      <div className="rounded-lg border border-border bg-muted/30 p-4">
        {/* 상태 표시 */}
        <div className="mb-3 flex items-center justify-between">
          {/* 발행 버전 */}
          <div className="flex items-center gap-2">
            {publishedVersion ? (
              <>
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span className="text-sm font-medium text-foreground">
                  v{publishedVersion.versionNumber || 1} 발행됨
                </span>
              </>
            ) : (
              <>
                <AlertCircle className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">미발행</span>
              </>
            )}
          </div>

          {/* 수정 상태 */}
          {hasChanges && (
            <span className="rounded-full bg-yellow-500/10 px-2 py-0.5 text-xs font-medium text-yellow-600 dark:text-yellow-400">
              수정됨
            </span>
          )}
        </div>

        {/* 버튼 그룹 */}
        <div className="flex gap-2">
          {/* 미리보기 버튼 */}
          {canPreview && (
            <Button variant="outline" size="sm" className="flex-1" asChild>
              <Link href={previewUrl} target="_blank">
                <ExternalLink className="mr-1.5 h-4 w-4" />
                미리보기
              </Link>
            </Button>
          )}

          {/* 발행 버튼 */}
          <Button
            size="sm"
            className="flex-1"
            onClick={() => setShowVersionDialog(true)}
            disabled={saveStatus === 'saving' || isPublishing}
          >
            {isPublishing ? (
              <>
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                발행 중...
              </>
            ) : hasChanges ? (
              <>
                <Rocket className="mr-1.5 h-4 w-4" />
                발행하기
              </>
            ) : (
              <>
                <Check className="mr-1.5 h-4 w-4" />
                버전 관리
              </>
            )}
          </Button>
        </div>
      </div>

      {/* 버전 관리 다이얼로그 */}
      <VersionManagementDialog
        isOpen={showVersionDialog}
        onClose={() => setShowVersionDialog(false)}
        mode={mode}
      />
    </>
  );
}
