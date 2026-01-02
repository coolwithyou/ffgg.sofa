# Phase 3: 포탈 관리 UI

> 예상 기간: 4-5일

## 목표

챗봇 설정에서 공개 페이지 활성화 및 커스터마이징 UI 제공

## 선행 조건

- [Phase 1: DB 스키마 및 기반 인프라](./phase-1-db-schema.md) 완료
- [Phase 2: 라우팅 및 공개 페이지 렌더링](./phase-2-routing.md) 완료

## 작업 내용

### 3.1 챗봇 상세 페이지에 탭 추가

**파일**: `app/(portal)/chatbots/[id]/page.tsx`

기존 챗봇 상세 페이지의 탭 목록에 "공개 페이지" 탭을 추가합니다.

```typescript
// 기존 탭 구조에 추가
const tabs = [
  { id: 'overview', label: '개요', icon: Info },
  { id: 'settings', label: '설정', icon: Settings },
  { id: 'dataset', label: '데이터셋', icon: Database },
  { id: 'public-page', label: '공개 페이지', icon: Globe },  // 신규
  { id: 'widget', label: '위젯', icon: Code },
];
```

### 3.2 공개 페이지 설정 컴포넌트

**파일**: `app/(portal)/chatbots/[id]/public-page-settings.tsx` (신규)

