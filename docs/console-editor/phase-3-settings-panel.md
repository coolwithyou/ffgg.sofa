# Phase 3: Settings Panel - 헤더/테마/SEO 설정

> 우측 패널에 직관적인 설정 폼을 구현하여 실시간 프리뷰 연동을 완성합니다.

## 개요

### 목표
- 헤더 설정 폼 (제목, 설명, 로고, 브랜드명 표시)
- 테마 설정 폼 (배경색, 주요색, 텍스트색)
- SEO 설정 폼 (페이지 타이틀, 메타 설명, OG 이미지)
- 아코디언 UI로 섹션별 접기/펼치기

### 의존성
- **Phase 1**: ConsoleContext, updatePageConfig 액션
- **Phase 2**: 프리뷰 실시간 반영

### 다음 Phase 준비
- Phase 5: 설정 변경 시 자동 저장 연동

---

## 전체 맥락에서의 역할

```
┌─────────────────────────────────────────────────────────────────┐
│                   Phase 3: Settings Panel                        │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                    right-settings.tsx                      │  │
│  │  ┌─────────────────────────────────────────────────────┐  │  │
│  │  │ [▼] 헤더 설정                                        │  │  │
│  │  │   ┌─────────────────────────────────────────────┐   │  │  │
│  │  │   │ header-settings.tsx                         │   │  │  │
│  │  │   │ - 제목 입력                                  │   │  │  │
│  │  │   │ - 설명 입력                                  │   │  │  │
│  │  │   │ - 로고 URL                                   │   │  │  │
│  │  │   │ - 브랜드명 표시 토글                          │   │  │  │
│  │  │   └─────────────────────────────────────────────┘   │  │  │
│  │  └─────────────────────────────────────────────────────┘  │  │
│  │  ┌─────────────────────────────────────────────────────┐  │  │
│  │  │ [▼] 테마 설정                                        │  │  │
│  │  │   ┌─────────────────────────────────────────────┐   │  │  │
│  │  │   │ theme-settings.tsx                          │   │  │  │
│  │  │   │ - 배경색 선택                                 │   │  │  │
│  │  │   │ - 주요색 선택                                 │   │  │  │
│  │  │   │ - 텍스트색 선택                               │   │  │  │
│  │  │   └─────────────────────────────────────────────┘   │  │  │
│  │  └─────────────────────────────────────────────────────┘  │  │
│  │  ┌─────────────────────────────────────────────────────┐  │  │
│  │  │ [▶] SEO 설정 (접힌 상태)                             │  │  │
│  │  └─────────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  데이터 흐름:                                                    │
│  Input 변경 → updateHeaderConfig() → Context 업데이트            │
│              → Phase 2 프리뷰 자동 반영                          │
│              → Phase 5 자동 저장 트리거                          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 구현 상세

### 1. RightSettings 업데이트

**파일**: `app/(console)/console/components/right-settings.tsx`

```typescript
'use client';

import { useConsoleMode, useCurrentChatbot } from '../hooks/use-console-state';
import { HeaderSettings } from './settings/header-settings';
import { ThemeSettings } from './settings/theme-settings';
import { SeoSettings } from './settings/seo-settings';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { FileText, Palette, Search } from 'lucide-react';

