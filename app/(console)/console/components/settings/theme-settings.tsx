'use client';

import { usePageConfig } from '../../hooks/use-console-state';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { ColorPicker, COLOR_PRESETS } from '@/components/ui/color-picker';
import { StyleSlider } from '@/components/ui/style-slider';
import { ImageUploadField } from '../../page/components/block-editor/settings/image-upload-field';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { BackgroundType, GradientDirection } from '@/lib/public-page/types';
import { GRADIENT_DIRECTION_OPTIONS } from '@/lib/public-page/background-utils';

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

        {/* 배경 타입 선택 탭 */}
        <div className="flex gap-1 rounded-lg bg-muted p-1">
          {(
            [
              { type: 'solid', label: '단색' },
              { type: 'image', label: '이미지' },
              { type: 'gradient', label: '그라데이션' },
            ] as const
          ).map(({ type, label }) => (
            <button
              key={type}
              type="button"
              onClick={() =>
                updateThemeConfig({ backgroundType: type as BackgroundType })
              }
              className={cn(
                'flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                theme.backgroundType === type
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {/* 단색 배경 설정 */}
        {theme.backgroundType === 'solid' && (
          <ColorPicker
            label="배경색"
            value={theme.backgroundColor}
            onChange={(v) => updateThemeConfig({ backgroundColor: v })}
            presets={COLOR_PRESETS.background}
            description="페이지 전체 배경"
          />
        )}

        {/* 이미지 배경 설정 */}
        {theme.backgroundType === 'image' && (
          <>
            <ImageUploadField
              id="theme-background-image"
              label="배경 이미지"
              value={theme.backgroundImage ?? ''}
              onChange={(url) =>
                updateThemeConfig({
                  backgroundImage: url || undefined,
                })
              }
              placeholder="https://example.com/image.jpg"
              maxSize={1920}
              quality={0.9}
              previewHeight={120}
            />

            <ColorPicker
              label="폴백 배경색"
              value={theme.backgroundColor}
              onChange={(v) => updateThemeConfig({ backgroundColor: v })}
              presets={COLOR_PRESETS.background}
              description="이미지 로딩 전/실패 시 표시"
            />

            {/* 이미지 옵션 */}
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
          </>
        )}

        {/* 그라데이션 배경 설정 */}
        {theme.backgroundType === 'gradient' && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <ColorPicker
                label="시작 색상"
                value={theme.gradientFrom ?? '#667eea'}
                onChange={(v) => updateThemeConfig({ gradientFrom: v })}
                presets={COLOR_PRESETS.primary}
              />
              <ColorPicker
                label="끝 색상"
                value={theme.gradientTo ?? '#764ba2'}
                onChange={(v) => updateThemeConfig({ gradientTo: v })}
                presets={COLOR_PRESETS.primary}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">방향</Label>
              <select
                value={theme.gradientDirection ?? 'to-br'}
                onChange={(e) =>
                  updateThemeConfig({
                    gradientDirection: e.target.value as GradientDirection,
                    gradientAngle: undefined, // 프리셋 선택 시 사용자 각도 초기화
                  })
                }
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              >
                {GRADIENT_DIRECTION_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">
                사용자 정의 각도 (선택)
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={0}
                  max={360}
                  placeholder="0-360"
                  value={theme.gradientAngle ?? ''}
                  onChange={(e) => {
                    const value = e.target.value;
                    updateThemeConfig({
                      gradientAngle: value ? Number(value) : undefined,
                    });
                  }}
                  className="w-24"
                />
                <span className="text-sm text-muted-foreground">
                  도 (입력 시 방향 프리셋 무시)
                </span>
              </div>
            </div>

            {/* 그라데이션 미리보기 */}
            <div
              className="h-16 rounded-lg border border-border"
              style={{
                background: `linear-gradient(${
                  theme.gradientAngle !== undefined
                    ? `${theme.gradientAngle}deg`
                    : {
                        'to-b': '180deg',
                        'to-t': '0deg',
                        'to-r': '90deg',
                        'to-l': '270deg',
                        'to-br': '135deg',
                        'to-bl': '225deg',
                        'to-tr': '45deg',
                        'to-tl': '315deg',
                      }[theme.gradientDirection ?? 'to-br']
                }, ${theme.gradientFrom ?? '#667eea'}, ${theme.gradientTo ?? '#764ba2'})`,
              }}
            />
          </>
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
