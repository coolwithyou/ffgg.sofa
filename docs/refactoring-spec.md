# faq.guide 리팩토링 설계 문서

**프로젝트**: SOFA → faq.guide 리팩토링
**목표**: 기존 베타 수준 기능 유지하면서 브랜딩/용어/UI 변경
**예상 기간**: 4-5주

---

## 1. 리팩토링 개요

### 변경하는 것
- 서비스명: SOFA → faq.guide
- 용어 체계: Dataset/Chunk → Guidebook/Page
- 폴더 구조: (console) → (studio)
- UI/디자인: 새 디자인 시스템 적용
- 불필요한 기능 제거

### 유지하는 것
- 인증: 이메일/비밀번호, 카카오 OAuth, 구글 OAuth
- 결제: PortOne 연동
- 이메일: Resend
- 핵심 로직: 파싱, RAG, 채팅, 임베딩
- 백그라운드: Inngest
- 위젯 임베드

---

## 2. 용어 변경 매핑

### 코드 용어
| 기존 | 신규 | 영향 범위 |
|------|------|----------|
| `tenant` | `company` | DB, 타입, API |
| `chatbot` | `guide` | DB, 타입, API, UI |
| `dataset` | `guidebook` | DB, 타입, API, UI |
| `chunk` | `page` | DB, 타입, API |
| `console` | `studio` | 폴더명, 라우트 |

### UI 용어
| 기존 | 신규 |
|------|------|
| 콘솔 | 스튜디오 |
| 데이터셋 | 가이드북 |
| 청크 | 페이지 |
| 챗봇 | 가이드 |

### 변경 스크립트 예시
```bash
# 파일명 변경
mv app/(console) app/(studio)
mv lib/datasets lib/guidebook

# 코드 내용 변경 (예시)
find . -type f -name "*.ts" -o -name "*.tsx" | xargs sed -i '' 's/dataset/guidebook/g'
find . -type f -name "*.ts" -o -name "*.tsx" | xargs sed -i '' 's/Dataset/Guidebook/g'
find . -type f -name "*.ts" -o -name "*.tsx" | xargs sed -i '' 's/chunk/page/g'
find . -type f -name "*.ts" -o -name "*.tsx" | xargs sed -i '' 's/Chunk/Page/g'
```

> ⚠️ 주의: 단순 치환 시 의도치 않은 변경 발생 가능. 파일별 검토 필요.

---

## 3. 폴더 구조 변경

### Before (현재)
```
app/
├── (auth)/
├── (console)/
│   └── console/
│       ├── dashboard/
│       ├── chatbot/
│       │   ├── datasets/
│       │   ├── faq/
│       │   └── settings/
│       ├── widget/
│       ├── account/
│       └── page/
├── [slug]/
├── admin/
├── api/
└── widget/
```

### After (목표)
```
app/
├── (auth)/                    # 유지
├── (studio)/                  # 이름 변경
│   └── studio/
│       ├── page.tsx           # 상태 기반 홈 (신규)
│       ├── guidebook/         # datasets → guidebook
│       │   ├── page.tsx       # 목록
│       │   ├── new/           # 새 가이드
│       │   └── [id]/          # 편집
│       ├── my-page/           # page → my-page (명확화)
│       └── settings/          # account + config 통합
├── [company]/                 # [slug] → [company] (명확화)
├── api/
│   ├── auth/                  # 유지
│   ├── chat/                  # 유지
│   ├── guide/                 # chatbot → guide
│   ├── guidebook/             # datasets → guidebook
│   ├── upload/                # 유지
│   └── widget/                # 유지
└── widget/                    # 유지
```

### 삭제 대상
```
app/admin/                     # 어드민 패널 (추후 필요시 재구축)
lib/points/                    # 포인트 시스템
lib/audit/                     # 감사 로그 (추후 추가)
lib/kakao/map/                 # 카카오 맵 (로그인은 유지)
```

---

## 4. 데이터베이스 마이그레이션