export function RightSettings() {
  const { mode } = useConsoleMode();
  const { currentChatbot } = useCurrentChatbot();

  if (!currentChatbot) {
    return (
      <aside className="flex w-80 items-center justify-center border-l border-border bg-card">
        <p className="text-sm text-muted-foreground">챗봇을 선택해주세요</p>
      </aside>
    );
  }

  // Widget 모드는 Phase 6에서 구현
  if (mode === 'widget') {
    return (
      <aside className="w-80 border-l border-border bg-card p-4">
        <h2 className="text-lg font-semibold text-foreground">위젯 설정</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          위젯 설정은 Phase 6에서 구현됩니다.
        </p>
      </aside>
    );
  }

  return (
    <aside className="w-80 overflow-y-auto border-l border-border bg-card">
      {/* 헤더 */}
      <div className="border-b border-border p-4">
        <h2 className="text-lg font-semibold text-foreground">페이지 설정</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {currentChatbot.name}의 공개 페이지를 커스터마이징하세요.
        </p>
      </div>

      {/* 설정 아코디언 */}
      <Accordion
        type="multiple"
        defaultValue={['header', 'theme']}
        className="p-4"
      >
        {/* 헤더 설정 */}
        <AccordionItem value="header" className="border-border">
          <AccordionTrigger className="hover:no-underline">
            <span className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              헤더 설정
            </span>
          </AccordionTrigger>
          <AccordionContent>
            <HeaderSettings />
          </AccordionContent>
        </AccordionItem>

        {/* 테마 설정 */}
        <AccordionItem value="theme" className="border-border">
          <AccordionTrigger className="hover:no-underline">
            <span className="flex items-center gap-2">
              <Palette className="h-4 w-4 text-muted-foreground" />
              테마 설정
            </span>
          </AccordionTrigger>
          <AccordionContent>
            <ThemeSettings />
          </AccordionContent>
        </AccordionItem>

        {/* SEO 설정 */}
        <AccordionItem value="seo" className="border-border">
          <AccordionTrigger className="hover:no-underline">
            <span className="flex items-center gap-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              SEO 설정
            </span>
          </AccordionTrigger>
          <AccordionContent>
            <SeoSettings />
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </aside>
  );
}
```

---

### 2. HeaderSettings 컴포넌트

**파일**: `app/(console)/console/components/settings/header-settings.tsx`

```typescript
'use client';

import { usePageConfig } from '../../hooks/use-console-state';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';

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
            하단에 "Powered by SOFA" 표시
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
```

---

### 3. ThemeSettings 컴포넌트

**파일**: `app/(console)/console/components/settings/theme-settings.tsx`

```typescript
'use client';

import { usePageConfig } from '../../hooks/use-console-state';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

// 프리셋 색상 팔레트
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

      {/* 폰트 선택 (선택사항) */}
      <div className="space-y-2">
        <Label htmlFor="font-family">폰트</Label>
        <select
          id="font-family"
          value={theme.fontFamily || ''}
          onChange={(e) => updateThemeConfig({ fontFamily: e.target.value || undefined })}
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
```

---

### 4. SeoSettings 컴포넌트

**파일**: `app/(console)/console/components/settings/seo-settings.tsx`

```typescript
'use client';

import { usePageConfig, useCurrentChatbot } from '../../hooks/use-console-state';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

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

      {/* 미리보기 */}
      <div className="rounded-lg border border-border bg-muted/50 p-3">
        <p className="text-xs font-medium text-muted-foreground">검색 결과 미리보기</p>
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
```

---

### 5. Zod 폼 검증 스키마

**파일**: `app/(console)/console/lib/validation.ts`

```typescript
import { z } from 'zod';

/**
 * URL 검증 유틸리티
 * 빈 문자열도 허용 (선택적 필드용)
 */
const optionalUrl = z.string().refine(
  (val) => val === '' || z.string().url().safeParse(val).success,
  { message: '올바른 URL 형식이 아닙니다' }
);

/**
 * HEX 색상 검증
 */
const hexColor = z.string().regex(
  /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/,
  { message: '올바른 HEX 색상 코드를 입력하세요 (예: #FF5500)' }
);

/**
 * 헤더 설정 스키마
 */
export const headerConfigSchema = z.object({
  title: z
    .string()
    .max(100, '제목은 100자를 초과할 수 없습니다')
    .optional(),
  description: z
    .string()
    .max(500, '설명은 500자를 초과할 수 없습니다')
    .optional(),
  logoUrl: optionalUrl.optional(),
  showBrandName: z.boolean().optional(),
});

/**
 * 테마 설정 스키마
 */
export const themeConfigSchema = z.object({
  backgroundColor: hexColor,
  primaryColor: hexColor,
  textColor: hexColor,
  fontFamily: z.string().optional(),
});

/**
 * SEO 설정 스키마
 */
export const seoConfigSchema = z.object({
  title: z
    .string()
    .max(60, 'SEO 타이틀은 60자 이하가 권장됩니다')
    .optional(),
  description: z
    .string()
    .max(160, '메타 설명은 160자 이하가 권장됩니다')
    .optional(),
  ogImage: optionalUrl.optional(),
});

/**
 * 전체 페이지 설정 스키마
 */
export const pageConfigSchema = z.object({
  header: headerConfigSchema,
  theme: themeConfigSchema,
  seo: seoConfigSchema,
});

