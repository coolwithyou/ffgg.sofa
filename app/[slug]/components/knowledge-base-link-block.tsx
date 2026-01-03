'use client';

/**
 * 지식 베이스 링크 블록 컴포넌트
 *
 * 지식 베이스 문서와 연결하는 카드를 표시합니다.
 * - 문서 제목 표시
 * - 미리보기 옵션
 */

import { FileText, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';

interface KnowledgeBaseLinkBlockProps {
  documentId: string;
  title?: string;
  showPreview: boolean;
}

export function KnowledgeBaseLinkBlock({
  documentId,
  title,
  showPreview,
}: KnowledgeBaseLinkBlockProps) {
  // 문서 ID가 없으면 플레이스홀더 표시
  if (!documentId) {
    return (
      <div className="flex min-h-[80px] items-center justify-center rounded-xl border border-dashed border-border bg-card p-4">
        <span className="text-muted-foreground">문서를 연결하세요</span>
      </div>
    );
  }

  // 표시 제목 결정
  const displayTitle = title || '지식 베이스 문서';

  return (
    <button
      className={cn(
        'group flex w-full items-start gap-4 rounded-xl border border-border bg-card p-4',
        'transition-all duration-200 hover:border-primary/50 hover:bg-muted/30'
      )}
      onClick={() => {
        // TODO: 문서 상세 보기 또는 챗봇에 문서 내용 기반 질문
        console.log('Open document:', documentId);
      }}
    >
      {/* 아이콘 */}
      <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10">
        <FileText className="h-6 w-6 text-primary" />
      </div>

      {/* 콘텐츠 */}
      <div className="flex-1 text-left">
        <div className="flex items-center gap-2">
          <h3 className="font-medium text-foreground group-hover:text-primary">
            {displayTitle}
          </h3>
          <ExternalLink className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
        </div>

        {showPreview && (
          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
            이 문서의 내용을 확인하려면 클릭하세요.
          </p>
        )}

        <div className="mt-2 flex items-center gap-2">
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
            지식 베이스
          </span>
        </div>
      </div>
    </button>
  );
}
