'use client';

import { usePageConfig, useCurrentChatbot } from '../../hooks/use-console-state';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

/**
 * SEO 설정 폼
 *
 * - 페이지 타이틀: 브라우저 탭에 표시되는 제목
 * - 메타 설명: 검색 결과에 표시되는 설명
 * - OG 이미지: SNS 공유 시 표시되는 미리보기 이미지
 *
 * 검색 결과 미리보기도 함께 제공하여 실제 표시 모습 확인 가능
 */
export function SeoSettings() {
  const { pageConfig, updateSeoConfig } = usePageConfig();
  const { currentChatbot } = useCurrentChatbot();
  const { seo } = pageConfig;

  // 실제 적용될 값 미리보기
  const previewTitle = seo.title || currentChatbot?.name || '페이지 제목';
  const previewDescription =
    seo.description || pageConfig.header.description || '';

  return (
    <div className="space-y-4 pt-2">
      {/* 페이지 타이틀 */}
      <div className="space-y-2">
        <Label htmlFor="seo-title">페이지 타이틀</Label>
        <Input
          id="seo-title"
          placeholder="브라우저 탭에 표시될 제목"
          value={seo.title}
          onChange={(e) => updateSeoConfig({ title: e.target.value })}
        />
        <p className="text-xs text-muted-foreground">
          비워두면 챗봇 이름이 사용됩니다.
        </p>
      </div>

      {/* 메타 설명 */}
      <div className="space-y-2">
        <Label htmlFor="seo-description">메타 설명</Label>
        <Textarea
          id="seo-description"
          placeholder="검색 결과에 표시될 설명"
          value={seo.description || ''}
          onChange={(e) => updateSeoConfig({ description: e.target.value })}
          rows={2}
        />
      </div>

      {/* OG 이미지 */}
      <div className="space-y-2">
        <Label htmlFor="seo-og-image">Open Graph 이미지</Label>
        <Input
          id="seo-og-image"
          type="url"
          placeholder="https://example.com/og-image.png"
          value={seo.ogImage || ''}
          onChange={(e) => updateSeoConfig({ ogImage: e.target.value })}
        />
        <p className="text-xs text-muted-foreground">
          SNS 공유 시 표시될 이미지 (1200x630px 권장)
        </p>
        {seo.ogImage && (
          <img
            src={seo.ogImage}
            alt="OG 이미지 미리보기"
            className="mt-2 h-24 w-full rounded-lg border border-border object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        )}
      </div>

      {/* 검색 결과 미리보기 */}
      <div className="rounded-lg border border-border bg-muted/50 p-3">
        <p className="text-xs font-medium text-muted-foreground">
          검색 결과 미리보기
        </p>
        <div className="mt-2">
          <p className="text-sm font-medium text-primary">{previewTitle}</p>
          <p className="text-xs text-green-600">
            {currentChatbot?.slug
              ? `sofa.example.com/${currentChatbot.slug}`
              : 'sofa.example.com/your-slug'}
          </p>
          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
            {previewDescription || '페이지 설명이 여기에 표시됩니다.'}
          </p>
        </div>
      </div>
    </div>
  );
}
