'use client';

/**
 * AI 채팅 미리보기 블록 설정 컴포넌트
 *
 * AiChatPreviewBlock의 설정을 편집합니다:
 * - 대화 예시 관리 (추가/삭제/수정)
 * - 타이핑 애니메이션 옵션
 */

import { useState } from 'react';
import { Plus, Trash2, Bot, User } from 'lucide-react';
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
import { cn } from '@/lib/utils';
import type { AiChatPreviewBlock, AiChatMessage, AiChatRole } from '@/lib/public-page/block-types';
import type { BlockSettingsProps } from './index';

const ROLE_OPTIONS: { value: AiChatRole; label: string; icon: typeof Bot }[] = [
  { value: 'user', label: '사용자', icon: User },
  { value: 'assistant', label: 'AI 어시스턴트', icon: Bot },
];

export function AiChatPreviewBlockSettings({
  block,
  onUpdate,
}: BlockSettingsProps<AiChatPreviewBlock>) {
  const { config } = block;
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  /**
   * config 내 특정 필드 업데이트
   */
  const updateConfig = (updates: Partial<AiChatPreviewBlock['config']>) => {
    onUpdate({
      config: { ...config, ...updates },
    } as Partial<AiChatPreviewBlock>);
  };

  /**
   * 메시지 추가
   */
  const addMessage = () => {
    // 마지막 메시지 역할의 반대로 추가
    const lastRole = config.conversations.length > 0
      ? config.conversations[config.conversations.length - 1].role
      : 'assistant';
    const newRole: AiChatRole = lastRole === 'user' ? 'assistant' : 'user';

    const newMessage: AiChatMessage = {
      role: newRole,
      content: '',
    };
    updateConfig({
      conversations: [...config.conversations, newMessage],
    });
    setExpandedIndex(config.conversations.length);
  };

  /**
   * 메시지 삭제
   */
  const removeMessage = (index: number) => {
    updateConfig({
      conversations: config.conversations.filter((_, i) => i !== index),
    });
    if (expandedIndex === index) {
      setExpandedIndex(null);
    }
  };

  /**
   * 메시지 업데이트
   */
  const updateMessage = (index: number, updates: Partial<AiChatMessage>) => {
    updateConfig({
      conversations: config.conversations.map((msg, i) =>
        i === index ? { ...msg, ...updates } : msg
      ),
    });
  };

  return (
    <div className="space-y-6">
      {/* 대화 목록 */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>대화 예시</Label>
          <Button variant="outline" size="sm" onClick={addMessage}>
            <Plus className="mr-1 h-4 w-4" />
            추가
          </Button>
        </div>

        {config.conversations.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            대화 예시를 추가하세요.
          </p>
        ) : (
          <div className="space-y-2">
            {config.conversations.map((message, index) => {
              const RoleIcon = message.role === 'user' ? User : Bot;
              return (
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
                    <RoleIcon className={cn(
                      'h-4 w-4',
                      message.role === 'user' ? 'text-muted-foreground' : 'text-primary'
                    )} />
                    <span className="flex-1 truncate text-sm">
                      {message.content || `메시지 ${index + 1}`}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeMessage(index);
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>

                  {expandedIndex === index && (
                    <div className="space-y-3 border-t border-border p-3">
                      <div className="space-y-2">
                        <Label htmlFor={`message-role-${index}`}>역할</Label>
                        <Select
                          value={message.role}
                          onValueChange={(value: AiChatRole) =>
                            updateMessage(index, { role: value })
                          }
                        >
                          <SelectTrigger id={`message-role-${index}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ROLE_OPTIONS.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                <div className="flex items-center gap-2">
                                  <option.icon className="h-4 w-4" />
                                  {option.label}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor={`message-content-${index}`}>메시지</Label>
                        <Textarea
                          id={`message-content-${index}`}
                          placeholder="메시지 내용"
                          value={message.content}
                          onChange={(e) =>
                            updateMessage(index, { content: e.target.value })
                          }
                          rows={3}
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 타이핑 애니메이션 */}
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label htmlFor="typing-animation" className="cursor-pointer">
            타이핑 애니메이션
          </Label>
          <p className="text-xs text-muted-foreground">
            메시지가 순차적으로 나타나는 효과를 적용합니다.
          </p>
        </div>
        <Switch
          id="typing-animation"
          checked={config.showTypingAnimation}
          onCheckedChange={(checked) =>
            updateConfig({ showTypingAnimation: checked })
          }
        />
      </div>
    </div>
  );
}
