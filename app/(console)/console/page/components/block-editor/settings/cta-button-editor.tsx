'use client';

/**
 * CTA 버튼 편집기
 *
 * 헤더의 Call-to-Action 버튼을 설정합니다.
 */

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { CtaButton } from '@/lib/public-page/header-templates';

interface CtaButtonEditorProps {
  /** 현재 CTA 버튼 설정 */
  button?: CtaButton;
  /** 변경 핸들러 */
  onChange: (button: CtaButton | undefined) => void;
}

export function CtaButtonEditor({ button, onChange }: CtaButtonEditorProps) {
  const isEnabled = !!button;

  const handleToggle = (enabled: boolean) => {
    if (enabled) {
      onChange({
        label: '시작하기',
        href: '#',
        variant: 'primary',
      });
    } else {
      onChange(undefined);
    }
  };

  const updateButton = (updates: Partial<CtaButton>) => {
    if (!button) return;
    onChange({ ...button, ...updates });
  };

  return (
    <div className="space-y-3">
      {/* 활성화 토글 */}
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label htmlFor="cta-toggle">CTA 버튼</Label>
          <p className="text-xs text-muted-foreground">
            헤더 우측에 버튼 표시
          </p>
        </div>
        <Switch
          id="cta-toggle"
          checked={isEnabled}
          onCheckedChange={handleToggle}
        />
      </div>

      {/* 버튼 설정 (활성화된 경우만) */}
      {isEnabled && button && (
        <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-3">
          {/* 버튼 라벨 */}
          <div className="space-y-1.5">
            <Label htmlFor="cta-label" className="text-xs">
              버튼 텍스트
            </Label>
            <Input
              id="cta-label"
              placeholder="시작하기"
              value={button.label}
              onChange={(e) => updateButton({ label: e.target.value })}
              className="h-8 text-sm"
            />
          </div>

          {/* 버튼 링크 */}
          <div className="space-y-1.5">
            <Label htmlFor="cta-href" className="text-xs">
              링크 URL
            </Label>
            <Input
              id="cta-href"
              placeholder="https://..."
              value={button.href}
              onChange={(e) => updateButton({ href: e.target.value })}
              className="h-8 text-sm"
            />
          </div>

          {/* 버튼 스타일 */}
          <div className="space-y-1.5">
            <Label htmlFor="cta-variant" className="text-xs">
              버튼 스타일
            </Label>
            <Select
              value={button.variant || 'primary'}
              onValueChange={(value) =>
                updateButton({
                  variant: value as CtaButton['variant'],
                })
              }
            >
              <SelectTrigger id="cta-variant" className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="primary">기본 (채워진)</SelectItem>
                <SelectItem value="secondary">보조 (외곽선)</SelectItem>
                <SelectItem value="ghost">고스트 (투명)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}
    </div>
  );
}