// 타입 추론
export type HeaderConfigInput = z.infer<typeof headerConfigSchema>;
export type ThemeConfigInput = z.infer<typeof themeConfigSchema>;
export type SeoConfigInput = z.infer<typeof seoConfigSchema>;
export type PageConfigInput = z.infer<typeof pageConfigSchema>;
```

---

### 6. 검증 에러 표시 컴포넌트

**파일**: `app/(console)/console/components/ui/field-error.tsx`

```typescript
import { AlertCircle } from 'lucide-react';

interface FieldErrorProps {
  error?: string | null;
}

/**
 * 필드 검증 에러 표시
 */
export function FieldError({ error }: FieldErrorProps) {
  if (!error) return null;

  return (
    <p className="flex items-center gap-1 text-xs text-destructive">
      <AlertCircle className="h-3 w-3" />
      {error}
    </p>
  );
}
```

---

### 7. 검증 통합 훅

**파일**: `app/(console)/console/hooks/use-validated-input.ts`

```typescript
import { useState, useCallback } from 'react';
import type { z } from 'zod';

interface UseValidatedInputOptions<T> {
  schema: z.ZodType<T>;
  onValidChange: (value: T) => void;
  validateOnBlur?: boolean;  // blur 시에만 검증 (기본: 입력마다)
}

/**
 * 검증이 포함된 입력 훅
 *
 * 사용 예:
 * const { value, error, handleChange, handleBlur } = useValidatedInput({
 *   schema: headerConfigSchema.shape.title,
 *   onValidChange: (val) => updateHeaderConfig({ title: val }),
 * });
 */
export function useValidatedInput<T>({
  schema,
  onValidChange,
  validateOnBlur = false,
}: UseValidatedInputOptions<T>) {
  const [localValue, setLocalValue] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const validate = useCallback(
    (value: string) => {
      const result = schema.safeParse(value);
      if (result.success) {
        setError(null);
        onValidChange(result.data);
        return true;
      } else {
        setError(result.error.errors[0]?.message || '유효하지 않은 값입니다');
        return false;
      }
    },
    [schema, onValidChange]
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const newValue = e.target.value;
      setLocalValue(newValue);

      if (!validateOnBlur) {
        validate(newValue);
      }
    },
    [validate, validateOnBlur]
  );

  const handleBlur = useCallback(() => {
    if (validateOnBlur) {
      validate(localValue);
    }
  }, [validate, validateOnBlur, localValue]);

  return {
    value: localValue,
    error,
    handleChange,
    handleBlur,
    setLocalValue,
    clearError: () => setError(null),
  };
}
```

---

### 8. HeaderSettings에 검증 적용 예시

```typescript
'use client';

import { usePageConfig } from '../../hooks/use-console-state';
import { headerConfigSchema } from '../../lib/validation';
import { FieldError } from '../ui/field-error';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { useState, useCallback } from 'react';

