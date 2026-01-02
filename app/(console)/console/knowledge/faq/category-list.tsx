'use client';

/**
 * 카테고리 목록 컴포넌트
 * FAQ 카테고리 관리 (추가, 수정, 삭제)
 * Console 마이그레이션
 */

import { useState } from 'react';
import type { Category } from './utils';

interface CategoryListProps {
  categories: Category[];
  selectedCategoryId: string | null;
  onSelect: (id: string | null) => void;
  onAdd: () => void;
  onUpdate: (id: string, name: string) => void;
  onDelete: (id: string) => void;
}

export function CategoryList({
  categories,
  selectedCategoryId,
  onSelect,
  onAdd,
  onUpdate,
  onDelete,
}: CategoryListProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  const handleStartEdit = (category: Category) => {
    setEditingId(category.id);
    setEditValue(category.name);
  };

  const handleFinishEdit = () => {
    if (editingId && editValue.trim()) {
      onUpdate(editingId, editValue.trim());
    }
    setEditingId(null);
    setEditValue('');
  };

  const sortedCategories = [...categories].sort((a, b) => a.order - b.order);

  return (
    <div className="border-b border-border">
      <div className="flex items-center justify-between border-b border-border bg-muted/30 px-4 py-2">
        <h3 className="text-sm font-medium text-foreground">카테고리</h3>
        <button
          onClick={onAdd}
          className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          title="카테고리 추가"
        >
          <PlusIcon />
        </button>
      </div>

      <div className="max-h-40 overflow-y-auto">
        {sortedCategories.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <p className="text-sm text-muted-foreground">카테고리가 없습니다</p>
            <button
              onClick={onAdd}
              className="mt-2 text-sm text-primary hover:underline"
            >
              첫 카테고리 추가
            </button>
          </div>
        ) : (
          <div className="p-2">
            {sortedCategories.map((category) => (
              <div
                key={category.id}
                className={`group flex items-center gap-2 rounded-md px-3 py-2 ${
                  selectedCategoryId === category.id
                    ? 'bg-primary/10 text-primary'
                    : 'text-foreground hover:bg-muted'
                }`}
              >
                {editingId === category.id ? (
                  <input
                    type="text"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onBlur={handleFinishEdit}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleFinishEdit();
                      if (e.key === 'Escape') {
                        setEditingId(null);
                        setEditValue('');
                      }
                    }}
                    className="flex-1 rounded border border-border bg-background px-2 py-1 text-sm outline-none focus:border-primary"
                    autoFocus
                  />
                ) : (
                  <>
                    <button
                      onClick={() => onSelect(category.id)}
                      className="flex-1 text-left text-sm"
                    >
                      {category.name}
                    </button>
                    <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <button
                        onClick={() => handleStartEdit(category)}
                        className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                        title="이름 수정"
                      >
                        <EditIcon />
                      </button>
                      <button
                        onClick={() => onDelete(category.id)}
                        className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        title="삭제"
                      >
                        <TrashIcon />
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// 아이콘 컴포넌트들
function PlusIcon() {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 4v16m8-8H4"
      />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
      />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
      />
    </svg>
  );
}
