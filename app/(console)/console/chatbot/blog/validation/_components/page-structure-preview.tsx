'use client';

/**
 * 페이지 구조 미리보기 컴포넌트
 *
 * 검증 세션의 structureJson을 트리 형태로 시각화하고,
 * 승인 시 생성될 블로그 페이지 구조를 미리 보여줍니다.
 */

import { useState, useMemo } from 'react';
import {
  ChevronRight,
  ChevronDown,
  FileText,
  FolderOpen,
  Folder,
  Eye,
  Layers,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import type { DocumentStructure, PageNode } from '@/lib/knowledge-pages/types';
import { cn } from '@/lib/utils';

interface PageStructurePreviewProps {
  /** 문서 구조 JSON */
  structure: DocumentStructure | null;
  /** 재구성된 마크다운 */
  markdown: string;
  /** 노드 클릭 시 해당 라인 범위 전달 (하이라이트용) */
  onNodeSelect?: (startLine: number, endLine: number) => void;
}

interface PreviewNode extends PageNode {
  /** 미리보기용 콘텐츠 (첫 200자) */
  preview: string;
  /** 예상 콘텐츠 길이 (글자 수) */
  contentLength: number;
  /** 하위 노드 */
  children: PreviewNode[];
}

/**
 * PageNode를 PreviewNode로 변환
 * 마크다운에서 각 노드의 콘텐츠를 추출하여 미리보기 생성
 */
function convertToPreviewNodes(
  nodes: PageNode[],
  lines: string[]
): PreviewNode[] {
  return nodes.map((node) => {
    let content = '';

    if (node.startLine !== undefined && node.endLine !== undefined) {
      const startIdx = Math.max(0, node.startLine - 1);
      const endIdx = Math.min(lines.length, node.endLine);
      const sectionLines = lines.slice(startIdx, endIdx);

      // 섹션 제목 제외
      const contentLines = sectionLines.filter((line) => {
        const trimmed = line.trim();
        if (trimmed.startsWith('#') && trimmed.includes(node.title)) {
          return false;
        }
        return true;
      });

      content = contentLines.join('\n').trim();
    } else {
      content = node.contentSummary || '';
    }

    return {
      ...node,
      preview: content.slice(0, 200) + (content.length > 200 ? '...' : ''),
      contentLength: content.length,
      children: convertToPreviewNodes(node.children || [], lines),
    };
  });
}

/**
 * 전체 페이지 수 계산
 */
function countTotalPages(nodes: PreviewNode[]): number {
  return nodes.reduce((sum, node) => sum + 1 + countTotalPages(node.children), 0);
}

/**
 * 트리 노드 컴포넌트
 */
interface TreeNodeProps {
  node: PreviewNode;
  depth: number;
  onSelect?: (startLine: number, endLine: number) => void;
}

function TreeNode({ node, depth, onSelect }: TreeNodeProps) {
  const [isExpanded, setIsExpanded] = useState(depth < 2); // 2단계까지 기본 펼침
  const hasChildren = node.children.length > 0;

  const handleClick = () => {
    if (node.startLine !== undefined && node.endLine !== undefined) {
      onSelect?.(node.startLine, node.endLine);
    }
  };

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsExpanded(!isExpanded);
  };

  // 레벨에 따른 아이콘 색상
  const levelColors: Record<number, string> = {
    1: 'text-primary',
    2: 'text-blue-500',
    3: 'text-green-500',
    4: 'text-yellow-500',
    5: 'text-purple-500',
    6: 'text-pink-500',
  };

  const iconColor = levelColors[node.level || depth + 1] || 'text-muted-foreground';

  return (
    <div className="select-none">
      <div
        className={cn(
          'group flex items-start gap-2 rounded-md px-2 py-1.5 transition-colors',
          'hover:bg-muted/50 cursor-pointer',
          node.startLine !== undefined && 'hover:ring-1 hover:ring-primary/30'
        )}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={handleClick}
      >
        {/* 펼침/접기 버튼 */}
        <button
          onClick={handleToggle}
          className={cn(
            'shrink-0 p-0.5 rounded hover:bg-muted',
            !hasChildren && 'invisible'
          )}
        >
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
        </button>

        {/* 아이콘 */}
        {hasChildren ? (
          isExpanded ? (
            <FolderOpen className={cn('h-4 w-4 shrink-0 mt-0.5', iconColor)} />
          ) : (
            <Folder className={cn('h-4 w-4 shrink-0 mt-0.5', iconColor)} />
          )
        ) : (
          <FileText className={cn('h-4 w-4 shrink-0 mt-0.5', iconColor)} />
        )}

        {/* 제목 및 정보 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm text-foreground truncate">
              {node.title}
            </span>
            {node.level && (
              <Badge variant="outline" className="text-[10px] px-1 py-0">
                H{node.level}
              </Badge>
            )}
          </div>

          {/* 라인 범위 및 콘텐츠 길이 */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
            {node.startLine !== undefined && node.endLine !== undefined && (
              <span>
                L{node.startLine}-{node.endLine}
              </span>
            )}
            <span>·</span>
            <span>{node.contentLength.toLocaleString()}자</span>
            {hasChildren && (
              <>
                <span>·</span>
                <span>{node.children.length}개 하위</span>
              </>
            )}
          </div>

          {/* 미리보기 (펼쳐진 상태에서만) */}
          {isExpanded && node.preview && (
            <p className="mt-1 text-xs text-muted-foreground line-clamp-2 italic">
              {node.preview}
            </p>
          )}
        </div>

        {/* 클릭 힌트 */}
        {node.startLine !== undefined && (
          <Eye className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-0.5" />
        )}
      </div>

      {/* 하위 노드 */}
      {isExpanded && hasChildren && (
        <div>
          {node.children.map((child, idx) => (
            <TreeNode
              key={child.id || idx}
              node={child}
              depth={depth + 1}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * 페이지 구조 미리보기 메인 컴포넌트
 */
export function PageStructurePreview({
  structure,
  markdown,
  onNodeSelect,
}: PageStructurePreviewProps) {
  const [isOpen, setIsOpen] = useState(false);

  // 마크다운을 라인 배열로 분할
  const lines = useMemo(() => markdown.split('\n'), [markdown]);

  // PreviewNode로 변환
  const previewNodes = useMemo(() => {
    if (!structure?.pages) return [];
    return convertToPreviewNodes(structure.pages, lines);
  }, [structure, lines]);

  // 전체 페이지 수
  const totalPages = useMemo(() => countTotalPages(previewNodes), [previewNodes]);

  // 구조가 없으면 비활성화
  if (!structure?.pages || structure.pages.length === 0) {
    return (
      <Button variant="outline" size="sm" disabled>
        <Layers className="mr-1 h-4 w-4" />
        구조 없음
      </Button>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Layers className="mr-1 h-4 w-4" />
          페이지 구조
          <Badge variant="secondary" className="ml-1 text-xs">
            {totalPages}
          </Badge>
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Layers className="h-5 w-5" />
            승인 시 생성될 페이지 구조
          </DialogTitle>
          <DialogDescription>
            승인하면 아래 구조대로 블로그 페이지가 생성됩니다.
            각 항목을 클릭하면 해당 내용이 마크다운에서 하이라이트됩니다.
          </DialogDescription>
        </DialogHeader>

        {/* 요약 정보 */}
        <div className="flex items-center gap-4 rounded-md bg-muted/50 px-4 py-3">
          <div className="text-center">
            <div className="text-2xl font-bold text-primary">{totalPages}</div>
            <div className="text-xs text-muted-foreground">총 페이지</div>
          </div>
          <div className="h-10 w-px bg-border" />
          <div className="text-center">
            <div className="text-2xl font-bold text-foreground">
              {previewNodes.length}
            </div>
            <div className="text-xs text-muted-foreground">최상위</div>
          </div>
          <div className="h-10 w-px bg-border" />
          <div className="flex-1">
            <div className="text-sm font-medium text-foreground truncate">
              {structure.title || '문서'}
            </div>
            <div className="text-xs text-muted-foreground">문서 제목</div>
          </div>
        </div>

        {/* 트리 뷰 */}
        <ScrollArea className="h-[400px] rounded-md border">
          <div className="p-2">
            {previewNodes.map((node, idx) => (
              <TreeNode
                key={node.id || idx}
                node={node}
                depth={0}
                onSelect={(startLine, endLine) => {
                  onNodeSelect?.(startLine, endLine);
                  setIsOpen(false); // 선택 시 다이얼로그 닫기
                }}
              />
            ))}
          </div>
        </ScrollArea>

        {/* 범례 */}
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span className="font-medium">레벨:</span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-primary" />
            H1
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-blue-500" />
            H2
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-green-500" />
            H3
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-yellow-500" />
            H4+
          </span>
        </div>

      </DialogContent>
    </Dialog>
  );
}