export function HeaderSettings() {
  const { pageConfig, updateHeaderConfig } = usePageConfig();
  const { header } = pageConfig;

  // 개별 필드 에러 상태
  const [errors, setErrors] = useState<Record<string, string | null>>({});

  // 필드 검증 함수
  const validateField = useCallback(
    <K extends keyof typeof header>(field: K, value: (typeof header)[K]) => {
      const fieldSchema = headerConfigSchema.shape[field];
      const result = fieldSchema.safeParse(value);

      setErrors((prev) => ({
        ...prev,
        [field]: result.success ? null : result.error.errors[0]?.message,
      }));

      return result.success;
    },
    []
  );

  // 변경 핸들러 (검증 후 Context 업데이트)
  const handleChange = useCallback(
    <K extends keyof typeof header>(field: K, value: (typeof header)[K]) => {
      // 항상 로컬 상태 업데이트 (UX: 타이핑 즉시 반영)
      updateHeaderConfig({ [field]: value });

      // 비동기 검증 (에러 표시용)
      validateField(field, value);
    },
    [updateHeaderConfig, validateField]
  );

  return (
    <div className="space-y-4 pt-2">
      {/* 제목 */}
      <div className="space-y-2">
        <Label htmlFor="header-title">제목</Label>
        <Input
          id="header-title"
          placeholder="페이지 제목을 입력하세요"
          value={header.title}
          onChange={(e) => handleChange('title', e.target.value)}
          className={errors.title ? 'border-destructive' : ''}
        />
        <FieldError error={errors.title} />
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
          onChange={(e) => handleChange('description', e.target.value)}
          className={errors.description ? 'border-destructive' : ''}
          rows={3}
        />
        <FieldError error={errors.description} />
      </div>

      {/* 로고 URL */}
      <div className="space-y-2">
        <Label htmlFor="header-logo">로고 이미지 URL</Label>
        <Input
          id="header-logo"
          type="url"
          placeholder="https://example.com/logo.png"
          value={header.logoUrl || ''}
          onChange={(e) => handleChange('logoUrl', e.target.value || undefined)}
          className={errors.logoUrl ? 'border-destructive' : ''}
        />
        <FieldError error={errors.logoUrl} />
        {header.logoUrl && !errors.logoUrl && (
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

      {/* 브랜드명 표시 (boolean은 검증 불필요) */}
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label htmlFor="show-brand">브랜드명 표시</Label>
          <p className="text-xs text-muted-foreground">
            하단에 "Powered by SOFA" 표시
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
```

---

### 9. 검증 전략 가이드

#### 실시간 검증 vs Blur 검증

| 전략 | 사용 시점 | 장점 | 단점 |
|------|----------|------|------|
| **실시간** | 색상, 숫자 필드 | 즉각적 피드백 | 타이핑 중 산만함 |
| **Blur** | 텍스트, URL 필드 | 방해 없는 입력 | 늦은 피드백 |
| **Submit** | 저장 버튼 클릭 시 | 자연스러운 흐름 | 모아서 에러 표시 |

#### 권장 설정

```typescript
// 헤더 설정
const HEADER_VALIDATION_CONFIG = {
  title: { validateOnBlur: true },      // 텍스트 → blur 시
  description: { validateOnBlur: true },
  logoUrl: { validateOnBlur: true },    // URL → blur 시
  showBrandName: { skipValidation: true }, // boolean → 검증 불필요
};

// 테마 설정
const THEME_VALIDATION_CONFIG = {
  backgroundColor: { validateOnChange: true }, // 색상 → 즉시 검증
  primaryColor: { validateOnChange: true },
  textColor: { validateOnChange: true },
  fontFamily: { skipValidation: true },
};
```

---

### 10. 필요한 UI 컴포넌트 확인

다음 shadcn/ui 컴포넌트 및 라이브러리가 필요합니다:

```bash
# shadcn/ui 컴포넌트 (이미 있는지 확인 후 없으면 설치)
pnpm dlx shadcn@latest add accordion
pnpm dlx shadcn@latest add switch
pnpm dlx shadcn@latest add textarea

# Zod 설치 (검증 라이브러리)
pnpm add zod
```

---

## 완료 체크리스트

### 필수
- [ ] `right-settings.tsx` 업데이트 (Accordion 구조)
- [ ] `settings/header-settings.tsx` 생성
- [ ] `settings/theme-settings.tsx` 생성
- [ ] `settings/seo-settings.tsx` 생성
- [ ] 필요한 shadcn/ui 컴포넌트 설치 (accordion, switch, textarea)

### 검증
- [ ] 각 설정 폼 정상 렌더링
- [ ] 입력 변경 시 Context 업데이트
- [ ] Context 변경 시 프리뷰(Phase 2) 즉시 반영
- [ ] 색상 선택기 동작 확인
- [ ] 아코디언 접기/펼치기 동작

---

## 다음 Phase 연결점

### Phase 5 (Auto-Save)에서 확장
- 설정 변경 → Context 업데이트 → Debounced API 호출
- `use-auto-save.tsx` 훅에서 `pageConfig` 변경 감지

---

## UX 가이드라인

### 입력 필드 원칙
1. **즉시 반영**: 타이핑하는 즉시 프리뷰에 반영
2. **플레이스홀더**: 비워둘 경우 기본값 안내
3. **도움말**: 각 필드 아래에 짧은 설명 제공

### 색상 선택기 원칙
1. **프리셋 우선**: 자주 사용되는 색상 프리셋 제공
2. **커스텀 가능**: 프리셋 외에도 직접 색상 입력 가능
3. **시각적 피드백**: 선택된 색상 하이라이트

### 아코디언 원칙
1. **기본 펼침**: 헤더, 테마는 기본으로 펼쳐진 상태
2. **SEO 접힘**: 덜 자주 사용하는 SEO는 기본 접힘
3. **상태 유지**: 스크롤해도 접기/펼치기 상태 유지
