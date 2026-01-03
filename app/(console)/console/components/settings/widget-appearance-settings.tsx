'use client';

import { useWidgetConfig } from '../../hooks/use-console-state';
import { Label } from '@/components/ui/label';
import { ColorPicker, COLOR_PRESETS } from '@/components/ui/color-picker';
import { StyleSlider } from '@/components/ui/style-slider';

/**
 * 폰트 옵션
 */
const FONT_OPTIONS = [
  { value: 'system-ui, -apple-system, sans-serif', label: '시스템 기본' },
  { value: "'Pretendard Variable', sans-serif", label: 'Pretendard' },
  { value: "'Noto Sans KR', sans-serif", label: 'Noto Sans KR' },
  { value: "'Spoqa Han Sans Neo', sans-serif", label: 'Spoqa Han Sans' },
];

/**
 * 위젯 외관 설정
 *
 * - 주요 색상 (ColorPicker + 프리셋)
 * - 배경 색상
 * - 텍스트 색상
 * - 모서리 둥글기 (StyleSlider: 0-32px)
 * - 버튼 크기 (StyleSlider: 40-80px)
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
      <StyleSlider
        label="모서리 둥글기"
        value={theme.borderRadius ?? 16}
        onChange={(value) => updateWidgetTheme({ borderRadius: value })}
        min={0}
        max={32}
        step={2}
        defaultValue={16}
      />

      {/* 버튼 크기 */}
      <StyleSlider
        label="버튼 크기"
        value={theme.buttonSize ?? 56}
        onChange={(value) => updateWidgetTheme({ buttonSize: value })}
        min={40}
        max={80}
        step={4}
        defaultValue={56}
      />

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
