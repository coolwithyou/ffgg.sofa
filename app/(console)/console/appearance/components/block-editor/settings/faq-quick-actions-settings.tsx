'use client';

/**
 * FAQ 빠른 액션 블록 설정 컴포넌트
 *
 * FaqQuickActionsBlock의 설정을 편집합니다:
 * - 질문 목록 관리 (추가/삭제/수정)
 * - 레이아웃 스타일 (버튼/칩/리스트)
 */

import { useState } from 'react';
import { Plus, Trash2, GripVertical } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type {
  FaqQuickActionsBlock,
  FaqQuickActionItem,
  FaqQuickActionsLayout,
} from '@/lib/public-page/block-types';
import type { BlockSettingsProps } from './index';

const LAYOUT_OPTIONS: { value: FaqQuickActionsLayout; label: string }[] = [
  { value: 'buttons', label: '버튼' },
  { value: 'chips', label: '칩' },
  { value: 'list', label: '리스트' },
];

export function FaqQuickActionsBlockSettings({
  block,
  onUpdate,
}: BlockSettingsProps<FaqQuickActionsBlock>) {
  const { config } = block;

  /**
   * config 내 특정 필드 업데이트
   */
  const updateConfig = (updates: Partial<FaqQuickActionsBlock['config']>) => {
    onUpdate({
      config: { ...config, ...updates },
    } as Partial<FaqQuickActionsBlock>);
  };

  /**
   * 질문 추가
   */
  const addQuestion = () => {
    const newQuestion: FaqQuickActionItem = { text: '' };
    updateConfig({
      questions: [...config.questions, newQuestion],
    });
  };

  /**
   * 질문 삭제
   */
  const removeQuestion = (index: number) => {
    updateConfig({
      questions: config.questions.filter((_, i) => i !== index),
    });
  };

  /**
   * 질문 업데이트
   */
  const updateQuestion = (index: number, text: string) => {
    updateConfig({
      questions: config.questions.map((q, i) =>
        i === index ? { ...q, text } : q
      ),
    });
  };

  return (
    <div className="space-y-6">
      {/* 질문 목록 */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>빠른 질문</Label>
          <Button variant="outline" size="sm" onClick={addQuestion}>
            <Plus className="mr-1 h-4 w-4" />
            추가
          </Button>
        </div>

        {config.questions.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            빠른 질문을 추가하세요.
          </p>
        ) : (
          <div className="space-y-2">
            {config.questions.map((question, index) => (
              <div
                key={index}
                className="flex items-center gap-2 rounded-md border border-border bg-muted/30 p-2"
              >
                <GripVertical className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                <Input
                  placeholder={`질문 ${index + 1}`}
                  value={question.text}
                  onChange={(e) => updateQuestion(index, e.target.value)}
                  className="flex-1"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => removeQuestion(index)}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          클릭하면 챗봇에 질문이 자동으로 전송됩니다.
        </p>
      </div>

      {/* 레이아웃 */}
      <div className="space-y-2">
        <Label htmlFor="faq-layout">레이아웃</Label>
        <Select
          value={config.layout}
          onValueChange={(value: FaqQuickActionsLayout) =>
            updateConfig({ layout: value })
          }
        >
          <SelectTrigger id="faq-layout">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LAYOUT_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          질문 버튼의 표시 방식을 선택합니다.
        </p>
      </div>
    </div>
  );
}
