'use client';

/**
 * 연락처 폼 블록 설정 컴포넌트
 *
 * ContactFormBlock의 설정을 편집합니다:
 * - 폼 필드 관리 (추가/삭제/수정)
 * - 제출 버튼 텍스트
 * - 성공 메시지
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
import type {
  ContactFormBlock,
  ContactFormField,
  ContactFormFieldType,
} from '@/lib/public-page/block-types';
import type { BlockSettingsProps } from './index';

const FIELD_TYPE_OPTIONS: { value: ContactFormFieldType; label: string }[] = [
  { value: 'text', label: '텍스트' },
  { value: 'email', label: '이메일' },
  { value: 'textarea', label: '긴 텍스트' },
];

export function ContactFormBlockSettings({
  block,
  onUpdate,
}: BlockSettingsProps<ContactFormBlock>) {
  const { config } = block;
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  /**
   * config 내 특정 필드 업데이트
   */
  const updateConfig = (updates: Partial<ContactFormBlock['config']>) => {
    onUpdate({
      config: { ...config, ...updates },
    } as Partial<ContactFormBlock>);
  };

  /**
   * 폼 필드 추가
   */
  const addField = () => {
    const newField: ContactFormField = {
      type: 'text',
      label: '',
      required: false,
    };
    updateConfig({
      fields: [...config.fields, newField],
    });
    setExpandedIndex(config.fields.length);
  };

  /**
   * 폼 필드 삭제
   */
  const removeField = (index: number) => {
    updateConfig({
      fields: config.fields.filter((_, i) => i !== index),
    });
    if (expandedIndex === index) {
      setExpandedIndex(null);
    }
  };

  /**
   * 폼 필드 업데이트
   */
  const updateField = (index: number, updates: Partial<ContactFormField>) => {
    updateConfig({
      fields: config.fields.map((field, i) =>
        i === index ? { ...field, ...updates } : field
      ),
    });
  };

  return (
    <div className="space-y-6">
      {/* 폼 필드 목록 */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>폼 필드</Label>
          <Button variant="outline" size="sm" onClick={addField}>
            <Plus className="mr-1 h-4 w-4" />
            추가
          </Button>
        </div>

        {config.fields.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            폼 필드를 추가하세요.
          </p>
        ) : (
          <div className="space-y-2">
            {config.fields.map((field, index) => (
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
                    {field.label || `필드 ${index + 1}`}
                    {field.required && (
                      <span className="ml-1 text-destructive">*</span>
                    )}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {FIELD_TYPE_OPTIONS.find((o) => o.value === field.type)?.label}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeField(index);
                    }}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>

                {expandedIndex === index && (
                  <div className="space-y-3 border-t border-border p-3">
                    <div className="space-y-2">
                      <Label htmlFor={`field-type-${index}`}>필드 타입</Label>
                      <Select
                        value={field.type}
                        onValueChange={(value: ContactFormFieldType) =>
                          updateField(index, { type: value })
                        }
                      >
                        <SelectTrigger id={`field-type-${index}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {FIELD_TYPE_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor={`field-label-${index}`}>라벨</Label>
                      <Input
                        id={`field-label-${index}`}
                        placeholder="이름, 이메일 등"
                        value={field.label}
                        onChange={(e) =>
                          updateField(index, { label: e.target.value })
                        }
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor={`field-placeholder-${index}`}>
                        플레이스홀더 (선택)
                      </Label>
                      <Input
                        id={`field-placeholder-${index}`}
                        placeholder="입력 힌트 텍스트"
                        value={field.placeholder ?? ''}
                        onChange={(e) =>
                          updateField(index, { placeholder: e.target.value })
                        }
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <Label
                        htmlFor={`field-required-${index}`}
                        className="cursor-pointer"
                      >
                        필수 입력
                      </Label>
                      <Switch
                        id={`field-required-${index}`}
                        checked={field.required}
                        onCheckedChange={(checked) =>
                          updateField(index, { required: checked })
                        }
                      />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 제출 버튼 텍스트 */}
      <div className="space-y-2">
        <Label htmlFor="form-submit-text">제출 버튼 텍스트</Label>
        <Input
          id="form-submit-text"
          placeholder="제출"
          value={config.submitText}
          onChange={(e) => updateConfig({ submitText: e.target.value })}
        />
      </div>

      {/* 성공 메시지 */}
      <div className="space-y-2">
        <Label htmlFor="form-success-message">성공 메시지</Label>
        <Textarea
          id="form-success-message"
          placeholder="제출이 완료되었습니다!"
          value={config.successMessage}
          onChange={(e) => updateConfig({ successMessage: e.target.value })}
          rows={2}
        />
      </div>
    </div>
  );
}
