'use client';

/**
 * 예약 슬러그 추가 다이얼로그
 * 단일 추가 및 일괄 추가 기능 제공
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SimpleDialog } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Plus, Loader2 } from 'lucide-react';
import { addReservedSlug, addReservedSlugsBulk } from './actions';
import { CATEGORIES, CATEGORY_LABELS, type Category } from './constants';

export function AddSlugDialog() {
  const [isOpen, setIsOpen] = useState(false);
  const [tab, setTab] = useState<'single' | 'bulk'>('single');
  const [isLoading, setIsLoading] = useState(false);

  // 단일 추가 상태
  const [slug, setSlug] = useState('');
  const [category, setCategory] = useState<Category>('other');
  const [reason, setReason] = useState('');

  // 일괄 추가 상태
  const [bulkSlugs, setBulkSlugs] = useState('');

  const resetForm = () => {
    setSlug('');
    setCategory('other');
    setReason('');
    setBulkSlugs('');
  };

  const handleClose = () => {
    setIsOpen(false);
    resetForm();
  };

  // 단일 추가
  const handleSingleAdd = async () => {
    if (!slug.trim()) {
      toast.error('슬러그를 입력해주세요');
      return;
    }

    setIsLoading(true);
    try {
      const result = await addReservedSlug({
        slug: slug.trim(),
        category,
        reason: reason.trim() || undefined,
      });

      if (!result.success) {
        toast.error(result.error || '추가 중 오류가 발생했습니다');
        return;
      }

      toast.success('예약 슬러그가 추가되었습니다');
      handleClose();
    } catch (error) {
      toast.error('추가 중 오류가 발생했습니다');
    } finally {
      setIsLoading(false);
    }
  };

  // 일괄 추가
  const handleBulkAdd = async () => {
    if (!bulkSlugs.trim()) {
      toast.error('슬러그를 입력해주세요');
      return;
    }

    setIsLoading(true);
    try {
      const result = await addReservedSlugsBulk({
        slugs: bulkSlugs.trim(),
        category,
        reason: reason.trim() || undefined,
      });

      if (result.added > 0) {
        toast.success(
          `${result.added}개의 슬러그가 추가되었습니다` +
            (result.skipped > 0 ? ` (${result.skipped}개 건너뜀)` : '')
        );
        handleClose();
      } else {
        toast.error('추가된 슬러그가 없습니다');
        if (result.errors.length > 0) {
          console.log('Bulk add errors:', result.errors);
        }
      }
    } catch (error) {
      toast.error('추가 중 오류가 발생했습니다');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Button onClick={() => setIsOpen(true)}>
        <Plus className="mr-2 h-4 w-4" />
        슬러그 추가
      </Button>

      <SimpleDialog
        isOpen={isOpen}
        onClose={handleClose}
        title="예약 슬러그 추가"
        description="사용자가 등록할 수 없는 슬러그를 추가합니다."
        maxWidth="lg"
      >
        <Tabs value={tab} onValueChange={(v) => setTab(v as 'single' | 'bulk')}>
          <TabsList className="mb-4 w-full">
            <TabsTrigger value="single" className="flex-1">
              단일 추가
            </TabsTrigger>
            <TabsTrigger value="bulk" className="flex-1">
              일괄 추가
            </TabsTrigger>
          </TabsList>

          <TabsContent value="single" className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">
                슬러그 <span className="text-destructive">*</span>
              </label>
              <Input
                value={slug}
                onChange={(e) => setSlug(e.target.value.toLowerCase())}
                placeholder="예: badword, brandname"
                maxLength={50}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                영문 소문자, 숫자, 하이픈만 사용 가능합니다.
              </p>
            </div>
          </TabsContent>

          <TabsContent value="bulk" className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">
                슬러그 목록 <span className="text-destructive">*</span>
              </label>
              <Textarea
                value={bulkSlugs}
                onChange={(e) => setBulkSlugs(e.target.value.toLowerCase())}
                placeholder="줄바꿈 또는 쉼표로 구분하여 입력하세요&#10;예:&#10;badword1&#10;badword2&#10;badword3"
                rows={6}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                한 번에 최대 100개까지 추가할 수 있습니다.
              </p>
            </div>
          </TabsContent>

          {/* 공통 필드 */}
          <div className="mt-4 space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">
                카테고리 <span className="text-destructive">*</span>
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
              <p className="mt-1 text-xs text-muted-foreground">
                카테고리에 따라 사용자에게 표시되는 오류 메시지가 달라집니다.
              </p>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-foreground">
                사유 (선택)
              </label>
              <Input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="예약 사유를 입력하세요 (관리자 메모)"
                maxLength={200}
              />
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-2">
            <Button variant="outline" onClick={handleClose} disabled={isLoading}>
              취소
            </Button>
            <Button
              onClick={tab === 'single' ? handleSingleAdd : handleBulkAdd}
              disabled={isLoading}
            >
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              추가
            </Button>
          </div>
        </Tabs>
      </SimpleDialog>
    </>
  );
}
