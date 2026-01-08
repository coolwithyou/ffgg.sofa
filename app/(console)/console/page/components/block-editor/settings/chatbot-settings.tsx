'use client';

/**
 * 챗봇 블록 설정 컴포넌트
 *
 * ChatbotBlock의 설정을 편집합니다:
 * - 크기 설정: 최소/최대 높이
 * - 컨테이너 스타일: 배경색, 테두리색
 * - 입력 필드: placeholder, 배경색, 텍스트색
 * - 전송 버튼: 배경색, 텍스트색
 * - 사용자 메시지: 배경색, 텍스트색
 * - AI 응답: 배경색, 텍스트색
 */

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { RotateCcw } from 'lucide-react';
import type { ChatbotBlock } from '@/lib/public-page/block-types';
import type { BlockSettingsProps } from './index';

/**
 * 색상 입력 컴포넌트
 * - 컬러 피커 + 텍스트 입력 조합
 * - 빈 값(undefined)일 때 "테마 기본값" 표시
 * - 초기화 버튼으로 기본값 복원
 */
function ColorInput({
  id,
  label,
  value,
  onChange,
  placeholder = '테마 기본값',
}: {
  id: string;
  label: string;
  value?: string;
  onChange: (value?: string) => void;
  placeholder?: string;
}) {
  const hasValue = value !== undefined && value !== '';

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs">
        {label}
      </Label>
      <div className="flex items-center gap-2">
        {/* 컬러 피커 */}
        <div className="relative">
          <input
            type="color"
            id={`${id}-picker`}
            value={value || '#ffffff'}
            onChange={(e) => onChange(e.target.value)}
            className="h-9 w-9 cursor-pointer appearance-none rounded-md border border-border bg-transparent p-0.5"
            style={{ colorScheme: 'light dark' }}
          />
        </div>

        {/* 텍스트 입력 */}
        <Input
          id={id}
          type="text"
          value={value || ''}
          onChange={(e) => {
            const val = e.target.value.trim();
            onChange(val || undefined);
          }}
          placeholder={placeholder}
          className="h-9 flex-1 font-mono text-xs"
        />

        {/* 초기화 버튼 */}
        {hasValue && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0"
            onClick={() => onChange(undefined)}
            title="기본값으로 초기화"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}

/**
 * 섹션 구분 컴포넌트
 */
function SettingsSection({
  title,
  icon,
  children,
}: {
  title: string;
  icon: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 border-b border-border pb-2">
        <span className="text-sm">{icon}</span>
        <span className="text-sm font-medium text-foreground">{title}</span>
      </div>
      <div className="space-y-3 pl-1">{children}</div>
    </div>
  );
}

export function ChatbotBlockSettings({
  block,
  onUpdate,
}: BlockSettingsProps<ChatbotBlock>) {
  const { config } = block;

  /**
   * config 내 특정 필드 업데이트
   */
  const updateConfig = (updates: Partial<ChatbotBlock['config']>) => {
    onUpdate({
      config: { ...config, ...updates },
    } as Partial<ChatbotBlock>);
  };

  return (
    <div className="space-y-6">
      {/* 📐 크기 설정 */}
      <SettingsSection title="크기 설정" icon="📐">
        <div className="grid grid-cols-2 gap-3">
          {/* 최소 높이 */}
          <div className="space-y-1.5">
            <Label htmlFor="chatbot-min-height" className="text-xs">
              최소 높이 (px)
            </Label>
            <Input
              id="chatbot-min-height"
              type="number"
              min={200}
              max={800}
              step={50}
              value={config.minHeight}
              onChange={(e) =>
                updateConfig({ minHeight: parseInt(e.target.value, 10) || 300 })
              }
              className="h-9"
            />
          </div>

          {/* 최대 높이 */}
          <div className="space-y-1.5">
            <Label htmlFor="chatbot-max-height" className="text-xs">
              최대 높이 (px)
            </Label>
            <Input
              id="chatbot-max-height"
              type="number"
              min={300}
              max={1200}
              step={50}
              value={config.maxHeight}
              onChange={(e) =>
                updateConfig({ maxHeight: parseInt(e.target.value, 10) || 600 })
              }
              className="h-9"
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          채팅 영역의 높이 범위: {config.minHeight}px ~ {config.maxHeight}px
        </p>
      </SettingsSection>

      {/* 🎨 컨테이너 스타일 */}
      <SettingsSection title="컨테이너 스타일" icon="🎨">
        <ColorInput
          id="chatbot-bg-color"
          label="배경 색상"
          value={config.backgroundColor}
          onChange={(value) => updateConfig({ backgroundColor: value })}
          placeholder="카드 배경색"
        />
        <ColorInput
          id="chatbot-border-color"
          label="테두리 색상"
          value={config.borderColor}
          onChange={(value) => updateConfig({ borderColor: value })}
          placeholder="테마 테두리색"
        />
      </SettingsSection>

      {/* ✏️ 입력 필드 */}
      <SettingsSection title="입력 필드" icon="✏️">
        <div className="space-y-1.5">
          <Label htmlFor="chatbot-placeholder" className="text-xs">
            Placeholder 텍스트
          </Label>
          <Input
            id="chatbot-placeholder"
            type="text"
            value={config.inputPlaceholder || ''}
            onChange={(e) => {
              const val = e.target.value.trim();
              updateConfig({ inputPlaceholder: val || undefined });
            }}
            placeholder="챗봇 기본 placeholder"
            className="h-9 text-xs"
          />
        </div>
        <ColorInput
          id="chatbot-input-bg"
          label="배경 색상"
          value={config.inputBackgroundColor}
          onChange={(value) => updateConfig({ inputBackgroundColor: value })}
        />
        <ColorInput
          id="chatbot-input-text"
          label="텍스트 색상"
          value={config.inputTextColor}
          onChange={(value) => updateConfig({ inputTextColor: value })}
        />
      </SettingsSection>

      {/* 🔘 전송 버튼 */}
      <SettingsSection title="전송 버튼" icon="🔘">
        <ColorInput
          id="chatbot-btn-bg"
          label="배경 색상"
          value={config.buttonBackgroundColor}
          onChange={(value) => updateConfig({ buttonBackgroundColor: value })}
          placeholder="테마 primaryColor"
        />
        <ColorInput
          id="chatbot-btn-text"
          label="텍스트 색상"
          value={config.buttonTextColor}
          onChange={(value) => updateConfig({ buttonTextColor: value })}
          placeholder="#ffffff"
        />
      </SettingsSection>

      {/* 💬 사용자 메시지 */}
      <SettingsSection title="사용자 메시지" icon="💬">
        <ColorInput
          id="chatbot-user-bg"
          label="배경 색상"
          value={config.userMessageBackgroundColor}
          onChange={(value) =>
            updateConfig({ userMessageBackgroundColor: value })
          }
          placeholder="테마 primaryColor"
        />
        <ColorInput
          id="chatbot-user-text"
          label="텍스트 색상"
          value={config.userMessageTextColor}
          onChange={(value) => updateConfig({ userMessageTextColor: value })}
          placeholder="#ffffff"
        />
      </SettingsSection>

      {/* 🤖 AI 응답 */}
      <SettingsSection title="AI 응답" icon="🤖">
        <ColorInput
          id="chatbot-assistant-bg"
          label="배경 색상"
          value={config.assistantMessageBackgroundColor}
          onChange={(value) =>
            updateConfig({ assistantMessageBackgroundColor: value })
          }
          placeholder="muted 색상"
        />
        <ColorInput
          id="chatbot-assistant-text"
          label="텍스트 색상"
          value={config.assistantMessageTextColor}
          onChange={(value) =>
            updateConfig({ assistantMessageTextColor: value })
          }
          placeholder="테마 textColor"
        />
      </SettingsSection>

      {/* 미리보기 안내 */}
      <div className="rounded-lg border border-border bg-muted/30 p-3">
        <p className="text-xs text-muted-foreground">
          💡 색상을 설정하지 않으면 테마 색상이 자동 적용됩니다. 초기화 버튼
          <RotateCcw className="mx-1 inline h-3 w-3" />을 클릭하여 기본값으로
          되돌릴 수 있습니다.
        </p>
      </div>
    </div>
  );
}
