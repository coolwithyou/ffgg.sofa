'use client';

/**
 * 예약 슬러그 테이블 컴포넌트
 */

import { useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAlertDialog } from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import {
  Search,
  Trash2,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  Pencil,
} from 'lucide-react';
import {
  deleteReservedSlug,
  deleteReservedSlugsBulk,
  updateReservedSlug,
} from './actions';
import {
  type ReservedSlugItem,
  CATEGORIES,
  CATEGORY_LABELS,
  CATEGORY_STYLES,
  type Category,
} from './constants';
import { SimpleDialog } from '@/components/ui/dialog';

interface Props {
  slugs: ReservedSlugItem[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  currentSearch: string;
  currentCategory?: Category;
}

export function ReservedSlugsTable({
  slugs,
  pagination,
  currentSearch,
  currentCategory,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { confirm } = useAlertDialog();

  const [search, setSearch] = useState(currentSearch);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [editingSlug, setEditingSlug] = useState<ReservedSlugItem | null>(null);

  // 검색 핸들러
  const handleSearch = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    if (search) {
      params.set('search', search);
    } else {
      params.delete('search');
    }
    params.set('page', '1');
    router.push(`/admin/reserved-slugs?${params.toString()}`);
  }, [search, searchParams, router]);

  // 카테고리 필터 핸들러
  const handleCategoryFilter = useCallback(
    (value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value && value !== 'all') {
        params.set('category', value);
      } else {
        params.delete('category');
      }
      params.set('page', '1');
      router.push(`/admin/reserved-slugs?${params.toString()}`);
    },
    [searchParams, router]
  );

  // 페이지 변경 핸들러
  const handlePageChange = useCallback(
    (newPage: number) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set('page', String(newPage));
      router.push(`/admin/reserved-slugs?${params.toString()}`);
    },
    [searchParams, router]
  );

  // 삭제 핸들러
  const handleDelete = async (slug: ReservedSlugItem) => {
    await confirm({
      title: '예약 슬러그 삭제',
      message: `"${slug.slug}" 슬러그를 삭제하시겠습니까? 삭제 후에는 사용자가 이 슬러그를 등록할 수 있게 됩니다.`,
      confirmText: '삭제',
      cancelText: '취소',
      variant: 'destructive',
      onConfirm: async () => {
        const result = await deleteReservedSlug(slug.id);
        if (!result.success) {
          throw new Error(result.error || '삭제 중 오류가 발생했습니다');
        }
        toast.success('슬러그가 삭제되었습니다');
      },
    });
  };

  // 일괄 삭제 핸들러
  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;

    await confirm({
      title: '선택 항목 삭제',
      message: `선택한 ${selectedIds.length}개의 슬러그를 삭제하시겠습니까?`,
      confirmText: '삭제',
      cancelText: '취소',
      variant: 'destructive',
      onConfirm: async () => {
        const result = await deleteReservedSlugsBulk(selectedIds);
        if (!result.success) {
          throw new Error(result.error || '삭제 중 오류가 발생했습니다');
        }
        setSelectedIds([]);
        toast.success(`${result.deleted}개의 슬러그가 삭제되었습니다`);
      },
    });
  };

  // 전체 선택 토글
  const toggleSelectAll = () => {
    if (selectedIds.length === slugs.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(slugs.map((s) => s.id));
    }
  };

  // 개별 선택 토글
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  return (
    <div className="space-y-4">
      {/* 필터 영역 */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <Input
            placeholder="슬러그 검색..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="w-64"
          />
          <Button variant="outline" size="icon" onClick={handleSearch}>
            <Search className="h-4 w-4" />
          </Button>
        </div>

        <Select
          value={currentCategory || 'all'}
          onValueChange={handleCategoryFilter}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="카테고리" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체</SelectItem>
            {CATEGORIES.map((cat) => (
              <SelectItem key={cat} value={cat}>
                {CATEGORY_LABELS[cat]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {selectedIds.length > 0 && (
          <Button
            variant="destructive"
            size="sm"
            onClick={handleBulkDelete}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            선택 삭제 ({selectedIds.length})
          </Button>
        )}
      </div>

      {/* 테이블 */}
      <div className="rounded-lg border border-border bg-card">
        <table className="min-w-full divide-y divide-border">
          <thead className="bg-muted">
            <tr>
              <th className="w-12 px-4 py-3">
                <input
                  type="checkbox"
                  checked={selectedIds.length === slugs.length && slugs.length > 0}
                  onChange={toggleSelectAll}
                  className="rounded border-border"
                />
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                슬러그
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                카테고리
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                사유
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                등록자
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                등록일
              </th>
              <th className="w-20 px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {slugs.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                  등록된 예약 슬러그가 없습니다
                </td>
              </tr>
            ) : (
              slugs.map((slug) => (
                <tr key={slug.id} className="hover:bg-muted/50">
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(slug.id)}
                      onChange={() => toggleSelect(slug.id)}
                      className="rounded border-border"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <code className="rounded bg-muted px-2 py-1 text-sm font-mono text-foreground">
                      {slug.slug}
                    </code>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                        CATEGORY_STYLES[slug.category as Category]
                      }`}
                    >
                      {CATEGORY_LABELS[slug.category as Category]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {slug.reason || '-'}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {slug.createdByName || slug.createdByEmail || '-'}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {slug.createdAt
                      ? new Date(slug.createdAt).toLocaleDateString('ko-KR')
                      : '-'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setEditingSlug(slug)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(slug)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* 페이지네이션 */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            총 {pagination.total}개 중 {(pagination.page - 1) * pagination.pageSize + 1}
            -{Math.min(pagination.page * pagination.pageSize, pagination.total)}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              disabled={pagination.page <= 1}
              onClick={() => handlePageChange(pagination.page - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm">
              {pagination.page} / {pagination.totalPages}
            </span>
            <Button
              variant="outline"
              size="icon"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => handlePageChange(pagination.page + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* 수정 다이얼로그 */}
      {editingSlug && (
        <EditSlugDialog
          slug={editingSlug}
          onClose={() => setEditingSlug(null)}
        />
      )}
    </div>
  );
}

// 수정 다이얼로그
function EditSlugDialog({
  slug,
  onClose,
}: {
  slug: ReservedSlugItem;
  onClose: () => void;
}) {
  const [category, setCategory] = useState(slug.category as Category);
  const [reason, setReason] = useState(slug.reason || '');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async () => {
    setIsLoading(true);
    try {
      const result = await updateReservedSlug(slug.id, {
        category,
        reason: reason || null,
      });
      if (!result.success) {
        toast.error(result.error || '수정 중 오류가 발생했습니다');
        return;
      }
      toast.success('슬러그가 수정되었습니다');
      onClose();
    } catch (error) {
      toast.error('수정 중 오류가 발생했습니다');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SimpleDialog
      isOpen={true}
      onClose={onClose}
      title="예약 슬러그 수정"
      description={`"${slug.slug}" 슬러그의 정보를 수정합니다.`}
      maxWidth="md"
    >
      <div className="space-y-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">
            슬러그
          </label>
          <code className="block rounded bg-muted px-3 py-2 text-sm font-mono text-foreground">
            {slug.slug}
          </code>
          <p className="mt-1 text-xs text-muted-foreground">
            슬러그 값은 수정할 수 없습니다.
          </p>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">
            카테고리
          </label>
          <Select value={category} onValueChange={(v) => setCategory(v as Category)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {CATEGORY_LABELS[cat]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">
            사유 (선택)
          </label>
          <Input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="예약 사유를 입력하세요"
            maxLength={200}
          />
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            취소
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading}>
            {isLoading ? '저장 중...' : '저장'}
          </Button>
        </div>
      </div>
    </SimpleDialog>
  );
}
