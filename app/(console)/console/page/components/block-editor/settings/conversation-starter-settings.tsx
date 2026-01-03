'use client';

/**
 * 대화 시작 프롬프트 블록 설정 컴포넌트
 *
 * ConversationStarterBlock의 설정을 편집합니다:
 * - 프롬프트 목록 관리 (추가/삭제/수정)
 * - 스타일 (카드/버블/미니멀)
 * - 랜덤 순서 옵션
 */

import { Plus, Trash2, GripVertical } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type {
  ConversationStarterBlock,
  ConversationStarterStyle,
} from '@/lib/public-page/block-types';
import type { BlockSettingsProps } from './index';

const STYLE_OPTIONS: { value: ConversationStarterStyle; label: string }[] = [
  { value: 'card', label: '카드' },
  { value: 'bubble', label: '버블' },
  { value: 'minimal', label: '미니멀' },
];

export function ConversationStarterBlockSettings({
  block,
  onUpdate,
}: BlockSettingsProps<ConversationStarterBlock>) {
  const { config } = block;

  /**
   * config 내 특정 필드 업데이트
   */
  const updateConfig = (updates: Partial<ConversationStarterBlock['config']>) => {
    onUpdate({
      config: { ...config, ...updates },
    } as Partial<ConversationStarterBlock>);
  };

  /**
   * 프롬프트 추가
   */
  const addPrompt = () => {
    updateConfig({
      prompts: [...config.prompts, ''],
    });
  };

  /**
   * 프롬프트 삭제
   */
  const removePrompt = (index: number) => {
    updateConfig({
      prompts: config.prompts.filter((_, i) => i !== index),
    });
  };

  /**
   * 프롬프트 업데이트
   */
  const updatePrompt = (index: number, value: string) => {
    updateConfig({
      prompts: config.prompts.map((p, i) => (i === index ? value : p)),
    });
  };

  return (
    <div className="space-y-6">
      {/* 프롬프트 목록 */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>시작 프롬프트</Label>
          <Button variant="outline" size="sm" onClick={addPrompt}>
            <Plus className="mr-1 h-4 w-4" />
            추가
          </Button>
        </div>

        {config.prompts.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            대화 시작 프롬프트를 추가하세요.
          </p>
        ) : (
          <div className="space-y-2">
            {config.prompts.map((prompt, index) => (
              <div
                key={index}
                className="flex items-center gap-2 rounded-md border border-border bg-muted/30 p-2"
              >
                <GripVertical className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                <Input
                  placeholder={`프롬프트 ${index + 1}`}
                  value={prompt}
                  onChange={(e) => updatePrompt(index, e.target.value)}
                  className="flex-1"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => removePrompt(index)}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          사용자가 클릭하면 해당 프롬프트로 대화를 시작합니다.
        </p>
      </div>

      {/* 스타일 */}
      <div className="space-y-2">
        <Label htmlFor="starter-style">스타일</Label>
        <Select
          value={config.style}
          onValueChange={(value: ConversationStarterStyle) =>
            updateConfig({ style: value })
          }
        >
          <SelectTrigger id="starter-style">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STYLE_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* 랜덤 순서 */}
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label htmlFor="randomize" className="cursor-pointer">
            랜덤 순서
          </Label>
          <p className="text-xs text-muted-foreground">
            프롬프트를 무작위 순서로 표시합니다.
          </p>
        </div>
        <Switch
          id="randomize"
          checked={config.randomize}
          onCheckedChange={(checked) => updateConfig({ randomize: checked })}
        />
      </div>
    </div>
  );
}
