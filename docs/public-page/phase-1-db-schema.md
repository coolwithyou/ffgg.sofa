# Phase 1: DB 스키마 및 기반 인프라

> 예상 기간: 2-3일

## 목표

챗봇 테이블에 슬러그 필드 추가 및 공개 페이지 설정 구조 정의

## 작업 내용

### 1.1 DB 스키마 수정

**파일**: `drizzle/schema.ts`

chatbots 테이블에 다음 필드를 추가합니다:

```typescript
// chatbots 테이블에 추가
slug: text('slug').unique(),                    // 공개 URL 슬러그 (3-30자, 영소문자/숫자/하이픈)
publicPageEnabled: boolean('public_page_enabled').default(false),
publicPageConfig: jsonb('public_page_config').default({
  header: {
    title: '',
    description: '',
    logoUrl: '',
    showBrandName: true,
  },
  theme: {
    backgroundColor: '#ffffff',
    primaryColor: '#3B82F6',
    textColor: '#1f2937',
  },
  seo: {
    title: '',
    description: '',
    ogImage: '',
  },
}),
```

#### 필드 설명

| 필드 | 타입 | 설명 |
|------|------|------|
| `slug` | text (unique) | URL에서 사용되는 고유 식별자. 3-30자, 영소문자/숫자/하이픈만 허용 |
| `publicPageEnabled` | boolean | 공개 페이지 활성화 여부 (기본값: false) |
| `publicPageConfig` | jsonb | 헤더, 테마, SEO 설정을 담는 JSON 객체 |

### 1.2 타입 정의

**파일**: `lib/public-page/types.ts` (신규)

```typescript
/**
 * 공개 페이지 전체 설정
 */
export interface PublicPageConfig {
  header: HeaderConfig;
  theme: ThemeConfig;
  seo: SEOConfig;
}

/**
 * 헤더 블록 설정
 */
export interface HeaderConfig {
  /** 표시될 제목 */
  title: string;
  /** 부제목/설명 */
  description: string;
  /** 로고 이미지 URL */
  logoUrl?: string;
  /** 브랜드명 표시 여부 */
  showBrandName: boolean;
}

/**
 * 테마 설정
 */
export interface ThemeConfig {
  /** 배경색 (hex) */
  backgroundColor: string;
  /** 주요 강조색 (hex) */
  primaryColor: string;
  /** 텍스트색 (hex) */
  textColor: string;
  /** 폰트 패밀리 (선택) */
  fontFamily?: string;
}

/**
 * SEO 메타 설정
 */
export interface SEOConfig {
  /** 페이지 타이틀 (브라우저 탭) */
  title: string;
  /** 메타 설명 */
  description?: string;
  /** Open Graph 이미지 URL */
  ogImage?: string;
}

/**
 * 기본 공개 페이지 설정
 */
export const DEFAULT_PUBLIC_PAGE_CONFIG: PublicPageConfig = {
  header: {
    title: '',
    description: '',
    logoUrl: '',
    showBrandName: true,
  },
  theme: {
    backgroundColor: '#ffffff',
    primaryColor: '#3B82F6',
    textColor: '#1f2937',
  },
  seo: {
    title: '',
    description: '',
    ogImage: '',
  },
};
```

### 1.3 예약어 목록

**파일**: `lib/public-page/reserved-slugs.ts` (신규)

```typescript
/**
 * 슬러그로 사용할 수 없는 예약어 목록
 * 시스템 라우트, 공개 페이지, 일반 예약어를 포함
 */
export const RESERVED_SLUGS = new Set([
  // 시스템 라우트
  'admin', 'api', 'widget', 'login', 'signup', 'logout',
  'dashboard', 'chatbots', 'datasets', 'documents', 'settings',
  'mypage', 'faq-builder', 'review', 'library', 'widgets',

  // 공개 페이지
  'demo', 'privacy', 'terms', 'forgot-password', 'reset-password',
  'verify-email', 'verify-email-change', 'change-password',

  // 일반 예약어
  'about', 'help', 'support', 'contact', 'blog', 'pricing',
  'features', 'docs', 'status', 'home', 'index', 'app',

  // 특수 경로
  '_next', 'static', 'public', 'assets', 'images', 'favicon',
]);

/**
 * 예약어 여부 확인
 */
export function isReservedSlug(slug: string): boolean {
  return RESERVED_SLUGS.has(slug.toLowerCase());
}

/**
 * 슬러그 유효성 검사 결과
 */
export interface SlugValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * 슬러그 유효성 검사
 *
 * 규칙:
 * - 3-30자 길이
 * - 영소문자, 숫자, 하이픈만 허용
 * - 시작과 끝은 영소문자 또는 숫자
 * - 예약어 사용 불가
 */
export function validateSlug(slug: string): SlugValidationResult {
  // 길이 검사
  if (!slug || slug.length < 3) {
    return { valid: false, error: '슬러그는 최소 3자 이상이어야 합니다.' };
  }
  if (slug.length > 30) {
    return { valid: false, error: '슬러그는 최대 30자까지 가능합니다.' };
  }

  // 문자 패턴 검사
  if (!/^[a-z0-9]/.test(slug)) {
    return { valid: false, error: '슬러그는 영소문자 또는 숫자로 시작해야 합니다.' };
  }
  if (!/[a-z0-9]$/.test(slug)) {
    return { valid: false, error: '슬러그는 영소문자 또는 숫자로 끝나야 합니다.' };
  }
  if (!/^[a-z0-9-]+$/.test(slug)) {
    return { valid: false, error: '슬러그는 영소문자, 숫자, 하이픈만 사용할 수 있습니다.' };
  }

  // 연속 하이픈 검사
  if (/--/.test(slug)) {
    return { valid: false, error: '연속된 하이픈은 사용할 수 없습니다.' };
  }

  // 예약어 검사
  if (isReservedSlug(slug)) {
    return { valid: false, error: '이 슬러그는 시스템에서 사용 중입니다.' };
  }

  return { valid: true };
}

/**
 * 슬러그 정규화 (권장 형식으로 변환)
 */
export function normalizeSlug(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')       // 공백을 하이픈으로
    .replace(/[^a-z0-9-]/g, '') // 허용되지 않는 문자 제거
    .replace(/-+/g, '-')        // 연속 하이픈 정리
    .replace(/^-|-$/g, '');     // 시작/끝 하이픈 제거
}
```

