'use client';

import { cn } from '@/lib/utils';
import { Input } from './input';
import { Label } from './label';

/**
 * 프리셋 색상 팔레트
 * - 테마 설정에서 공통으로 사용
 */
export const COLOR_PRESETS = {
  background: [
    '#ffffff',
    '#f9fafb',
    '#f3f4f6',
    '#e5e7eb',
    '#1f2937',
    '#111827',
    '#0f172a',
  ],
  card: ['#ffffff', '#fafafa', '#f5f5f5', '#18181b', '#27272a', '#3f3f46'],
  primary: [
    '#3B82F6',
    '#2563EB',
    '#8B5CF6',
    '#7C3AED',
    '#EC4899',
    '#10B981',
    '#F59E0B',
  ],
  text: [
    '#1f2937',
    '#374151',
    '#4b5563',
    '#6b7280',
    '#f9fafb',
    '#e5e7eb',
  ],
};

interface ColorPickerProps {
  /** 라벨 텍스트 */
  label: string;
  /** 현재 색상값 (hex) */
  value: string;
  /** 색상 변경 콜백 */
  onChange: (value: string) => void;
  /** 프리셋 색상 배열 */
  presets?: string[];
  /** 설명 텍스트 */
  description?: string;
  /** 클래스명 */
  className?: string;
}

/**
 * 컬러 피커 컴포넌트
 *
 * - 네이티브 color input으로 직관적인 색상 선택
 * - HEX 코드 직접 입력 지원
 * - 프리셋 팔레트로 빠른 선택 (줄바꿈 허용)
 */
export function ColorPicker({
  label,
  value,
  onChange,
  presets = [],
  description,
  className,
}: ColorPickerProps) {
  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">{label}</Label>
        {description && (
          <span className="text-xs text-muted-foreground">{description}</span>
        )}
      </div>

      {/* 컬러 인풋 + HEX 입력 */}
      <div className="flex items-center gap-3">
        <div className="relative shrink-0">
          <input
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="h-10 w-10 cursor-pointer rounded-lg border border-border bg-transparent"
          />
        </div>
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-28 font-mono text-sm uppercase"
          maxLength={7}
          placeholder="#000000"
        />
      </div>

      {/* 프리셋 팔레트 */}
      {presets.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {presets.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => onChange(preset)}
              className={cn(
                'h-7 w-7 shrink-0 rounded-md border-2 transition-all hover:scale-105',
                value.toLowerCase() === preset.toLowerCase()
                  ? 'border-primary ring-2 ring-primary/30'
                  : 'border-border hover:border-muted-foreground'
              )}
              style={{ backgroundColor: preset }}
              title={preset}
            />
          ))}
        </div>
      )}
    </div>
  );
}
