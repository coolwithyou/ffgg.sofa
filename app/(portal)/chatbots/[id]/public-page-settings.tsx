/**
 * 공개 페이지 설정 컴포넌트
 *
 * Linktree 스타일 공개 페이지 활성화 및 커스터마이징
 * - 슬러그 설정 (실시간 중복 체크)
 * - 헤더 설정 (타이틀, 설명, 로고)
 * - 테마 설정 (배경색, 강조색, 텍스트색)
 * - SEO 설정 (메타 타이틀, 설명)
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Globe,
  Link2,
  Palette,
  Search,
  AlertCircle,
  Check,
  ExternalLink,
  Copy,
  Loader2,
  Image as ImageIcon,
} from 'lucide-react';
import { useToast } from '@/components/ui/toast';
import type { PublicPageConfig } from '@/lib/public-page/types';
import { useDebouncedCallback } from 'use-debounce';

interface PublicPageData {
  enabled: boolean;
  slug: string | null;
  config: PublicPageConfig;
}

interface PublicPageSettingsProps {
  chatbotId: string;
  chatbotName: string;
  hasDatasets: boolean;
  onUpdate: () => void;
}

export function PublicPageSettings({
  chatbotId,
  chatbotName,
  hasDatasets,
  onUpdate,
}: PublicPageSettingsProps) {
  const [data, setData] = useState<PublicPageData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isToggling, setIsToggling] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  // 슬러그 상태
  const [slug, setSlug] = useState('');
  const [slugError, setSlugError] = useState<string | null>(null);
  const [slugAvailable, setSlugAvailable] = useState<boolean | null>(null);
  const [isCheckingSlug, setIsCheckingSlug] = useState(false);

  // 헤더 설정
  const [headerTitle, setHeaderTitle] = useState('');
  const [headerDescription, setHeaderDescription] = useState('');
  const [logoUrl, setLogoUrl] = useState('');

  // 테마 설정
  const [backgroundColor, setBackgroundColor] = useState('#ffffff');
  const [primaryColor, setPrimaryColor] = useState('#3B82F6');
  const [textColor, setTextColor] = useState('#1f2937');

  // SEO 설정
  const [seoTitle, setSeoTitle] = useState('');
  const [seoDescription, setSeoDescription] = useState('');

  const { success, error: showError } = useToast();

  // 데이터 로드
  useEffect(() => {
    fetchPublicPage();
  }, [chatbotId]);

  const fetchPublicPage = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/chatbots/${chatbotId}/public-page`);
      if (response.ok) {
        const result = await response.json();
        setData(result.publicPage);
        initializeForm(result.publicPage);
      }
    } catch (err) {
      console.error('Failed to fetch public page:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const initializeForm = (pageData: PublicPageData) => {
    setSlug(pageData.slug || '');
    setSlugAvailable(pageData.slug ? true : null);

    // 헤더
    setHeaderTitle(pageData.config.header.title || '');
    setHeaderDescription(pageData.config.header.description || '');
    setLogoUrl(pageData.config.header.logoUrl || '');

    // 테마
    setBackgroundColor(pageData.config.theme.backgroundColor || '#ffffff');
    setPrimaryColor(pageData.config.theme.primaryColor || '#3B82F6');
    setTextColor(pageData.config.theme.textColor || '#1f2937');

    // SEO
    setSeoTitle(pageData.config.seo.title || '');
    setSeoDescription(pageData.config.seo.description || '');
  };

  // 슬러그 중복 체크 (디바운스)
  const checkSlugAvailability = useDebouncedCallback(async (value: string) => {
    if (!value || value.length < 3) {
      setSlugAvailable(null);
      return;
    }

    setIsCheckingSlug(true);
    try {
      const response = await fetch(
        `/api/chatbots/check-slug?slug=${encodeURIComponent(value)}&excludeId=${chatbotId}`
      );
      const result = await response.json();

      if (result.valid) {
        setSlugAvailable(result.available);
        setSlugError(result.available ? null : '이미 사용 중인 슬러그입니다.');
      } else {
        setSlugAvailable(false);
        setSlugError(result.error);
      }
    } catch (err) {
      setSlugError('슬러그 확인 중 오류가 발생했습니다.');
    } finally {
      setIsCheckingSlug(false);
    }
  }, 500);

  const handleSlugChange = (value: string) => {
    // 소문자, 숫자, 하이픈만 허용
    const normalized = value.toLowerCase().replace(/[^a-z0-9-]/g, '');
    setSlug(normalized);
    setSlugError(null);
    setSlugAvailable(null);
    checkSlugAvailability(normalized);
  };

  // 활성화 토글
  const handleToggle = async () => {
    if (!data) return;

    // 활성화하려면 슬러그가 필요
    if (!data.enabled && !slug) {
      showError('슬러그 필요', '공개 페이지를 활성화하려면 슬러그를 설정해야 합니다.');
      return;
    }

    if (!data.enabled && slugAvailable === false) {
      showError('슬러그 오류', '사용 가능한 슬러그를 설정해주세요.');
      return;
    }

    setIsToggling(true);
    try {
      const response = await fetch(`/api/chatbots/${chatbotId}/public-page`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !data.enabled, slug }),
      });

      if (response.ok) {
        await fetchPublicPage();
        onUpdate();
        success(
          data.enabled ? '비활성화됨' : '활성화됨',
          data.enabled
            ? '공개 페이지가 비활성화되었습니다.'
            : '공개 페이지가 활성화되었습니다.'
        );
      } else {
        const result = await response.json();
        showError('오류', result.error || '설정을 저장할 수 없습니다.');
      }
    } catch (err) {
      console.error('Toggle error:', err);
      showError('오류', '설정을 저장할 수 없습니다.');
    } finally {
      setIsToggling(false);
    }
  };

  // 설정 저장
  const handleSave = async () => {
    if (slugAvailable === false) {
      showError('슬러그 오류', '사용 가능한 슬러그를 설정해주세요.');
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch(`/api/chatbots/${chatbotId}/public-page`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: slug || null,
          config: {
            header: {
              title: headerTitle,
              description: headerDescription,
              logoUrl: logoUrl || undefined,
              showBrandName: true,
            },
            theme: {
              backgroundColor,
              primaryColor,
              textColor,
            },
            seo: {
              title: seoTitle,
              description: seoDescription,
            },
          },
        }),
      });

      if (response.ok) {
        await fetchPublicPage();
        success('저장 완료', '공개 페이지 설정이 저장되었습니다.');
      } else {
        const result = await response.json();
        showError('저장 실패', result.error || '설정을 저장할 수 없습니다.');
      }
    } catch (err) {
      console.error('Save error:', err);
      showError('저장 실패', '설정을 저장할 수 없습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  // URL 복사
  const handleCopyUrl = async () => {
    if (!slug) return;

    const url = `${window.location.origin}/${slug}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Copy error:', err);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-lg border border-border bg-card p-8 text-center">
        <AlertCircle className="mx-auto h-8 w-8 text-muted-foreground" />
        <p className="mt-2 text-muted-foreground">설정을 불러올 수 없습니다.</p>
      </div>
    );
  }

  const publicPageUrl = slug ? `${typeof window !== 'undefined' ? window.location.origin : ''}/${slug}` : null;

  return (
    <div className="space-y-6">
      {/* 데이터셋 경고 */}
      {!hasDatasets && (
        <div className="flex items-start gap-3 rounded-lg border border-yellow-500/20 bg-yellow-500/10 p-4">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-yellow-500" />
          <div>
            <p className="font-medium text-yellow-500">데이터셋이 없습니다</p>
            <p className="mt-1 text-sm text-yellow-500/80">
              공개 페이지를 활성화하려면 먼저 데이터셋을 연결해주세요.
            </p>
          </div>
        </div>
      )}

      {/* 활성화 카드 */}
      <div className="rounded-lg border border-border bg-card p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div
              className={`flex h-12 w-12 items-center justify-center rounded-full ${
                data.enabled ? 'bg-green-500/10' : 'bg-muted'
              }`}
            >
              <Globe
                className={`h-6 w-6 ${data.enabled ? 'text-green-500' : 'text-muted-foreground'}`}
              />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">공개 페이지</h3>
              <p className="text-sm text-muted-foreground">
                {data.enabled
                  ? '공개 페이지가 활성화되어 있습니다.'
                  : '공개 페이지를 활성화하여 독립 URL로 챗봇을 공유하세요.'}
              </p>
            </div>
          </div>
          <button
            onClick={handleToggle}
            disabled={isToggling || (!data.enabled && !hasDatasets)}
            className={`relative h-7 w-12 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
              data.enabled ? 'bg-green-500' : 'bg-muted'
            }`}
          >
            <span
              className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${
                data.enabled ? 'left-[22px]' : 'left-0.5'
              }`}
            />
          </button>
        </div>

        {/* 공개 URL */}
        {data.enabled && publicPageUrl && (
          <div className="mt-4 flex items-center gap-2 rounded-lg bg-muted p-3">
            <Link2 className="h-4 w-4 text-muted-foreground" />
            <span className="flex-1 truncate text-sm text-foreground">{publicPageUrl}</span>
            <button
              onClick={handleCopyUrl}
              className="rounded p-1.5 text-muted-foreground hover:bg-background hover:text-foreground"
            >
              {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
            </button>
            <a
              href={publicPageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded p-1.5 text-muted-foreground hover:bg-background hover:text-foreground"
            >
              <ExternalLink className="h-4 w-4" />
            </a>
          </div>
        )}
      </div>

      {/* 슬러그 설정 */}
      <div className="rounded-lg border border-border bg-card p-6">
        <h3 className="flex items-center gap-2 font-semibold text-foreground">
          <Link2 className="h-5 w-5" />
          URL 설정
        </h3>
        <div className="mt-4">
          <label className="block text-sm font-medium text-muted-foreground">슬러그</label>
          <div className="mt-1.5 flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {typeof window !== 'undefined' ? window.location.origin : ''}/
            </span>
            <div className="relative flex-1">
              <input
                type="text"
                value={slug}
                onChange={(e) => handleSlugChange(e.target.value)}
                placeholder="my-chatbot"
                className={`w-full rounded-md border bg-background px-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary ${
                  slugError
                    ? 'border-destructive'
                    : slugAvailable === true
                      ? 'border-green-500'
                      : 'border-border'
                }`}
              />
              {isCheckingSlug && (
                <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
              )}
              {!isCheckingSlug && slugAvailable === true && (
                <Check className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-green-500" />
              )}
            </div>
          </div>
          {slugError && <p className="mt-1.5 text-sm text-destructive">{slugError}</p>}
          <p className="mt-1.5 text-xs text-muted-foreground">
            영소문자, 숫자, 하이픈만 사용 가능 (3-30자)
          </p>
        </div>
      </div>

      {/* 헤더 설정 */}
      <div className="rounded-lg border border-border bg-card p-6">
        <h3 className="flex items-center gap-2 font-semibold text-foreground">
          <ImageIcon className="h-5 w-5" />
          헤더 설정
        </h3>
        <div className="mt-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-muted-foreground">타이틀</label>
            <input
              type="text"
              value={headerTitle}
              onChange={(e) => setHeaderTitle(e.target.value)}
              placeholder={chatbotName}
              className="mt-1.5 w-full rounded-md border border-border bg-background px-3 py-2 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-muted-foreground">설명</label>
            <textarea
              value={headerDescription}
              onChange={(e) => setHeaderDescription(e.target.value)}
              placeholder="무엇이든 물어보세요!"
              rows={2}
              className="mt-1.5 w-full rounded-md border border-border bg-background px-3 py-2 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-muted-foreground">로고 URL</label>
            <input
              type="url"
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              placeholder="https://example.com/logo.png"
              className="mt-1.5 w-full rounded-md border border-border bg-background px-3 py-2 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              권장 크기: 200x200px (정사각형)
            </p>
          </div>
        </div>
      </div>

      {/* 테마 설정 */}
      <div className="rounded-lg border border-border bg-card p-6">
        <h3 className="flex items-center gap-2 font-semibold text-foreground">
          <Palette className="h-5 w-5" />
          테마 설정
        </h3>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <div>
            <label className="block text-sm font-medium text-muted-foreground">배경색</label>
            <div className="mt-1.5 flex items-center gap-2">
              <input
                type="color"
                value={backgroundColor}
                onChange={(e) => setBackgroundColor(e.target.value)}
                className="h-10 w-10 cursor-pointer rounded border border-border"
              />
              <input
                type="text"
                value={backgroundColor}
                onChange={(e) => setBackgroundColor(e.target.value)}
                className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-muted-foreground">강조색</label>
            <div className="mt-1.5 flex items-center gap-2">
              <input
                type="color"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                className="h-10 w-10 cursor-pointer rounded border border-border"
              />
              <input
                type="text"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-muted-foreground">텍스트색</label>
            <div className="mt-1.5 flex items-center gap-2">
              <input
                type="color"
                value={textColor}
                onChange={(e) => setTextColor(e.target.value)}
                className="h-10 w-10 cursor-pointer rounded border border-border"
              />
              <input
                type="text"
                value={textColor}
                onChange={(e) => setTextColor(e.target.value)}
                className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
              />
            </div>
          </div>
        </div>
      </div>

      {/* SEO 설정 */}
      <div className="rounded-lg border border-border bg-card p-6">
        <h3 className="flex items-center gap-2 font-semibold text-foreground">
          <Search className="h-5 w-5" />
          SEO 설정
        </h3>
        <div className="mt-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-muted-foreground">
              페이지 타이틀
            </label>
            <input
              type="text"
              value={seoTitle}
              onChange={(e) => setSeoTitle(e.target.value)}
              placeholder={headerTitle || chatbotName}
              className="mt-1.5 w-full rounded-md border border-border bg-background px-3 py-2 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              브라우저 탭과 검색 결과에 표시됩니다.
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-muted-foreground">
              메타 설명
            </label>
            <textarea
              value={seoDescription}
              onChange={(e) => setSeoDescription(e.target.value)}
              placeholder="검색 결과에 표시될 설명을 입력하세요."
              rows={2}
              className="mt-1.5 w-full rounded-md border border-border bg-background px-3 py-2 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>
      </div>

      {/* 저장 버튼 */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={isSaving || slugAvailable === false}
          className="flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5 font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSaving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              저장 중...
            </>
          ) : (
            '설정 저장'
          )}
        </button>
      </div>
    </div>
  );
}