```typescript
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useDebounce } from '@/hooks/use-debounce';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ImageUpload } from '@/components/ui/image-upload';
import { ColorPicker } from '@/components/ui/color-picker';
import { PublicPageConfig, DEFAULT_PUBLIC_PAGE_CONFIG } from '@/lib/public-page/types';
import { validateSlug } from '@/lib/public-page/reserved-slugs';
import { toast } from 'sonner';
import { Check, X, Loader2, ExternalLink, Copy } from 'lucide-react';

interface PublicPageSettingsProps {
  chatbotId: string;
  initialSlug?: string;
  initialEnabled: boolean;
  initialConfig: PublicPageConfig;
}

export function PublicPageSettings({
  chatbotId,
  initialSlug,
  initialEnabled,
  initialConfig,
}: PublicPageSettingsProps) {
  // 상태
  const [enabled, setEnabled] = useState(initialEnabled);
  const [slug, setSlug] = useState(initialSlug || '');
  const [config, setConfig] = useState<PublicPageConfig>(
    initialConfig || DEFAULT_PUBLIC_PAGE_CONFIG
  );

  // 슬러그 검증 상태
  const [slugStatus, setSlugStatus] = useState<'idle' | 'checking' | 'available' | 'unavailable'>('idle');
  const [slugError, setSlugError] = useState<string>('');

  // 저장 상태
  const [isSaving, setIsSaving] = useState(false);

  // 디바운스된 슬러그
  const debouncedSlug = useDebounce(slug, 500);

  // 슬러그 가용성 체크
  useEffect(() => {
    if (!debouncedSlug) {
      setSlugStatus('idle');
      setSlugError('');
      return;
    }

    // 로컬 유효성 검사
    const validation = validateSlug(debouncedSlug);
    if (!validation.valid) {
      setSlugStatus('unavailable');
      setSlugError(validation.error || '유효하지 않은 슬러그입니다.');
      return;
    }

    // 서버 중복 체크
    const checkAvailability = async () => {
      setSlugStatus('checking');
      try {
        const res = await fetch(
          `/api/chatbots/check-slug?slug=${debouncedSlug}&excludeId=${chatbotId}`
        );
        const data = await res.json();

        if (data.available) {
          setSlugStatus('available');
          setSlugError('');
        } else {
          setSlugStatus('unavailable');
          setSlugError('이미 사용 중인 슬러그입니다.');
        }
      } catch (error) {
        setSlugStatus('unavailable');
        setSlugError('확인 중 오류가 발생했습니다.');
      }
    };

    checkAvailability();
  }, [debouncedSlug, chatbotId]);

  // 설정 업데이트 헬퍼
  const updateConfig = useCallback(<K extends keyof PublicPageConfig>(
    section: K,
    updates: Partial<PublicPageConfig[K]>
  ) => {
    setConfig(prev => ({
      ...prev,
      [section]: { ...prev[section], ...updates },
    }));
  }, []);

  // 저장
  const handleSave = async () => {
    if (enabled && slugStatus !== 'available' && slug !== initialSlug) {
      toast.error('유효한 슬러그를 설정해주세요.');
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch(`/api/chatbots/${chatbotId}/public-page`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: slug || null,
          publicPageEnabled: enabled,
          publicPageConfig: config,
        }),
      });

      if (!res.ok) throw new Error('저장 실패');

      toast.success('공개 페이지 설정이 저장되었습니다.');
    } catch (error) {
      toast.error('저장 중 오류가 발생했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  // 공개 페이지 URL
  const publicPageUrl = slug
    ? `${window.location.origin}/${slug}`
    : null;

  return (
    <div className="space-y-6">
      {/* 활성화 토글 */}
      <Card>
        <CardHeader>
          <CardTitle>공개 페이지</CardTitle>
          <CardDescription>
            Linktree처럼 독립적인 공개 페이지를 통해 챗봇을 공유할 수 있습니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <Label htmlFor="public-page-enabled">공개 페이지 활성화</Label>
            <Switch
              id="public-page-enabled"
              checked={enabled}
              onCheckedChange={setEnabled}
            />
          </div>
        </CardContent>
      </Card>

      {/* URL 설정 */}
      <Card>
        <CardHeader>
          <CardTitle>URL 설정</CardTitle>
          <CardDescription>
            공개 페이지의 고유 URL을 설정하세요 (3-30자, 영소문자/숫자/하이픈)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground whitespace-nowrap">
              {typeof window !== 'undefined' ? window.location.host : 'sofa.example.com'}/
            </span>
            <div className="relative flex-1">
              <Input
                value={slug}
                onChange={(e) => setSlug(e.target.value.toLowerCase())}
                placeholder="my-chatbot"
                className="pr-10"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                {slugStatus === 'checking' && (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                )}
                {slugStatus === 'available' && (
                  <Check className="h-4 w-4 text-green-500" />
                )}
                {slugStatus === 'unavailable' && (
                  <X className="h-4 w-4 text-destructive" />
                )}
              </div>
            </div>
          </div>
          {slugError && (
            <p className="text-sm text-destructive">{slugError}</p>
          )}
          {publicPageUrl && enabled && slugStatus === 'available' && (
            <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
              <span className="text-sm truncate flex-1">{publicPageUrl}</span>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  navigator.clipboard.writeText(publicPageUrl);
                  toast.success('URL이 복사되었습니다.');
                }}
              >
                <Copy className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                asChild
              >
                <a href={publicPageUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4" />
                </a>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 헤더 설정 */}
      <Card>
        <CardHeader>
          <CardTitle>헤더 설정</CardTitle>
          <CardDescription>
            공개 페이지 상단에 표시될 정보를 설정하세요.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>로고 이미지</Label>
            <ImageUpload
              value={config.header.logoUrl}
              onChange={(url) => updateConfig('header', { logoUrl: url })}
              aspectRatio="square"
            />
          </div>
          <div className="space-y-2">
            <Label>타이틀</Label>
            <Input
              value={config.header.title}
              onChange={(e) => updateConfig('header', { title: e.target.value })}
              placeholder="챗봇 이름"
            />
          </div>
          <div className="space-y-2">
            <Label>설명</Label>
            <Textarea
              value={config.header.description}
              onChange={(e) => updateConfig('header', { description: e.target.value })}
              placeholder="챗봇에 대한 간단한 설명"
              rows={3}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label>브랜드명 표시</Label>
            <Switch
              checked={config.header.showBrandName}
              onCheckedChange={(checked) => updateConfig('header', { showBrandName: checked })}
            />
          </div>
        </CardContent>
      </Card>

      {/* 테마 설정 */}
      <Card>
        <CardHeader>
          <CardTitle>테마 설정</CardTitle>
          <CardDescription>
            공개 페이지의 색상을 커스터마이징하세요.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>배경색</Label>
              <ColorPicker
                value={config.theme.backgroundColor}
                onChange={(color) => updateConfig('theme', { backgroundColor: color })}
              />
            </div>
            <div className="space-y-2">
              <Label>강조색</Label>
              <ColorPicker
                value={config.theme.primaryColor}
                onChange={(color) => updateConfig('theme', { primaryColor: color })}
              />
            </div>
            <div className="space-y-2">
              <Label>텍스트색</Label>
              <ColorPicker
                value={config.theme.textColor}
                onChange={(color) => updateConfig('theme', { textColor: color })}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* SEO 설정 */}
      <Card>
        <CardHeader>
          <CardTitle>SEO 설정</CardTitle>
          <CardDescription>
            검색 엔진과 소셜 미디어에서 표시될 정보를 설정하세요.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>페이지 타이틀</Label>
            <Input
              value={config.seo.title}
              onChange={(e) => updateConfig('seo', { title: e.target.value })}
              placeholder="브라우저 탭에 표시될 제목"
            />
          </div>
          <div className="space-y-2">
            <Label>메타 설명</Label>
            <Textarea
              value={config.seo.description}
              onChange={(e) => updateConfig('seo', { description: e.target.value })}
              placeholder="검색 결과에 표시될 설명"
              rows={2}
            />
          </div>
          <div className="space-y-2">
            <Label>OG 이미지</Label>
            <ImageUpload
              value={config.seo.ogImage}
              onChange={(url) => updateConfig('seo', { ogImage: url })}
              aspectRatio="video"
              hint="권장 크기: 1200x630px"
            />
          </div>
        </CardContent>
      </Card>

      {/* 저장 버튼 */}
      <div className="flex justify-end gap-4">
        <Button
          onClick={handleSave}
          disabled={isSaving || (enabled && !slug)}
        >
          {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          저장
        </Button>
      </div>
    </div>
  );
}
```

