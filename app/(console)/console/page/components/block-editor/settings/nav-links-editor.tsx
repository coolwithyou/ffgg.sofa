'use client';

/**
 * 네비게이션 링크 편집기
 *
 * 헤더의 네비게이션 링크들을 추가/편집/삭제합니다.
 */

import { Plus, Trash2, GripVertical } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import type { NavLink } from '@/lib/public-page/header-templates';

interface NavLinksEditorProps {
  /** 현재 링크 목록 */
  links: NavLink[];
  /** 변경 핸들러 */
  onChange: (links: NavLink[]) => void;
  /** 최대 링크 수 */
  maxLinks?: number;
}

export function NavLinksEditor({
  links,
  onChange,
  maxLinks = 5,
}: NavLinksEditorProps) {
  const addLink = () => {
    if (links.length >= maxLinks) return;
    onChange([...links, { label: '', href: '' }]);
  };

  const updateLink = (index: number, updates: Partial<NavLink>) => {
    const newLinks = [...links];
    newLinks[index] = { ...newLinks[index], ...updates };
    onChange(newLinks);
  };

  const removeLink = (index: number) => {
    onChange(links.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label>네비게이션 링크</Label>
        <span className="text-xs text-muted-foreground">
          {links.length}/{maxLinks}
        </span>
      </div>

      {/* 링크 목록 */}
      <div className="space-y-2">
        {links.map((link, index) => (
          <div
            key={index}
            className="flex items-start gap-2 rounded-lg border border-border bg-muted/30 p-2"
          >
            {/* 드래그 핸들 (향후 DnD 구현 시 사용) */}
            <div className="mt-2 cursor-grab text-muted-foreground">
              <GripVertical className="h-4 w-4" />
            </div>

            {/* 입력 필드 */}
            <div className="flex-1 space-y-2">
              <Input
                placeholder="라벨 (예: 소개)"
                value={link.label}
                onChange={(e) => updateLink(index, { label: e.target.value })}
                className="h-8 text-sm"
              />
              <Input
                placeholder="링크 (예: #about 또는 https://...)"
                value={link.href}
                onChange={(e) => updateLink(index, { href: e.target.value })}
                className="h-8 text-sm"
              />
            </div>

            {/* 삭제 버튼 */}
            <button
              type="button"
              onClick={() => removeLink(index)}
              className="mt-2 rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              aria-label="링크 삭제"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>

      {/* 추가 버튼 */}
      {links.length < maxLinks && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full"
          onClick={addLink}
        >
          <Plus className="mr-2 h-4 w-4" />
          링크 추가
        </Button>
      )}

      {links.length === 0 && (
        <p className="text-center text-xs text-muted-foreground">
          네비게이션 링크가 없습니다
        </p>
      )}
    </div>
  );
}
