'use client';

/**
 * 헤더 블록 설정 컴포넌트
 *
 * HeaderBlock의 설정을 편집합니다:
 * - 템플릿 선택: 프로필, 플로팅 글래스, 미니멀, 필 네비게이션
 * - 제목: 페이지 상단에 표시될 제목
 * - 설명: 페이지 소개 문구
 * - 로고 URL: 커스텀 로고 이미지
 * - 브랜드명 표시: "Powered by SOFA" 토글
 * - 네비게이션 링크 (웹사이트 스타일 템플릿)
 * - CTA 버튼 (웹사이트 스타일 템플릿)
 */

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import type { HeaderBlock } from '@/lib/public-page/block-types';
import {
  HeaderTemplate,
  HEADER_TEMPLATE_META,
  ProfileTheme,
  PROFILE_THEME_META,
  type HeaderTemplateType,
  type ProfileThemeType,
  type NavLink,
  type CtaButton,
} from '@/lib/public-page/header-templates';
import type { BlockSettingsProps } from './index';
import { ImageUploadField } from './image-upload-field';
import { TemplateCard } from './template-card';
import { NavLinksEditor } from './nav-links-editor';
import { CtaButtonEditor } from './cta-button-editor';
import { ProfileThemeCard } from './profile-theme-card';
import { HeroImageSettings } from './hero-image-settings';

export function HeaderBlockSettings({
  block,
  onUpdate,
}: BlockSettingsProps<HeaderBlock>) {
  const { config } = block;
  const currentTemplate = config.template || HeaderTemplate.PROFILE;
  const isWebsiteStyle = currentTemplate !== HeaderTemplate.PROFILE;
  const isProfileTemplate = currentTemplate === HeaderTemplate.PROFILE;
  const currentProfileTheme = config.profileTheme || ProfileTheme.CLASSIC;

  /**
   * config 내 특정 필드 업데이트
   */
  const updateConfig = (updates: Partial<HeaderBlock['config']>) => {
    onUpdate({
      config: { ...config, ...updates },
    } as Partial<HeaderBlock>);
  };

  return (
    <div className="space-y-6">
      {/* 템플릿 선택 섹션 */}
      <div className="space-y-3">
        <Label>템플릿 선택</Label>
        <div className="grid grid-cols-2 gap-2">
          {Object.entries(HEADER_TEMPLATE_META).map(([key, meta]) => (
            <TemplateCard
              key={key}
              templateKey={key}
              meta={meta}
              selected={currentTemplate === key}
              onSelect={() =>
                updateConfig({ template: key as HeaderTemplateType })
              }
            />
          ))}
        </div>
      </div>

      {/* 프로필 테마 선택 (프로필 템플릿일 때만 표시) */}
      {isProfileTemplate && (
        <>
          <Separator />

          <div className="space-y-4">
            <Label className="text-base font-medium">프로필 테마</Label>
            <div className="grid grid-cols-3 gap-2">
              {Object.entries(PROFILE_THEME_META).map(([key, meta]) => (
                <ProfileThemeCard
                  key={key}
                  themeKey={key}
                  meta={meta}
                  selected={currentProfileTheme === key}
                  onSelect={() =>
                    updateConfig({ profileTheme: key as ProfileThemeType })
                  }
                />
              ))}
            </div>

            {/* 히어로 이미지 테마 전용 설정 */}
            {currentProfileTheme === ProfileTheme.HERO_IMAGE && (
              <HeroImageSettings config={config} onUpdate={updateConfig} />
            )}
          </div>
        </>
      )}

      <Separator />

      {/* 기본 정보 섹션 */}
      <div className="space-y-4">
        <Label className="text-base font-medium">기본 정보</Label>

        {/* 제목 */}
        <div className="space-y-2">
          <Label htmlFor="header-title">제목</Label>
          <Input
            id="header-title"
            placeholder="페이지 제목을 입력하세요"
            value={config.title}
            onChange={(e) => updateConfig({ title: e.target.value })}
          />
          <p className="text-xs text-muted-foreground">
            비워두면 챗봇 이름이 표시됩니다.
          </p>
        </div>

        {/* 설명 (프로필 스타일에서만 표시) */}
        {currentTemplate === HeaderTemplate.PROFILE && (
          <div className="space-y-2">
            <Label htmlFor="header-description">설명</Label>
            <Textarea
              id="header-description"
              placeholder="페이지 설명을 입력하세요"
              value={config.description}
              onChange={(e) => updateConfig({ description: e.target.value })}
              rows={3}
            />
          </div>
        )}

        {/* 로고 이미지 */}
        <ImageUploadField
          id="header-logo"
          label="로고 이미지"
          value={config.logoUrl || ''}
          onChange={(url) => updateConfig({ logoUrl: url || undefined })}
          placeholder="https://example.com/logo.png"
          maxSize={400}
          previewHeight={64}
        />

        {/* 브랜드명 표시 */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="show-brand">브랜드명 표시</Label>
            <p className="text-xs text-muted-foreground">
              하단에 &quot;Powered by SOFA&quot; 표시
            </p>
          </div>
          <Switch
            id="show-brand"
            checked={config.showBrandName}
            onCheckedChange={(checked) =>
              updateConfig({ showBrandName: checked })
            }
          />
        </div>
      </div>

      {/* 웹사이트 스타일 전용 설정 */}
      {isWebsiteStyle && (
        <>
          <Separator />

          <div className="space-y-4">
            <Label className="text-base font-medium">네비게이션 설정</Label>

            {/* 네비게이션 링크 편집기 */}
            <NavLinksEditor
              links={config.navLinks || []}
              onChange={(links: NavLink[]) => updateConfig({ navLinks: links })}
            />

            {/* CTA 버튼 편집기 */}
            <CtaButtonEditor
              button={config.ctaButton}
              onChange={(button: CtaButton | undefined) =>
                updateConfig({ ctaButton: button })
              }
            />
          </div>
        </>
      )}
    </div>
  );
}
