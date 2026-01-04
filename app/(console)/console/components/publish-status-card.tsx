'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { useCurrentChatbot, usePageConfig } from '../hooks/use-console-state';
import { useAutoSaveContext } from '../hooks/use-auto-save';
import { useVersions } from '../hooks/use-versions';
import { VersionManagementDialog } from './version-management-dialog';
import { savePreviewData } from '@/lib/public-page/preview-storage';
import { Button } from '@/components/ui/button';
import {
  Eye,
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
  const { pageConfig } = usePageConfig();
  const { saveStatus } = useAutoSaveContext();
  const { versions, hasChanges, isPublishing } = useVersions();

  const [showVersionDialog, setShowVersionDialog] = useState(false);

  if (!currentChatbot) return null;

  const publishedVersion = versions?.published;
  const isWidgetMode = mode === 'widget';

  // 미리보기 가능 여부
  const canPreview = isWidgetMode
    ? currentChatbot.widgetEnabled
    : currentChatbot.publicPageEnabled && currentChatbot.slug;

  // 미리보기 URL (localStorage에 데이터 저장 후 이동)
  const previewUrl = isWidgetMode
    ? `/widgets/${currentChatbot.id}/preview`
    : `/${currentChatbot.slug}?preview=true`;

  // 발행 페이지 URL (실제 발행된 버전)
  const publishedUrl = isWidgetMode
    ? `/widgets/${currentChatbot.id}/preview`
    : `/${currentChatbot.slug}`;

  /**
   * 미리보기 클릭 핸들러
   * localStorage에 현재 편집 중인 설정을 저장하고 새 탭에서 열기
   */
  const handlePreviewClick = useCallback(() => {
    if (isWidgetMode) {
      // 위젯 모드는 기존 방식 유지
      window.open(previewUrl, '_blank');
      return;
    }

    // 공개 페이지 모드: localStorage에 현재 설정 저장
    if (pageConfig && currentChatbot) {
      savePreviewData(currentChatbot.id, pageConfig, currentChatbot.name);
    }
    window.open(previewUrl, '_blank');
  }, [isWidgetMode, previewUrl, pageConfig, currentChatbot]);

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
        <div className="flex flex-col gap-2">
          {/* 미리보기 + 발행 페이지 보기 */}
          {canPreview && (
            <div className="flex gap-2">
              {/* 미리보기 버튼 (편집 중인 상태) */}
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={handlePreviewClick}
              >
                <Eye className="mr-1.5 h-4 w-4" />
                미리보기
              </Button>

              {/* 발행 페이지 보기 버튼 (발행된 버전) */}
              {publishedVersion && (
                <Button variant="outline" size="sm" className="flex-1" asChild>
                  <Link href={publishedUrl} target="_blank">
                    <ExternalLink className="mr-1.5 h-4 w-4" />
                    발행 페이지
                  </Link>
                </Button>
              )}
            </div>
          )}

          {/* 발행 버튼 */}
          <Button
            size="sm"
            className="w-full"
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
