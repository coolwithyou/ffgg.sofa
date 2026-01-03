'use client';

import { usePageConfig } from '../../hooks/use-console-state';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { ColorPicker, COLOR_PRESETS } from '@/components/ui/color-picker';
import { StyleSlider } from '@/components/ui/style-slider';

/**
 * 테마 설정 폼
 *
 * 3개 섹션으로 구성:
 * 1. 배경 설정 - 외부 배경색, 배경 이미지, 이미지 옵션
 * 2. 카드 스타일 - 카드 배경색, 그림자, 마진, 패딩, 둥글기
 * 3. 색상 & 폰트 - 주요색, 텍스트색, 폰트
 */
export function ThemeSettings() {
  const { pageConfig, updateThemeConfig } = usePageConfig();
  const { theme } = pageConfig;

  return (
    <div className="space-y-6 pt-2">
      {/* 배경 설정 */}
      <div className="space-y-4">
        <h4 className="text-sm font-medium text-foreground">배경 설정</h4>

        <ColorPicker
          label="외부 배경색"
          value={theme.backgroundColor}
          onChange={(v) => updateThemeConfig({ backgroundColor: v })}
          presets={COLOR_PRESETS.background}
          description="페이지 전체 배경"
        />

        <div className="space-y-2">
          <Label className="text-sm font-medium">배경 이미지 URL</Label>
          <Input
            placeholder="https://example.com/image.jpg"
            value={theme.backgroundImage ?? ''}
            onChange={(e) =>
              updateThemeConfig({
                backgroundImage: e.target.value || undefined,
              })
            }
          />
          <p className="text-xs text-muted-foreground">
            이미지 URL을 입력하면 배경에 적용됩니다
          </p>
        </div>

        {/* 배경 이미지가 있을 때만 옵션 표시 */}
        {theme.backgroundImage && (
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-sm font-medium">이미지 크기</Label>
              <select
                value={theme.backgroundSize ?? 'cover'}
                onChange={(e) =>
                  updateThemeConfig({
                    backgroundSize: e.target.value as
                      | 'cover'
                      | 'contain'
                      | 'auto',
                  })
                }
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              >
                <option value="cover">채우기 (Cover)</option>
                <option value="contain">맞추기 (Contain)</option>
                <option value="auto">원본 크기</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">반복</Label>
              <select
                value={theme.backgroundRepeat ?? 'no-repeat'}
                onChange={(e) =>
                  updateThemeConfig({
                    backgroundRepeat: e.target.value as
                      | 'no-repeat'
                      | 'repeat'
                      | 'repeat-x'
                      | 'repeat-y',
                  })
                }
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              >
                <option value="no-repeat">반복 안함</option>
                <option value="repeat">반복</option>
                <option value="repeat-x">가로 반복</option>
                <option value="repeat-y">세로 반복</option>
              </select>
            </div>
          </div>
        )}
      </div>

      <Separator />

      {/* 카드 스타일 */}
      <div className="space-y-4">
        <h4 className="text-sm font-medium text-foreground">카드 스타일</h4>

        <ColorPicker
          label="카드 배경색"
          value={theme.cardBackgroundColor ?? '#ffffff'}
          onChange={(v) => updateThemeConfig({ cardBackgroundColor: v })}
          presets={COLOR_PRESETS.card}
          description="콘텐츠 영역 배경"
        />

        <StyleSlider
          label="그림자 강도"
          value={theme.cardShadow ?? 20}
          onChange={(v) => updateThemeConfig({ cardShadow: v })}
          min={0}
          max={100}
          step={5}
          unit="%"
          defaultValue={20}
        />

        <StyleSlider
          label="상하 마진"
          value={theme.cardMarginY ?? 32}
          onChange={(v) => updateThemeConfig({ cardMarginY: v })}
          min={0}
          max={64}
          step={4}
          defaultValue={32}
        />

        <StyleSlider
          label="좌우 패딩"
          value={theme.cardPaddingX ?? 16}
          onChange={(v) => updateThemeConfig({ cardPaddingX: v })}
          min={0}
          max={48}
          step={4}
          defaultValue={16}
        />

        <StyleSlider
          label="모서리 둥글기"
          value={theme.cardBorderRadius ?? 16}
          onChange={(v) => updateThemeConfig({ cardBorderRadius: v })}
          min={0}
          max={32}
          step={2}
          defaultValue={16}
        />
      </div>

      <Separator />

      {/* 색상 & 폰트 */}
      <div className="space-y-4">
        <h4 className="text-sm font-medium text-foreground">색상 & 폰트</h4>

        <ColorPicker
          label="주요 강조색"
          value={theme.primaryColor}
          onChange={(v) => updateThemeConfig({ primaryColor: v })}
          presets={COLOR_PRESETS.primary}
        />

        <ColorPicker
          label="텍스트색"
          value={theme.textColor}
          onChange={(v) => updateThemeConfig({ textColor: v })}
          presets={COLOR_PRESETS.text}
        />

        <div className="space-y-2">
          <Label className="text-sm font-medium">폰트</Label>
          <select
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
    </div>
  );
}
