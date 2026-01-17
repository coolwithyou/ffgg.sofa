'use client';

import { useState, useMemo } from 'react';
import { FolderTree, FileText, ChevronRight, ChevronDown, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import type { KnowledgePageTreeNode } from '../../actions';
import type { DocumentStructure, PageNode } from '@/lib/knowledge-pages/types';
import { cn } from '@/lib/utils';

interface PageLocationSelectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  structure: DocumentStructure | null;
  existingPages: KnowledgePageTreeNode[];
  onConfirm: (parentPageId: string | null) => Promise<void>;
  isLoading?: boolean;
}

/**
 * 페이지 총 수 계산
 */
function countPages(nodes: PageNode[]): number {
  return nodes.reduce((sum, node) => sum + 1 + countPages(node.children || []), 0);
}

/**
 * 트리를 플랫 리스트로 변환 (depth 정보 포함)
 */
function flattenPages(
  nodes: KnowledgePageTreeNode[],
  depth = 0
): { id: string; title: string; depth: number }[] {
  const result: { id: string; title: string; depth: number }[] = [];
  for (const node of nodes) {
    result.push({ id: node.id, title: node.title, depth });
    result.push(...flattenPages(node.children, depth + 1));
  }
  return result;
}

/**
 * 페이지 생성 위치 선택 다이얼로그
 *
 * 검증 세션 승인 시 새로 생성될 페이지들의 상위 위치를 선택할 수 있습니다.
 * - 왼쪽: 기존 페이지 트리에서 위치 선택 (RadioGroup)
 * - 오른쪽: 생성될 페이지 구조 미리보기
 */
export function PageLocationSelectDialog({
  open,
  onOpenChange,
  structure,
  existingPages,
  onConfirm,
  isLoading = false,
}: PageLocationSelectDialogProps) {
  const [selectedParentId, setSelectedParentId] = useState<string>('root');

  // 플랫 페이지 목록
  const flatPages = useMemo(() => flattenPages(existingPages), [existingPages]);

  // 생성될 페이지 수
  const totalNewPages = useMemo(() => {
    if (!structure?.pages) return 0;
    return countPages(structure.pages);
  }, [structure]);

  // 선택된 위치 이름
  const selectedLocationName = useMemo(() => {
    if (selectedParentId === 'root') return '루트 (최상위)';
    return flatPages.find((p) => p.id === selectedParentId)?.title || '알 수 없음';
  }, [selectedParentId, flatPages]);

  // 확인 핸들러
  const handleConfirm = async () => {
    const parentId = selectedParentId === 'root' ? null : selectedParentId;
    await onConfirm(parentId);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderTree className="h-5 w-5" />
            페이지 생성 위치 선택
          </DialogTitle>
          <DialogDescription>
            승인 시 생성될 페이지들의 상위 위치를 선택합니다.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4 py-4">
          {/* 좌측: 위치 선택 */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">저장 위치</Label>
            <ScrollArea className="h-[300px] rounded-md border border-border p-2">
              <RadioGroup value={selectedParentId} onValueChange={setSelectedParentId}>
                {/* 루트 옵션 */}
                <div
                  className={cn(
                    'flex items-center space-x-2 rounded-md px-2 py-1.5 transition-colors hover:bg-muted/50',
                    selectedParentId === 'root' && 'bg-primary/10'
                  )}
                >
                  <RadioGroupItem value="root" id="root" />
                  <Label htmlFor="root" className="flex-1 cursor-pointer font-medium">
                    루트 (최상위)
                  </Label>
                </div>

                {/* 기존 페이지 목록 */}
                {flatPages.map((page) => (
                  <div
                    key={page.id}
                    className={cn(
                      'flex items-center space-x-2 rounded-md px-2 py-1.5 transition-colors hover:bg-muted/50',
                      selectedParentId === page.id && 'bg-primary/10'
                    )}
                    style={{ paddingLeft: `${(page.depth + 1) * 16}px` }}
                  >
                    <RadioGroupItem value={page.id} id={page.id} />
                    <Label htmlFor={page.id} className="flex-1 cursor-pointer text-sm">
                      {page.depth > 0 && <span className="mr-1 text-muted-foreground">└</span>}
                      {page.title}
                    </Label>
                  </div>
                ))}

                {/* 기존 페이지가 없는 경우 */}
                {flatPages.length === 0 && (
                  <div className="py-4 text-center text-sm text-muted-foreground">
                    기존 페이지가 없습니다
                  </div>
                )}
              </RadioGroup>
            </ScrollArea>

            {/* 선택 정보 */}
            <div className="text-xs text-muted-foreground">
              선택됨: <span className="font-medium text-foreground">{selectedLocationName}</span>
            </div>
          </div>

          {/* 우측: 생성될 페이지 미리보기 */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">생성될 페이지 미리보기</Label>
            <ScrollArea className="h-[300px] rounded-md border border-border bg-muted/30 p-2">
              {structure?.pages && structure.pages.length > 0 ? (
                <PreviewTree nodes={structure.pages} />
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  생성될 페이지가 없습니다
                </div>
              )}
            </ScrollArea>

            {/* 페이지 수 정보 */}
            <div className="text-xs text-muted-foreground">
              총 <span className="font-bold text-primary">{totalNewPages}</span>개의 페이지가
              생성됩니다
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            취소
          </Button>
          <Button onClick={handleConfirm} disabled={isLoading || totalNewPages === 0}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                생성 중...
              </>
            ) : (
              <>생성 ({totalNewPages}개)</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * 미리보기 트리 컴포넌트
 */
function PreviewTree({ nodes }: { nodes: PageNode[] }) {
  return (
    <div className="space-y-1">
      {nodes.map((node, idx) => (
        <PreviewNode key={node.id || idx} node={node} depth={0} />
      ))}
    </div>
  );
}

/**
 * 미리보기 노드 컴포넌트
 */
function PreviewNode({ node, depth }: { node: PageNode; depth: number }) {
  const [isExpanded, setIsExpanded] = useState(depth < 2);
  const hasChildren = node.children && node.children.length > 0;

  return (
    <div>
      <div
        className="flex items-center gap-1 rounded-md px-1 py-0.5 text-sm hover:bg-muted/50"
        style={{ paddingLeft: `${depth * 12}px` }}
      >
        {hasChildren ? (
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-0.5 hover:bg-muted rounded"
          >
            {isExpanded ? (
              <ChevronDown className="h-3 w-3 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-3 w-3 text-muted-foreground" />
            )}
          </button>
        ) : (
          <span className="w-4" />
        )}
        <FileText className="h-3.5 w-3.5 text-primary" />
        <span className="truncate">{node.title}</span>
      </div>
      {isExpanded && hasChildren && (
        <div>
          {node.children!.map((child, idx) => (
            <PreviewNode key={child.id || idx} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}
