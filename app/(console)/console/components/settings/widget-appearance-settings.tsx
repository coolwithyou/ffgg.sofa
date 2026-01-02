'use client';

import { useWidgetConfig } from '../../hooks/use-console-state';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';

/**
 * 프리셋 색상 팔레트
 */
const COLOR_PRESETS = {
  primary: ['#3B82F6', '#8B5CF6', '#EC4899', '#10B981', '#F59E0B', '#EF4444'],
  background: ['#ffffff', '#f9fafb', '#1f2937', '#111827', '#0f172a'],
  text: ['#1f2937', '#374151', '#f9fafb', '#ffffff', '#6b7280'],
};

/**
 * 폰트 옵션
 */
const FONT_OPTIONS = [
  { value: 'system-ui, -apple-system, sans-serif', label: '시스템 기본' },
  { value: "'Pretendard Variable', sans-serif", label: 'Pretendard' },
  { value: "'Noto Sans KR', sans-serif", label: 'Noto Sans KR' },
  { value: "'Spoqa Han Sans Neo', sans-serif", label: 'Spoqa Han Sans' },
];

interface ColorPickerProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  presets: string[];
}

/**
 * 컬러 피커 컴포넌트
 */
function ColorPicker({ label, value, onChange, presets }: ColorPickerProps) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex items-center gap-2">
        <div className="relative">
          <input
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="h-10 w-10 cursor-pointer rounded-lg border border-border"
          />
        </div>
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-24 font-mono text-sm uppercase"
          maxLength={7}
        />
      </div>
      <div className="flex gap-1">
        {presets.map((preset) => (
          <button
            key={preset}
            type="button"
            onClick={() => onChange(preset)}
            className={`h-6 w-6 rounded-md border transition-transform hover:scale-110 ${
              value.toLowerCase() === preset.toLowerCase()
                ? 'border-primary ring-2 ring-primary ring-offset-1'
                : 'border-border'
            }`}
            style={{ backgroundColor: preset }}
            title={preset}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * 위젯 외관 설정
 *
 * - 주요 색상 (ColorPicker + 프리셋)
 * - 배경 색상
 * - 텍스트 색상
 * - 모서리 둥글기 (Slider: 0-32px)
 * - 버튼 크기 (Slider: 40-80px)
 * - 폰트 선택
 */
export function WidgetAppearanceSettings() {
  const { widgetConfig, updateWidgetTheme } = useWidgetConfig();
  const { theme } = widgetConfig;

  return (
    <div className="space-y-6 pb-4">
      {/* 주요 색상 */}
      <ColorPicker
        label="주요 색상"
        value={theme.primaryColor}
        onChange={(value) => updateWidgetTheme({ primaryColor: value })}
        presets={COLOR_PRESETS.primary}
      />

      {/* 배경 색상 */}
      <ColorPicker
        label="배경 색상"
        value={theme.backgroundColor}
        onChange={(value) => updateWidgetTheme({ backgroundColor: value })}
        presets={COLOR_PRESETS.background}
      />

      {/* 텍스트 색상 */}
      <ColorPicker
        label="텍스트 색상"
        value={theme.textColor}
        onChange={(value) => updateWidgetTheme({ textColor: value })}
        presets={COLOR_PRESETS.text}
      />

      {/* 모서리 둥글기 */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>모서리 둥글기</Label>
          <span className="text-sm text-muted-foreground">
            {theme.borderRadius ?? 16}px
          </span>
        </div>
        <Slider
          value={[theme.borderRadius ?? 16]}
          onValueChange={([value]: number[]) => updateWidgetTheme({ borderRadius: value })}
          min={0}
          max={32}
          step={2}
          className="py-2"
        />
      </div>

      {/* 버튼 크기 */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>버튼 크기</Label>
          <span className="text-sm text-muted-foreground">
            {theme.buttonSize ?? 56}px
          </span>
        </div>
        <Slider
          value={[theme.buttonSize ?? 56]}
          onValueChange={([value]: number[]) => updateWidgetTheme({ buttonSize: value })}
          min={40}
          max={80}
          step={4}
          className="py-2"
        />
      </div>

      {/* 폰트 선택 */}
      <div className="space-y-2">
        <Label>폰트</Label>
        <select
          value={theme.fontFamily ?? FONT_OPTIONS[0].value}
          onChange={(e) => updateWidgetTheme({ fontFamily: e.target.value })}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
        >
          {FONT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
