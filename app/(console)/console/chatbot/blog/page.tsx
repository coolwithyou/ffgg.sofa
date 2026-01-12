'use client';

/**
 * Knowledge Pages (블로그) 메인 페이지
 *
 * RAG 청킹 단위를 사람이 읽을 수 있는 페이지 형태로 관리
 * 핵심 컨셉: 1 Page = 1 Chunk = 1 읽을 수 있는 문서
 */

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { FileText, RefreshCw, FileCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCurrentChatbot } from '../../hooks/use-console-state';
import { NoChatbotState } from '../../components/no-chatbot-state';
import { PageTree } from './page-tree';
import { PageEditor } from './page-editor';
import { CreatePageDialog } from './create-page-dialog';
import { ImportDocumentDialog } from './import-document-dialog';
import {
  getKnowledgePagesTree,
  getKnowledgePage,
  type KnowledgePageTreeNode,
} from './actions';
import { getValidationSessions } from './validation/actions';
import type { KnowledgePage } from '@/lib/db';
import { toast } from 'sonner';

export default function BlogPage() {
  const { currentChatbot } = useCurrentChatbot();

  // 페이지 트리 상태
  const [pages, setPages] = useState<KnowledgePageTreeNode[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // 선택된 페이지 상태
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
  const [selectedPage, setSelectedPage] = useState<KnowledgePage | null>(null);
  const [isLoadingPage, setIsLoadingPage] = useState(false);

  // 검증 세션 상태 (진행 중/대기 중 개수)
  const [pendingValidationCount, setPendingValidationCount] = useState(0);

  // 페이지 목록 로드
  const loadPages = useCallback(async () => {
    if (!currentChatbot?.id) return;

    setIsLoading(true);
    try {
      const tree = await getKnowledgePagesTree(currentChatbot.id);
      setPages(tree);
    } catch (error) {
      console.error('Failed to load pages:', error);
      toast.error('페이지 목록을 불러오는데 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, [currentChatbot?.id]);

  // 검증 세션 개수 로드
  const loadValidationCount = useCallback(async () => {
    if (!currentChatbot?.id) return;

    try {
      const sessions = await getValidationSessions(currentChatbot.id);
      // 진행 중/대기 중인 세션 개수
      const pendingCount = sessions.filter((s) =>
        ['pending', 'analyzing', 'extracting_claims', 'verifying', 'ready_for_review', 'reviewing'].includes(s.status)
      ).length;
      setPendingValidationCount(pendingCount);
    } catch (error) {
      console.error('Failed to load validation count:', error);
    }
  }, [currentChatbot?.id]);

  // 선택된 페이지 로드
  const loadSelectedPage = useCallback(async (pageId: string) => {
    setIsLoadingPage(true);
    try {
      const page = await getKnowledgePage(pageId);
      setSelectedPage(page);
    } catch (error) {
      console.error('Failed to load page:', error);
      toast.error('페이지를 불러오는데 실패했습니다.');
      setSelectedPage(null);
    } finally {
      setIsLoadingPage(false);
    }
  }, []);

  // 초기 로드
  useEffect(() => {
    loadPages();
    loadValidationCount();
  }, [loadPages, loadValidationCount]);

  // 페이지 선택 시 상세 정보 로드
  useEffect(() => {
    if (selectedPageId) {
      loadSelectedPage(selectedPageId);
    } else {
      setSelectedPage(null);
    }
  }, [selectedPageId, loadSelectedPage]);

  // 페이지 선택 핸들러
  const handleSelectPage = useCallback((pageId: string) => {
    setSelectedPageId(pageId);
  }, []);

  // 페이지 생성 완료 핸들러
  const handlePageCreated = useCallback(
    (pageId: string) => {
      loadPages();
      setSelectedPageId(pageId);
    },
    [loadPages]
  );

  // 페이지 업데이트 핸들러
  const handlePageUpdate = useCallback(() => {
    loadPages();
    if (selectedPageId) {
      loadSelectedPage(selectedPageId);
    }
  }, [loadPages, selectedPageId, loadSelectedPage]);

  // 페이지 삭제 핸들러
  const handlePageDelete = useCallback(() => {
    loadPages();
    setSelectedPageId(null);
    setSelectedPage(null);
  }, [loadPages]);

  // 챗봇 없음 상태
  if (!currentChatbot) {
    return (
      <NoChatbotState
        title="등록된 챗봇이 없습니다"
        description="블로그 기능을 사용하려면 먼저 챗봇을 생성하세요"
      />
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* 헤더 */}
      <div className="flex items-center justify-between border-b border-border px-6 py-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground">블로그</h1>
          <p className="text-sm text-muted-foreground">
            챗봇이 참조할 지식 페이지를 작성하고 관리합니다
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* 검증 세션 목록 버튼 */}
          <Button variant="outline" size="sm" asChild>
            <Link href="/console/chatbot/blog/validation" className="relative">
              <FileCheck className="mr-1 h-4 w-4" />
              문서 검증
              {pendingValidationCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-medium text-primary-foreground">
                  {pendingValidationCount > 9 ? '9+' : pendingValidationCount}
                </span>
              )}
            </Link>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              loadPages();
              loadValidationCount();
            }}
            disabled={isLoading}
          >
            <RefreshCw
              className={`mr-1 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`}
            />
            새로고침
          </Button>
          <ImportDocumentDialog
            chatbotId={currentChatbot.id}
            pages={pages}
            onImportStarted={loadPages}
          />
          <CreatePageDialog
            chatbotId={currentChatbot.id}
            pages={pages}
            onCreated={handlePageCreated}
          />
        </div>
      </div>

      {/* 2컬럼 레이아웃 */}
      <div className="flex flex-1 overflow-hidden">
        {/* 좌측: 트리 뷰 */}
        <div className="w-72 shrink-0 overflow-auto border-r border-border bg-muted/30 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-medium text-muted-foreground">
              페이지 목록
            </h2>
            <span className="text-xs text-muted-foreground">
              {pages.length}개
            </span>
          </div>
          {isLoading ? (
            <div className="flex h-40 items-center justify-center">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <PageTree
              pages={pages}
              selectedPageId={selectedPageId}
              onSelectPage={handleSelectPage}
            />
          )}
        </div>

        {/* 우측: 에디터 또는 빈 상태 */}
        <div className="flex-1 overflow-auto">
          {isLoadingPage ? (
            <div className="flex h-full items-center justify-center">
              <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : selectedPage ? (
            <PageEditor
              page={selectedPage}
              onUpdate={handlePageUpdate}
              onDelete={handlePageDelete}
            />
          ) : (
            <EmptyState
              chatbotId={currentChatbot.id}
              pages={pages}
              onCreated={handlePageCreated}
            />
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * 빈 상태 컴포넌트
 */
interface EmptyStateProps {
  chatbotId: string;
  pages: KnowledgePageTreeNode[];
  onCreated: (pageId: string) => void;
}

function EmptyState({ chatbotId, pages, onCreated }: EmptyStateProps) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-8">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted">
        <FileText className="h-10 w-10 text-muted-foreground" />
      </div>
      <div className="max-w-sm text-center">
        <h3 className="text-lg font-semibold text-foreground">
          {pages.length === 0
            ? '첫 번째 페이지를 만들어보세요'
            : '페이지를 선택하세요'}
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          {pages.length === 0
            ? '블로그 페이지는 챗봇이 참조하는 지식 단위입니다. 한 페이지가 하나의 검색 청크가 됩니다.'
            : '왼쪽 목록에서 편집할 페이지를 선택하거나, 새 페이지를 추가하세요.'}
        </p>
      </div>
      {pages.length === 0 && (
        <CreatePageDialog
          chatbotId={chatbotId}
          pages={pages}
          onCreated={onCreated}
          trigger={
            <Button className="mt-2">
              <FileText className="mr-2 h-4 w-4" />첫 페이지 만들기
            </Button>
          }
        />
      )}
    </div>
  );
}
