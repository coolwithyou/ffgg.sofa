'use client';

/**
 * 헤더 블록 설정 컴포넌트
 *
 * HeaderBlock의 설정을 편집합니다:
 * - 제목: 페이지 상단에 표시될 제목
 * - 설명: 페이지 소개 문구
 * - 로고 URL: 커스텀 로고 이미지
 * - 브랜드명 표시: "Powered by SOFA" 토글
 */

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import type { HeaderBlock } from '@/lib/public-page/block-types';
import type { BlockSettingsProps } from './index';
import { ImageUploadField } from './image-upload-field';

export function HeaderBlockSettings({
  block,
  onUpdate,
}: BlockSettingsProps<HeaderBlock>) {
  const { config } = block;

  /**
   * config 내 특정 필드 업데이트
   */
  const updateConfig = (updates: Partial<HeaderBlock['config']>) => {
    onUpdate({
      config: { ...config, ...updates },
    } as Partial<HeaderBlock>);
  };

  return (
    <div className="space-y-4">
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

      {/* 설명 */}
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
          onCheckedChange={(checked) => updateConfig({ showBrandName: checked })}
        />
      </div>
    </div>
  );
}
