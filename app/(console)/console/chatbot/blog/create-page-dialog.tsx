'use client';

/**
 * 새 페이지 생성 다이얼로그
 */

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { createKnowledgePage, type KnowledgePageTreeNode } from './actions';

interface CreatePageDialogProps {
  chatbotId: string;
  pages: KnowledgePageTreeNode[];
  parentId?: string | null;
  onCreated: (pageId: string) => void;
  trigger?: React.ReactNode;
}

export function CreatePageDialog({
  chatbotId,
  pages,
  parentId = null,
  onCreated,
  trigger,
}: CreatePageDialogProps) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [selectedParentId, setSelectedParentId] = useState<string | null>(parentId);
  const [isCreating, setIsCreating] = useState(false);

  const handleCreate = async () => {
    if (!title.trim()) {
      toast.error('제목을 입력해주세요.');
      return;
    }

    setIsCreating(true);
    try {
      const result = await createKnowledgePage({
        chatbotId,
        parentId: selectedParentId,
        title: title.trim(),
      });

      if (result.success && result.page) {
        toast.success('페이지가 생성되었습니다.');
        setOpen(false);
        setTitle('');
        setSelectedParentId(null);
        onCreated(result.page.id);
      } else {
        toast.error(result.error || '생성에 실패했습니다.');
      }
    } catch {
      toast.error('생성 중 오류가 발생했습니다.');
    } finally {
      setIsCreating(false);
    }
  };

  const flattenPages = (
    nodes: KnowledgePageTreeNode[],
    depth = 0
  ): { id: string; title: string; depth: number }[] => {
    const result: { id: string; title: string; depth: number }[] = [];
    for (const node of nodes) {
      result.push({ id: node.id, title: node.title, depth });
      result.push(...flattenPages(node.children, depth + 1));
    }
    return result;
  };

  const flatPages = flattenPages(pages);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <Plus className="mr-1 h-4 w-4" />
            새 페이지
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>새 페이지 만들기</DialogTitle>
          <DialogDescription>
            Knowledge Base에 새로운 페이지를 추가합니다.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="title">제목</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="페이지 제목"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !isCreating) {
                  handleCreate();
                }
              }}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="parent">상위 페이지 (선택)</Label>
            <select
              id="parent"
              value={selectedParentId ?? ''}
              onChange={(e) => setSelectedParentId(e.target.value || null)}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="">루트 (최상위)</option>
              {flatPages.map((page) => (
                <option key={page.id} value={page.id}>
                  {'  '.repeat(page.depth)}
                  {page.depth > 0 ? '└ ' : ''}
                  {page.title}
                </option>
              ))}
            </select>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isCreating}
          >
            취소
          </Button>
          <Button onClick={handleCreate} disabled={isCreating || !title.trim()}>
            {isCreating ? '생성 중...' : '생성'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