## 마이그레이션

### 마이그레이션 생성 및 실행

```bash
# 마이그레이션 파일 생성
pnpm drizzle-kit generate

# 마이그레이션 실행
pnpm drizzle-kit migrate
```

### 예상 마이그레이션 SQL

```sql
ALTER TABLE chatbots
ADD COLUMN slug TEXT UNIQUE,
ADD COLUMN public_page_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN public_page_config JSONB DEFAULT '{
  "header": {
    "title": "",
    "description": "",
    "logoUrl": "",
    "showBrandName": true
  },
  "theme": {
    "backgroundColor": "#ffffff",
    "primaryColor": "#3B82F6",
    "textColor": "#1f2937"
  },
  "seo": {
    "title": "",
    "description": "",
    "ogImage": ""
  }
}'::jsonb;

-- 슬러그 검색을 위한 인덱스
CREATE INDEX idx_chatbots_slug ON chatbots(slug) WHERE slug IS NOT NULL;

-- 공개 페이지 활성화된 챗봇 조회를 위한 인덱스
CREATE INDEX idx_chatbots_public_page ON chatbots(slug, public_page_enabled)
WHERE public_page_enabled = TRUE;
```

## 테스트 체크리스트

### 단위 테스트

- [ ] `validateSlug()` - 유효한 슬러그 통과
- [ ] `validateSlug()` - 길이 제한 (3-30자) 검증
- [ ] `validateSlug()` - 허용 문자 (a-z, 0-9, -) 검증
- [ ] `validateSlug()` - 시작/끝 문자 검증
- [ ] `validateSlug()` - 연속 하이픈 거부
- [ ] `isReservedSlug()` - 예약어 차단
- [ ] `normalizeSlug()` - 입력 정규화

### 통합 테스트

- [ ] DB 마이그레이션 성공
- [ ] 기존 chatbots 데이터 무결성 유지
- [ ] slug 유니크 제약 조건 동작

### 테스트 코드 예시

```typescript
// __tests__/lib/public-page/reserved-slugs.test.ts
import { validateSlug, isReservedSlug, normalizeSlug } from '@/lib/public-page/reserved-slugs';

describe('validateSlug', () => {
  it('유효한 슬러그를 통과시킨다', () => {
    expect(validateSlug('my-chatbot').valid).toBe(true);
    expect(validateSlug('bot123').valid).toBe(true);
    expect(validateSlug('abc').valid).toBe(true);
  });

  it('너무 짧은 슬러그를 거부한다', () => {
    expect(validateSlug('ab').valid).toBe(false);
    expect(validateSlug('a').valid).toBe(false);
  });

  it('너무 긴 슬러그를 거부한다', () => {
    expect(validateSlug('a'.repeat(31)).valid).toBe(false);
  });

  it('대문자가 포함된 슬러그를 거부한다', () => {
    expect(validateSlug('MyBot').valid).toBe(false);
  });

  it('예약어를 거부한다', () => {
    expect(validateSlug('admin').valid).toBe(false);
    expect(validateSlug('api').valid).toBe(false);
  });
});

describe('normalizeSlug', () => {
  it('공백을 하이픈으로 변환한다', () => {
    expect(normalizeSlug('my chatbot')).toBe('my-chatbot');
  });

  it('대문자를 소문자로 변환한다', () => {
    expect(normalizeSlug('MyBot')).toBe('mybot');
  });
});
```

## 롤백 절차

문제 발생 시 다음 SQL로 롤백:

```sql
-- 인덱스 삭제
DROP INDEX IF EXISTS idx_chatbots_slug;
DROP INDEX IF EXISTS idx_chatbots_public_page;

-- 컬럼 삭제
ALTER TABLE chatbots
DROP COLUMN IF EXISTS slug,
DROP COLUMN IF EXISTS public_page_enabled,
DROP COLUMN IF EXISTS public_page_config;
```

## 완료 조건

- [ ] chatbots 테이블에 3개 필드 추가 완료
- [ ] 타입 정의 파일 생성
- [ ] 예약어 검증 유틸리티 생성
- [ ] 마이그레이션 성공
- [ ] 단위 테스트 통과
- [ ] 기존 기능 정상 동작 확인

## 다음 단계

Phase 1 완료 후 → [Phase 2: 라우팅 및 공개 페이지 렌더링](./phase-2-routing.md)