### 3.3 슬러그 중복 체크 API

**파일**: `app/api/chatbots/check-slug/route.ts` (신규)

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { chatbots } from '@/drizzle/schema';
import { eq, and, ne } from 'drizzle-orm';
import { validateSlug } from '@/lib/public-page/reserved-slugs';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get('slug');
  const excludeId = searchParams.get('excludeId');

  if (!slug) {
    return NextResponse.json(
      { error: 'slug 파라미터가 필요합니다.' },
      { status: 400 }
    );
  }

  // 로컬 유효성 검사
  const validation = validateSlug(slug);
  if (!validation.valid) {
    return NextResponse.json({
      available: false,
      error: validation.error,
    });
  }

  // DB 중복 체크
  const existing = await db.query.chatbots.findFirst({
    where: excludeId
      ? and(eq(chatbots.slug, slug), ne(chatbots.id, excludeId))
      : eq(chatbots.slug, slug),
    columns: { id: true },
  });

  return NextResponse.json({
    available: !existing,
    error: existing ? '이미 사용 중인 슬러그입니다.' : null,
  });
}
```

### 3.4 공개 페이지 설정 CRUD API

**파일**: `app/api/chatbots/[id]/public-page/route.ts` (신규)

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { chatbots } from '@/drizzle/schema';
import { eq, and, ne } from 'drizzle-orm';
import { getSession } from '@/lib/auth/session';
import { validateSlug } from '@/lib/public-page/reserved-slugs';
import { PublicPageConfig } from '@/lib/public-page/types';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET: 현재 설정 조회
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const session = await getSession();

  if (!session?.tenantId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const chatbot = await db.query.chatbots.findFirst({
    where: and(
      eq(chatbots.id, id),
      eq(chatbots.tenantId, session.tenantId)
    ),
    columns: {
      slug: true,
      publicPageEnabled: true,
      publicPageConfig: true,
    },
  });

  if (!chatbot) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json(chatbot);
}

// PUT: 설정 업데이트
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const session = await getSession();

  if (!session?.tenantId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { slug, publicPageEnabled, publicPageConfig } = body as {
    slug: string | null;
    publicPageEnabled: boolean;
    publicPageConfig: PublicPageConfig;
  };

  // 슬러그 유효성 검사
  if (slug) {
    const validation = validateSlug(slug);
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    // 중복 체크
    const existing = await db.query.chatbots.findFirst({
      where: and(eq(chatbots.slug, slug), ne(chatbots.id, id)),
      columns: { id: true },
    });

    if (existing) {
      return NextResponse.json(
        { error: '이미 사용 중인 슬러그입니다.' },
        { status: 400 }
      );
    }
  }

  // 활성화하려면 슬러그 필수
  if (publicPageEnabled && !slug) {
    return NextResponse.json(
      { error: '공개 페이지를 활성화하려면 슬러그가 필요합니다.' },
      { status: 400 }
    );
  }

  // 업데이트
  await db
    .update(chatbots)
    .set({
      slug: slug || null,
      publicPageEnabled,
      publicPageConfig,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(chatbots.id, id),
        eq(chatbots.tenantId, session.tenantId)
      )
    );

  return NextResponse.json({ success: true });
}
```