### 테이블명 변경
```sql
-- 테이블 리네임
ALTER TABLE tenants RENAME TO companies;
ALTER TABLE chatbots RENAME TO guides;
ALTER TABLE datasets RENAME TO guidebooks;
ALTER TABLE dataset_sources RENAME TO sources;
ALTER TABLE chunks RENAME TO pages;
ALTER TABLE conversations RENAME TO chats;

-- 컬럼명 변경 (FK 등)
ALTER TABLE guides RENAME COLUMN tenant_id TO company_id;
ALTER TABLE guidebooks RENAME COLUMN chatbot_id TO guide_id;
ALTER TABLE sources RENAME COLUMN dataset_id TO guidebook_id;
ALTER TABLE pages RENAME COLUMN dataset_id TO guidebook_id;
ALTER TABLE chats RENAME COLUMN chatbot_id TO guide_id;
```

### Drizzle 스키마 변경
```typescript
// Before: lib/db/schema/datasets.ts
export const datasets = pgTable('datasets', {
  id: uuid('id').primaryKey(),
  chatbotId: uuid('chatbot_id').references(() => chatbots.id),
  // ...
});

// After: lib/db/schema/guidebooks.ts
export const guidebooks = pgTable('guidebooks', {
  id: uuid('id').primaryKey(),
  guideId: uuid('guide_id').references(() => guides.id),
  // ...
});
```

### 마이그레이션 순서
1. 새 스키마 파일 작성
2. 마이그레이션 SQL 생성
3. 스테이징 환경 테스트
4. 프로덕션 적용

---

## 5. 디자인 시스템 적용

### globals.css 변경사항

이미 적용된 내용:
```css
:root {
  /* 브랜드 컬러 */
  --brand: oklch(0.68 0.19 28);          /* #FF6B4A - Coral */
  --brand-light: oklch(0.97 0.02 25);    /* #FFF0ED */
  --brand-foreground: oklch(1 0 0);      /* White */

  /* 시맨틱 컬러 */
  --success: oklch(0.72 0.19 145);
  --warning: oklch(0.77 0.16 75);
  --error: oklch(0.63 0.21 25);
  --info: oklch(0.62 0.19 260);

  /* 애니메이션 */
  --duration-fast: 150ms;
  --duration-normal: 200ms;
  --ease-default: cubic-bezier(0.4, 0, 0.2, 1);
}
```

### 추가 적용 필요
```css
/* 한글 타이포그래피 (이미 있음, 확인) */
--line-height-korean: 1.75;
--letter-spacing-korean: -0.01em;

/* 간격 시스템 */
--space-1: 4px;
--space-2: 8px;
--space-3: 12px;
--space-4: 16px;
--space-6: 24px;
--space-8: 32px;

/* 보더 라디우스 */
--radius-sm: 8px;
--radius-lg: 12px;   /* 기본값 */
--radius-xl: 16px;
```

---

## 6. 컴포넌트 수정

### 버튼 (components/ui/button.tsx)

```typescript
// 브랜드 버튼 variant 추가
const buttonVariants = cva(
  "...",
  {
    variants: {
      variant: {
        default: "...",
        brand: "bg-brand text-brand-foreground hover:bg-brand/90",
        // ...
      }
    }
  }
);
```

### 새 컴포넌트 필요

| 컴포넌트 | 용도 | 위치 |
|----------|------|------|
| `StateView` | 상태 기반 화면 전환 | `components/studio/` |
| `GuidebookCard` | 가이드북 카드 | `components/studio/` |
| `StatsCard` | 통계 카드 | `components/studio/` |
| `EmptyState` | 빈 상태 표시 | `components/ui/` |
| `ProcessingState` | 처리 중 표시 | `components/ui/` |

---

## 7. 라우팅 변경

### 리다이렉트 설정 (next.config.js)

```javascript
async redirects() {
  return [
    // 기존 URL 호환성
    {
      source: '/console/:path*',
      destination: '/studio/:path*',
      permanent: true,
    },
    // Studio 진입점
    {
      source: '/studio',
      destination: '/studio/home',
      permanent: false,
    },
  ];
}
```

### 새 라우트 구조

```
/                           → 랜딩 페이지
/login                      → 로그인
/signup                     → 회원가입
/studio                     → /studio/home 리다이렉트
/studio/home                → 상태 기반 메인 (신규)
/studio/guidebook           → 가이드북 목록
/studio/guidebook/new       → 새 가이드북
/studio/guidebook/[id]      → 가이드북 편집
/studio/my-page             → 내 페이지 설정
/studio/settings            → 설정 (계정, 결제, 알림)
/[company]                  → 공개 페이지
/[company]/chat             → 채팅 페이지
/widget/[id]                → 임베드 위젯
```

---

## 8. API 엔드포인트 변경

