'use client';

/**
 * Knowledge Pages 트리 뷰 컴포넌트
 *
 * 계층적 페이지 구조를 트리 형태로 표시하고 선택 기능 제공
 * - 일반 모드: 클릭으로 에디터에서 열기
 * - 선택 모드: 체크박스로 복수 선택 (일괄 삭제용)
 */

import { useState, useCallback } from 'react';
import {
  ChevronRight,
  FileText,
  FolderOpen,
  Circle,
  CheckCircle2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';
import type { KnowledgePageTreeNode } from './actions';

interface PageTreeProps {
  pages: KnowledgePageTreeNode[];
  selectedPageId: string | null;
  onSelectPage: (pageId: string) => void;
  // 선택 모드 관련 props
  selectionMode?: boolean;
  selectedIds?: Set<string>;
  onSelectionChange?: (ids: Set<string>) => void;
}

export function PageTree({
  pages,
  selectedPageId,
  onSelectPage,
  selectionMode = false,
  selectedIds = new Set(),
  onSelectionChange,
}: PageTreeProps) {
  // 체크박스 토글 핸들러
  const handleToggleSelection = useCallback(
    (pageId: string) => {
      if (!onSelectionChange) return;

      const newSelectedIds = new Set(selectedIds);
      if (newSelectedIds.has(pageId)) {
        newSelectedIds.delete(pageId);
      } else {
        newSelectedIds.add(pageId);
      }
      onSelectionChange(newSelectedIds);
    },
    [selectedIds, onSelectionChange]
  );

  if (pages.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
        <div className="text-center">
          <FileText className="mx-auto mb-2 h-8 w-8 opacity-50" />
          <p>페이지가 없습니다.</p>
          <p className="text-xs">새 페이지를 추가해보세요.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {pages.map((page) => (
        <TreeNode
          key={page.id}
          node={page}
          selectedPageId={selectedPageId}
          onSelectPage={onSelectPage}
          selectionMode={selectionMode}
          selectedIds={selectedIds}
          onToggleSelection={handleToggleSelection}
        />
      ))}
    </div>
  );
}

interface TreeNodeProps {
  node: KnowledgePageTreeNode;
  selectedPageId: string | null;
  onSelectPage: (pageId: string) => void;
  depth?: number;
  // 선택 모드 관련 props
  selectionMode: boolean;
  selectedIds: Set<string>;
  onToggleSelection: (pageId: string) => void;
}

function TreeNode({
  node,
  selectedPageId,
  onSelectPage,
  depth = 0,
  selectionMode,
  selectedIds,
  onToggleSelection,
}: TreeNodeProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const hasChildren = node.children.length > 0;
  const isSelected = selectedPageId === node.id;
  const isChecked = selectedIds.has(node.id);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (selectionMode) {
        onToggleSelection(node.id);
      } else {
        onSelectPage(node.id);
      }
    }
  };

  const handleRowClick = () => {
    if (selectionMode) {
      onToggleSelection(node.id);
    } else {
      onSelectPage(node.id);
    }
  };

  const handleCheckboxClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleSelection(node.id);
  };

  return (
    <div>
      {/* div로 변경하여 내부 button 중첩 방지 */}
      <div
        role="button"
        tabIndex={0}
        onClick={handleRowClick}
        onKeyDown={handleKeyDown}
        className={cn(
          'flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors',
          'hover:bg-muted',
          !selectionMode && isSelected && 'bg-primary/10 text-primary',
          selectionMode && isChecked && 'bg-primary/10'
        )}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        {/* 선택 모드: 체크박스 */}
        {selectionMode && (
          <div onClick={handleCheckboxClick}>
            <Checkbox
              checked={isChecked}
              onCheckedChange={() => onToggleSelection(node.id)}
              className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
            />
          </div>
        )}

        {/* 접기/펼치기 버튼 */}
        {hasChildren ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
            className="rounded p-0.5 hover:bg-muted-foreground/20"
            aria-label={isExpanded ? '접기' : '펼치기'}
          >
            <ChevronRight
              className={cn(
                'h-4 w-4 transition-transform',
                isExpanded && 'rotate-90'
              )}
            />
          </button>
        ) : (
          <span className="w-5" />
        )}

        {/* 아이콘 */}
        {hasChildren ? (
          <FolderOpen className="h-4 w-4 text-muted-foreground" />
        ) : (
          <FileText className="h-4 w-4 text-muted-foreground" />
        )}

        {/* 제목 */}
        <span className="flex-1 truncate text-left">{node.title}</span>

        {/* 발행 상태 */}
        {node.isIndexed ? (
          <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
        ) : (
          <Circle className="h-3.5 w-3.5 text-muted-foreground/50" />
        )}
      </div>

      {/* 하위 페이지 */}
      {hasChildren && isExpanded && (
        <div>
          {node.children.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              selectedPageId={selectedPageId}
              onSelectPage={onSelectPage}
              depth={depth + 1}
              selectionMode={selectionMode}
              selectedIds={selectedIds}
              onToggleSelection={onToggleSelection}
            />
          ))}
        </div>
      )}
    </div>
  );
}
