'use client';

import { usePageConfig } from '../../hooks/use-console-state';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';

/**
 * 헤더 설정 폼
 *
 * - 제목: 페이지 상단에 표시될 제목
 * - 설명: 페이지 소개 문구
 * - 로고 URL: 커스텀 로고 이미지
 * - 브랜드명 표시: "Powered by SOFA" 토글
 */
export function HeaderSettings() {
  const { pageConfig, updateHeaderConfig } = usePageConfig();
  const { header } = pageConfig;

  return (
    <div className="space-y-4 pt-2">
      {/* 제목 */}
      <div className="space-y-2">
        <Label htmlFor="header-title">제목</Label>
        <Input
          id="header-title"
          placeholder="페이지 제목을 입력하세요"
          value={header.title}
          onChange={(e) => updateHeaderConfig({ title: e.target.value })}
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
          value={header.description}
          onChange={(e) => updateHeaderConfig({ description: e.target.value })}
          rows={3}
        />
      </div>

      {/* 로고 URL */}
      <div className="space-y-2">
        <Label htmlFor="header-logo">로고 이미지 URL</Label>
        <Input
          id="header-logo"
          type="url"
          placeholder="https://example.com/logo.png"
          value={header.logoUrl || ''}
          onChange={(e) => updateHeaderConfig({ logoUrl: e.target.value })}
        />
        {header.logoUrl && (
          <div className="mt-2 flex items-center gap-2">
            <img
              src={header.logoUrl}
              alt="로고 미리보기"
              className="h-10 w-10 rounded-lg object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
            <span className="text-xs text-muted-foreground">미리보기</span>
          </div>
        )}
      </div>

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
          checked={header.showBrandName}
          onCheckedChange={(checked) =>
            updateHeaderConfig({ showBrandName: checked })
          }
        />
      </div>
    </div>
  );
}