### 변경 매핑
| 기존 | 신규 |
|------|------|
| `/api/chatbot/*` | `/api/guide/*` |
| `/api/datasets/*` | `/api/guidebook/*` |
| `/api/chunks/*` | `/api/pages/*` |

### 하위 호환성
```typescript
// app/api/chatbot/route.ts
export { GET, POST } from '../guide/route';

// 또는 middleware에서 리다이렉트
```

---

## 9. 환경 변수

### 변경 필요
```env
# 기존
NEXT_PUBLIC_APP_NAME=SOFA
NEXT_PUBLIC_APP_URL=https://sofa.example.com

# 신규
NEXT_PUBLIC_APP_NAME=faq.guide
NEXT_PUBLIC_APP_URL=https://faq.guide
```

### 유지 (변경 없음)
```env
# Database
DATABASE_URL=

# Auth
SESSION_SECRET=
KAKAO_CLIENT_ID=
KAKAO_CLIENT_SECRET=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# AI
GOOGLE_GENERATIVE_AI_API_KEY=
EMBEDDING_API_URL=
EMBEDDING_API_KEY=

# Storage
S3_BUCKET=
S3_REGION=
S3_ACCESS_KEY=
S3_SECRET_KEY=

# Payment
PORTONE_API_KEY=
PORTONE_API_SECRET=

# Email
RESEND_API_KEY=

# Background
INNGEST_EVENT_KEY=
INNGEST_SIGNING_KEY=
```

---

## 10. 작업 순서

### Phase 1: 준비 (3일)
- [ ] 새 브랜치 생성 (`refactor/faq-guide`)
- [ ] 디자인 토큰 완전 적용 확인
- [ ] 테스트 환경 준비

### Phase 2: 백엔드 리팩토링 (1주)
- [ ] DB 스키마 변경 (Drizzle)
- [ ] 마이그레이션 스크립트 작성
- [ ] 타입 정의 변경
- [ ] lib 폴더 용어 변경
- [ ] API 라우트 변경

### Phase 3: 프론트엔드 리팩토링 (1주)
- [ ] 폴더 구조 변경 (console → studio)
- [ ] 컴포넌트 용어 변경
- [ ] 불필요한 페이지 제거

### Phase 4: UI 재설계 (2주)
- [ ] 상태 기반 홈 화면
- [ ] 가이드북 목록/생성/편집
- [ ] 내 페이지 설정
- [ ] 설정 페이지 통합

### Phase 5: 마무리 (3일)
- [ ] 랜딩 페이지 업데이트
- [ ] 공개 페이지 디자인 적용
- [ ] 전체 테스트
- [ ] 배포

---

## 11. 테스트 체크리스트

### 인증
- [ ] 이메일/비밀번호 로그인
- [ ] 카카오 OAuth 로그인
- [ ] 구글 OAuth 로그인
- [ ] 회원가입 + 이메일 인증
- [ ] 비밀번호 재설정

### 핵심 기능
- [ ] 파일 업로드 (PDF, DOCX, CSV, TXT)
- [ ] 가이드북 생성 (파싱 + 임베딩)
- [ ] 채팅 (RAG 검색 + 응답)
- [ ] 위젯 임베드

### 결제
- [ ] 플랜 조회
- [ ] 결제 진행
- [ ] 구독 관리

### 공개 페이지
- [ ] [company] 페이지 접근
- [ ] 채팅 기능
- [ ] 반응형 동작

---

## 12. 롤백 계획

### 마이그레이션 실패 시
```sql
-- 테이블명 원복
ALTER TABLE companies RENAME TO tenants;
ALTER TABLE guides RENAME TO chatbots;
ALTER TABLE guidebooks RENAME TO datasets;
-- ...
```

### 배포 실패 시
- 이전 버전으로 즉시 롤백
- DB는 이중 컬럼 유지 (마이그레이션 기간)

---

## 13. 참고 문서

- [MVP 방향](./vision-talks/2025-01-24-mvp-direction.md)
- [브랜딩 전략](./vision-talks/2025-01-25-branding-strategy.md)
- [UI/UX 철학](./vision-talks/2025-01-25-ui-ux-philosophy.md)
- [디자인 토큰](./vision-talks/2025-01-25-design-tokens.md)
- [클린 스타트 계획](./vision-talks/2025-01-25-clean-start-plan.md) (참고용)
