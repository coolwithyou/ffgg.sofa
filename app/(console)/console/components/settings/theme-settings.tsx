'use client';

import { usePageConfig } from '../../hooks/use-console-state';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

/**
 * 프리셋 색상 팔레트
 * - 자주 사용되는 색상을 빠르게 선택할 수 있도록 제공
 */
const COLOR_PRESETS = {
  background: ['#ffffff', '#f9fafb', '#1f2937', '#111827', '#0f172a'],
  primary: ['#3B82F6', '#8B5CF6', '#EC4899', '#10B981', '#F59E0B'],
  text: ['#1f2937', '#374151', '#f9fafb', '#ffffff', '#e5e7eb'],
};

interface ColorPickerProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  presets: string[];
}

/**
 * 컬러 피커 컴포넌트
 *
 * - 네이티브 color input으로 직관적인 색상 선택
 * - HEX 코드 직접 입력 지원
 * - 프리셋 팔레트로 빠른 선택
 */
function ColorPicker({ label, value, onChange, presets }: ColorPickerProps) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex items-center gap-2">
        {/* 컬러 인풋 */}
        <div className="relative">
          <input
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="h-10 w-10 cursor-pointer rounded-lg border border-border"
          />
        </div>
        {/* HEX 입력 */}
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-24 font-mono text-sm uppercase"
          maxLength={7}
        />
      </div>
      {/* 프리셋 */}
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
 * 테마 설정 폼
 *
 * - 배경색: 페이지 전체 배경
 * - 주요색: 버튼, 링크 등 강조 색상
 * - 텍스트색: 본문 텍스트 색상
 * - 폰트: 시스템 기본 또는 웹폰트 선택
 */
export function ThemeSettings() {
  const { pageConfig, updateThemeConfig } = usePageConfig();
  const { theme } = pageConfig;

  return (
    <div className="space-y-6 pt-2">
      {/* 배경색 */}
      <ColorPicker
        label="배경색"
        value={theme.backgroundColor}
        onChange={(value) => updateThemeConfig({ backgroundColor: value })}
        presets={COLOR_PRESETS.background}
      />

      {/* 주요색 */}
      <ColorPicker
        label="주요 강조색"
        value={theme.primaryColor}
        onChange={(value) => updateThemeConfig({ primaryColor: value })}
        presets={COLOR_PRESETS.primary}
      />

      {/* 텍스트색 */}
      <ColorPicker
        label="텍스트색"
        value={theme.textColor}
        onChange={(value) => updateThemeConfig({ textColor: value })}
        presets={COLOR_PRESETS.text}
      />

      {/* 폰트 선택 */}
      <div className="space-y-2">
        <Label htmlFor="font-family">폰트</Label>
        <select
          id="font-family"
          value={theme.fontFamily || ''}
          onChange={(e) =>
            updateThemeConfig({ fontFamily: e.target.value || undefined })
          }
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
        >
          <option value="">시스템 기본</option>
          <option value="'Pretendard', sans-serif">Pretendard</option>
          <option value="'Noto Sans KR', sans-serif">Noto Sans KR</option>
          <option value="'Inter', sans-serif">Inter</option>
        </select>
      </div>
    </div>
  );
}
