'use client';

/**
 * Knowledge Pages 에디터 컴포넌트
 *
 * PC: 좌측 마크다운 에디터 + 우측 실시간 미리보기 (2열 레이아웃)
 * 모바일: 편집/미리보기 토글 방식
 */

import { useState, useCallback, useEffect } from 'react';
import {
  Save,
  Eye,
  MoreVertical,
  Trash2,
  Globe,
  GlobeLock,
  PenLine,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAlertDialog } from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { MarkdownEditor } from '@/components/ui/markdown-editor';
import type { KnowledgePage } from '@/lib/db';
import {
  updateKnowledgePage,
  deleteKnowledgePage,
  publishKnowledgePage,
  unpublishKnowledgePage,
  getPublishedVersion,
} from './actions';
import { MarkdownHelpModal } from './_components/markdown-help-modal';
import { VersionHistoryModal } from './_components/version-history-modal';

interface PageEditorProps {
  page: KnowledgePage;
  onUpdate: () => void;
  onDelete: () => void;
}

export function PageEditor({ page, onUpdate, onDelete }: PageEditorProps) {
  const [title, setTitle] = useState(page.title);
  const [content, setContent] = useState(page.content);
  const [showPreview, setShowPreview] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [publishedVersion, setPublishedVersion] = useState<{
    id: string;
    title: string;
    content: string;
  } | null>(null);
  const { confirm } = useAlertDialog();

  // 페이지 변경 시 로컬 상태 동기화 + 발행 버전 로드
  useEffect(() => {
    setTitle(page.title);
    setContent(page.content);

    // 발행 버전 로드 (발행된 페이지인 경우만)
    if (page.publishedVersionId) {
      getPublishedVersion(page.id).then((result) => {
        if (result.success && result.version) {
          setPublishedVersion(result.version);
        } else {
          setPublishedVersion(null);
        }
      });
    } else {
      setPublishedVersion(null);
    }
  }, [page.id, page.title, page.content, page.publishedVersionId]);

  const hasChanges = title !== page.title || content !== page.content;

  // 현재 Draft가 발행 버전과 다른지 확인
  const isDifferentFromPublished =
    publishedVersion &&
    (title !== publishedVersion.title || content !== publishedVersion.content);

  const handleSave = useCallback(async () => {
    if (!hasChanges) return;

    setIsSaving(true);
    try {
      const result = await updateKnowledgePage(page.id, { title, content });
      if (result.success) {
        toast.success('저장되었습니다.');
        onUpdate();
      } else {
        toast.error(result.error || '저장에 실패했습니다.');
      }
    } catch {
      toast.error('저장 중 오류가 발생했습니다.');
    } finally {
      setIsSaving(false);
    }
  }, [page.id, title, content, hasChanges, onUpdate]);

  const handlePublish = useCallback(async () => {
    // 변경사항이 있으면 먼저 저장
    if (hasChanges) {
      const saveResult = await updateKnowledgePage(page.id, { title, content });
      if (!saveResult.success) {
        toast.error(saveResult.error || '저장에 실패했습니다.');
        return;
      }
    }

    setIsPublishing(true);
    try {
      const result = await publishKnowledgePage(page.id);
      if (result.success) {
        toast.success('발행되었습니다. RAG 검색에서 사용 가능합니다.');
        onUpdate();
      } else {
        toast.error(result.error || '발행에 실패했습니다.');
      }
    } catch {
      toast.error('발행 중 오류가 발생했습니다.');
    } finally {
      setIsPublishing(false);
    }
  }, [page.id, title, content, hasChanges, onUpdate]);

  const handleUnpublish = useCallback(async () => {
    setIsPublishing(true);
    try {
      const result = await unpublishKnowledgePage(page.id);
      if (result.success) {
        toast.success('발행이 취소되었습니다.');
        onUpdate();
      } else {
        toast.error(result.error || '발행 취소에 실패했습니다.');
      }
    } catch {
      toast.error('발행 취소 중 오류가 발생했습니다.');
    } finally {
      setIsPublishing(false);
    }
  }, [page.id, onUpdate]);

  const handleDelete = useCallback(async () => {
    await confirm({
      title: '페이지 삭제',
      message: `"${page.title}" 페이지를 삭제하시겠습니까?\n하위 페이지도 함께 삭제됩니다.`,
      confirmText: '삭제',
      cancelText: '취소',
      variant: 'destructive',
      onConfirm: async () => {
        const result = await deleteKnowledgePage(page.id);
        if (!result.success) {
          throw new Error(result.error || '삭제에 실패했습니다.');
        }
        onDelete();
      },
    });
  }, [page.id, page.title, confirm, onDelete]);

  // 발행 버전으로 되돌리기
  const handleRestoreToPublished = useCallback(async () => {
    if (!publishedVersion) return;

    setIsRestoring(true);
    try {
      // 발행 버전의 내용을 로컬 상태에 적용
      setTitle(publishedVersion.title);
      setContent(publishedVersion.content);
      toast.success('발행 버전으로 되돌렸습니다. 저장하면 변경사항이 적용됩니다.');
    } finally {
      setIsRestoring(false);
    }
  }, [publishedVersion]);

  // 키보드 단축키 (Cmd/Ctrl + S)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSave]);

  return (
    <div className="flex h-full flex-col">
      {/* 헤더 */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="h-8 w-64 font-medium"
            placeholder="페이지 제목"
          />
          {/* 상태 배지: publishedVersionId로 발행 여부 판단 */}
          {page.publishedVersionId ? (
            <Badge variant="default" className="text-xs">
              발행됨
            </Badge>
          ) : (
            <Badge variant="secondary" className="text-xs">
              초안
            </Badge>
          )}
          {hasChanges && (
            <Badge variant="outline" className="text-xs text-yellow-600">
              미저장
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* 미리보기 토글 (모바일 전용) */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowPreview(!showPreview)}
            className="md:hidden"
          >
            {showPreview ? (
              <>
                <PenLine className="mr-1 h-4 w-4" />
                편집
              </>
            ) : (
              <>
                <Eye className="mr-1 h-4 w-4" />
                미리보기
              </>
            )}
          </Button>

          {/* 버전 히스토리 */}
          <VersionHistoryModal
            pageId={page.id}
            onRestore={onUpdate}
            hasPublishedVersion={!!page.publishedVersionId}
          />

          {/* 마크다운 도움말 */}
          <MarkdownHelpModal />

          {/* 저장 버튼 */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleSave}
            disabled={!hasChanges || isSaving}
          >
            <Save className="mr-1 h-4 w-4" />
            {isSaving ? '저장 중...' : '저장'}
          </Button>

          {/* 발행/발행취소 버튼: publishedVersionId로 상태 판단 */}
          {page.publishedVersionId ? (
            <Button
              variant="outline"
              size="sm"
              onClick={handleUnpublish}
              disabled={isPublishing}
            >
              <GlobeLock className="mr-1 h-4 w-4" />
              {isPublishing ? '처리 중...' : '발행 취소'}
            </Button>
          ) : (
            <Button
              variant="default"
              size="sm"
              onClick={handlePublish}
              disabled={isPublishing || (!content.trim() && !hasChanges)}
            >
              <Globe className="mr-1 h-4 w-4" />
              {isPublishing ? '발행 중...' : '발행'}
            </Button>
          )}

          {/* 더보기 메뉴 */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={handleDelete}
                className="text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                삭제
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* 경로 표시 */}
      <div className="border-b border-border bg-muted/30 px-4 py-1.5">
        <span className="text-xs text-muted-foreground">{page.path}</span>
      </div>

      {/* 발행 버전과 다를 때 경고 배너 */}
      {isDifferentFromPublished && (
        <div className="flex items-center justify-between border-b border-yellow-500/30 bg-yellow-500/10 px-4 py-2">
          <div className="flex items-center gap-2 text-sm text-yellow-600 dark:text-yellow-500">
            <AlertTriangle className="h-4 w-4" />
            <span>현재 편집본이 발행 버전과 다릅니다. 챗봇은 발행된 버전을 검색합니다.</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRestoreToPublished}
            disabled={isRestoring}
            className="h-7 border-yellow-500/50 text-yellow-600 hover:bg-yellow-500/20 dark:text-yellow-500"
          >
            <RotateCcw className="mr-1 h-3 w-3" />
            {isRestoring ? '되돌리는 중...' : '발행 버전으로 되돌리기'}
          </Button>
        </div>
      )}

      {/* 에디터/미리보기 영역 */}
      <div className="flex-1 overflow-hidden">
        {/* PC: 2열 레이아웃 (좌: 에디터, 우: 미리보기) */}
        <div className="hidden h-full md:flex">
          {/* 좌측: 마크다운 에디터 */}
          <div className="flex-1 border-r border-border">
            <MarkdownEditor
              value={content}
              onChange={setContent}
              placeholder="마크다운으로 콘텐츠를 작성하세요..."
              height="100%"
              className="h-full rounded-none border-0"
            />
          </div>
          {/* 우측: 실시간 미리보기 */}
          <div className="flex-1 overflow-auto bg-muted/20 p-6">
            <article className="prose prose-neutral max-w-none dark:prose-invert prose-headings:font-semibold prose-h1:text-2xl prose-h1:border-b prose-h1:border-border prose-h1:pb-2 prose-h2:text-xl prose-h3:text-lg prose-p:text-muted-foreground prose-p:leading-relaxed">
              <h1>{title || '제목 없음'}</h1>
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {content || '*내용을 입력하면 여기에 미리보기가 표시됩니다.*'}
              </ReactMarkdown>
            </article>
          </div>
        </div>

        {/* 모바일: 편집/미리보기 토글 방식 */}
        <div className="h-full md:hidden">
          {showPreview ? (
            <div className="h-full overflow-auto p-6">
              <article className="prose prose-neutral max-w-none dark:prose-invert prose-headings:font-semibold prose-h1:text-2xl prose-h1:border-b prose-h1:border-border prose-h1:pb-2 prose-h2:text-xl prose-h3:text-lg prose-p:text-muted-foreground prose-p:leading-relaxed">
                <h1>{title || '제목 없음'}</h1>
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {content || '*내용을 입력하면 여기에 미리보기가 표시됩니다.*'}
                </ReactMarkdown>
              </article>
            </div>
          ) : (
            <MarkdownEditor
              value={content}
              onChange={setContent}
              placeholder="마크다운으로 콘텐츠를 작성하세요..."
              height="100%"
              className="h-full rounded-none border-0"
            />
          )}
        </div>
      </div>
    </div>
  );
}
