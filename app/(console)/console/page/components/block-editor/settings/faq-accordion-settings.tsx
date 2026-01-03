'use client';

/**
 * FAQ 아코디언 블록 설정 컴포넌트
 *
 * FaqAccordionBlock의 설정을 편집합니다:
 * - FAQ 항목 관리 (추가/삭제/수정)
 * - 동시 열기 허용 옵션
 * - 기본 열림 항목 설정
 */

import { useState } from 'react';
import { Plus, Trash2, GripVertical } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { FaqAccordionBlock, FaqItem } from '@/lib/public-page/block-types';
import type { BlockSettingsProps } from './index';

export function FaqAccordionBlockSettings({
  block,
  onUpdate,
}: BlockSettingsProps<FaqAccordionBlock>) {
  const { config } = block;
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  /**
   * config 내 특정 필드 업데이트
   */
  const updateConfig = (updates: Partial<FaqAccordionBlock['config']>) => {
    onUpdate({
      config: { ...config, ...updates },
    } as Partial<FaqAccordionBlock>);
  };

  /**
   * FAQ 항목 추가
   */
  const addItem = () => {
    const newItem: FaqItem = {
      question: '',
      answer: '',
    };
    updateConfig({
      items: [...config.items, newItem],
    });
    setExpandedIndex(config.items.length);
  };

  /**
   * FAQ 항목 삭제
   */
  const removeItem = (index: number) => {
    updateConfig({
      items: config.items.filter((_, i) => i !== index),
    });
    if (expandedIndex === index) {
      setExpandedIndex(null);
    }
    // 기본 열림 항목 인덱스 조정
    if (config.defaultOpen !== undefined) {
      if (config.defaultOpen === index) {
        updateConfig({ defaultOpen: undefined });
      } else if (config.defaultOpen > index) {
        updateConfig({ defaultOpen: config.defaultOpen - 1 });
      }
    }
  };

  /**
   * FAQ 항목 업데이트
   */
  const updateItem = (index: number, updates: Partial<FaqItem>) => {
    updateConfig({
      items: config.items.map((item, i) =>
        i === index ? { ...item, ...updates } : item
      ),
    });
  };

  return (
    <div className="space-y-6">
      {/* FAQ 항목 목록 */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>FAQ 항목</Label>
          <Button variant="outline" size="sm" onClick={addItem}>
            <Plus className="mr-1 h-4 w-4" />
            추가
          </Button>
        </div>

        {config.items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            FAQ 항목을 추가하세요.
          </p>
        ) : (
          <div className="space-y-2">
            {config.items.map((item, index) => (
              <div
                key={index}
                className="rounded-lg border border-border bg-card"
              >
                <div
                  className="flex cursor-pointer items-center gap-2 p-3"
                  onClick={() =>
                    setExpandedIndex(expandedIndex === index ? null : index)
                  }
                >
                  <GripVertical className="h-4 w-4 text-muted-foreground" />
                  <span className="flex-1 truncate text-sm">
                    {item.question || `질문 ${index + 1}`}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeItem(index);
                    }}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>

                {expandedIndex === index && (
                  <div className="space-y-3 border-t border-border p-3">
                    <div className="space-y-2">
                      <Label htmlFor={`faq-question-${index}`}>질문</Label>
                      <Input
                        id={`faq-question-${index}`}
                        placeholder="자주 묻는 질문"
                        value={item.question}
                        onChange={(e) =>
                          updateItem(index, { question: e.target.value })
                        }
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor={`faq-answer-${index}`}>답변</Label>
                      <Textarea
                        id={`faq-answer-${index}`}
                        placeholder="답변 내용"
                        value={item.answer}
                        onChange={(e) =>
                          updateItem(index, { answer: e.target.value })
                        }
                        rows={4}
                      />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 동시 열기 허용 */}
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label htmlFor="faq-multiple" className="cursor-pointer">
            여러 항목 동시 열기
          </Label>
          <p className="text-xs text-muted-foreground">
            여러 FAQ 항목을 동시에 펼칠 수 있습니다.
          </p>
        </div>
        <Switch
          id="faq-multiple"
          checked={config.allowMultiple}
          onCheckedChange={(checked) => updateConfig({ allowMultiple: checked })}
        />
      </div>

      {/* 기본 열림 항목 */}
      <div className="space-y-2">
        <Label htmlFor="faq-default-open">기본 열림 항목</Label>
        <Select
          value={config.defaultOpen?.toString() ?? 'none'}
          onValueChange={(value) =>
            updateConfig({
              defaultOpen: value === 'none' ? undefined : parseInt(value),
            })
          }
        >
          <SelectTrigger id="faq-default-open">
            <SelectValue placeholder="선택 없음" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">선택 없음</SelectItem>
            {config.items.map((item, index) => (
              <SelectItem key={index} value={index.toString()}>
                {item.question || `질문 ${index + 1}`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          페이지 로드 시 기본으로 펼쳐질 항목입니다.
        </p>
      </div>
    </div>
  );
}