## UI 구성

```
공개 페이지 설정 탭
├─ 활성화 토글 (스위치)
│   └─ 설명: Linktree처럼 독립적인 공개 페이지 제공
│
├─ URL 설정
│   ├─ sofa.com/[________] (실시간 입력)
│   ├─ 상태 아이콘 (체크중/사용가능/사용불가)
│   └─ 미리보기 링크 + 복사 버튼
│
├─ 헤더 설정
│   ├─ 로고 업로드 (정사각형, 96x96)
│   ├─ 타이틀 입력
│   ├─ 설명 텍스트 영역
│   └─ 브랜드명 표시 토글
│
├─ 테마 설정
│   ├─ 배경색 피커
│   ├─ 강조색 피커
│   └─ 텍스트색 피커
│
├─ SEO 설정
│   ├─ 페이지 타이틀
│   ├─ 메타 설명
│   └─ OG 이미지 업로드 (1200x630)
│
└─ 저장 버튼
```

## 추가 컴포넌트

### ColorPicker 컴포넌트

**파일**: `components/ui/color-picker.tsx`

```typescript
'use client';

import { useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
}

export function ColorPicker({ value, onChange }: ColorPickerProps) {
  const [isOpen, setIsOpen] = useState(false);

  const presetColors = [
    '#ffffff', '#f3f4f6', '#e5e7eb', '#1f2937', '#111827', '#000000',
    '#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6',
  ];

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="w-full justify-start gap-2"
        >
          <div
            className="h-4 w-4 rounded-sm border border-border"
            style={{ backgroundColor: value }}
          />
          <span className="text-sm font-mono">{value}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64">
        <div className="space-y-3">
          {/* Hex 입력 */}
          <Input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="#000000"
            className="font-mono"
          />

          {/* 컬러 피커 */}
          <input
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-full h-8 cursor-pointer"
          />

          {/* 프리셋 */}
          <div className="grid grid-cols-6 gap-1">
            {presetColors.map((color) => (
              <button
                key={color}
                className="h-6 w-6 rounded-sm border border-border hover:scale-110 transition"
                style={{ backgroundColor: color }}
                onClick={() => {
                  onChange(color);
                  setIsOpen(false);
                }}
              />
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
```

## 테스트 체크리스트

### UI 테스트

- [ ] 공개 페이지 탭 표시
- [ ] 활성화 토글 동작
- [ ] 슬러그 입력 및 실시간 검증
- [ ] 슬러그 중복 체크 (debounce 적용)
- [ ] 색상 피커 동작
- [ ] 이미지 업로드 동작

### API 테스트

- [ ] GET `/api/chatbots/check-slug` - 슬러그 가용성 체크
- [ ] GET `/api/chatbots/[id]/public-page` - 설정 조회
- [ ] PUT `/api/chatbots/[id]/public-page` - 설정 저장
- [ ] 권한 없는 요청 401 반환
- [ ] 존재하지 않는 챗봇 404 반환

### 통합 테스트

- [ ] 설정 저장 후 공개 페이지에 반영
- [ ] 비활성화 후 공개 페이지 404
- [ ] 슬러그 변경 후 새 URL로 접근

## 롤백 절차

1. 챗봇 상세 페이지에서 탭 제거
2. 추가된 컴포넌트 및 API 삭제

```bash
# 롤백 명령
rm app/(portal)/chatbots/[id]/public-page-settings.tsx
rm app/api/chatbots/check-slug/route.ts
rm -rf app/api/chatbots/[id]/public-page
rm components/ui/color-picker.tsx
# 탭 목록에서 수동 제거
```

## 완료 조건

- [ ] 공개 페이지 설정 UI 완성
- [ ] 슬러그 중복 체크 동작
- [ ] 설정 저장/불러오기 동작
- [ ] 기존 기능 정상 동작

## 다음 단계

Phase 3 완료 후 → [Phase 4: 보안 및 Rate Limiting](./phase-4-security.md)
