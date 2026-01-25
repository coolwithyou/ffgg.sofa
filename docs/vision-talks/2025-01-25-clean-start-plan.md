# faq.guide 클린 스타트 계획

**날짜**: 2025년 1월 25일
**상태**: 계획 수립

---

## 1. 개요

기존 SOFA 코드베이스에서 필요한 부분만 가져와 faq.guide를 새로 구성한다.

### 핵심 원칙

1. **용어를 처음부터 올바르게** - Dataset/Chunk가 아닌 Guidebook/Guide
2. **베타 수준 유지** - 인증(OAuth), 결제, 이메일 등 완성된 기능 보존
3. **검증된 코드 재사용** - 파싱, RAG, AI는 그대로 활용
4. **UI만 새로 설계** - 백엔드는 거의 그대로, 프론트엔드는 새 디자인 시스템

---

## 2. 새 프로젝트 구조

```
faq-guide/
├── app/
│   ├── (landing)/              ← 랜딩 페이지 (신규)
│   │   └── page.tsx
│   │
│   ├── (auth)/                 ← 인증 (기존 활용)
│   │   ├── login/
│   │   ├── signup/
│   │   └── layout.tsx
│   │
│   ├── (studio)/               ← 관리자 Studio (신규 설계)
│   │   ├── layout.tsx
│   │   ├── page.tsx            ← 상태 기반 홈
│   │   ├── guidebook/          ← 가이드북 관리
│   │   │   ├── page.tsx        ← 목록
│   │   │   ├── new/            ← 새 가이드
│   │   │   └── [id]/           ← 편집
│   │   ├── my-page/            ← 내 페이지 설정
│   │   └── settings/           ← 설정
│   │
│   ├── [company]/              ← 공개 페이지 (기존 활용)
│   │   ├── page.tsx            ← 메인 (link-in-bio)
│   │   └── chat/               ← 채팅 페이지
│   │
│   ├── widget/                 ← 임베드 위젯 (기존 활용)
│   │   └── [id]/
│   │
│   └── api/
│       ├── auth/               ← 인증 API (기존 활용)
│       ├── chat/               ← 채팅 API (기존 활용)
│       ├── guide/              ← 가이드 API (신규, 기존 dataset 참고)
│       ├── upload/             ← 업로드 API (기존 활용)
│       └── widget/             ← 위젯 API (기존 활용)
│
├── components/
│   ├── ui/                     ← shadcn/ui (기존 그대로)
│   ├── chat/                   ← 채팅 UI (기존 활용)
│   ├── studio/                 ← Studio 전용 (신규)
│   └── public-page/            ← 공개 페이지 (기존 활용)
│
├── lib/
│   ├── core/                   ← 핵심 모듈
│   │   ├── parsers/            ← 문서 파싱 (100% 재사용)
│   │   ├── rag/                ← RAG 검색 (90% 재사용)
│   │   ├── ai/                 ← AI 통합 (90% 재사용)
│   │   └── chat/               ← 채팅 로직 (80% 재사용)
│   │
│   ├── auth/                   ← 인증 (90% 재사용)
│   ├── upload/                 ← 업로드 (80% 재사용)
│   ├── widget/                 ← 위젯 (100% 재사용)
│   │
│   ├── db/                     ← 데이터베이스
│   │   ├── schema/             ← 스키마 (신규 설계)
│   │   └── queries/            ← 쿼리 (신규)
│   │
│   └── utils/                  ← 유틸리티 (100% 재사용)
│
└── public/
```

---

## 3. 모듈별 재사용 계획

### 3.1 그대로 가져오기 (100%)

| 모듈 | 경로 | 파일 수 | 설명 |
|------|------|--------|------|
| **UI 컴포넌트** | `components/ui/` | 43개 | shadcn/ui 전체 |
| **문서 파싱** | `lib/parsers/` | 6개 | PDF, DOCX, CSV, TXT |
| **위젯** | `lib/widget/` | 3개 | 임베드 코드 생성 |
| **유틸리티** | `lib/utils.ts` | 1개 | cn(), formatDate 등 |
| **에러 정의** | `lib/errors.ts` | 1개 | 에러 코드 |
| **로거** | `lib/logger.ts` | 1개 | 로깅 |
| **테마** | `components/theme-provider.tsx` | 1개 | 다크모드 |

### 3.2 설정만 변경 (80-90%)

| 모듈 | 경로 | 변경 사항 |
|------|------|----------|
| **인증** | `lib/auth/` | 세션 설정 (OAuth 포함 유지) |
| **업로드** | `lib/upload/` | S3 버킷 설정 |
| **RAG 검색** | `lib/rag/retrieval.ts` | DB 테이블명 변경 |
| **RAG 청킹** | `lib/rag/chunking.ts` | 청크 크기 조정 |
| **RAG 임베딩** | `lib/rag/embedding.ts` | API 엔드포인트 |
| **AI 서비스** | `lib/ai/` | 모델 설정 |
| **채팅 서비스** | `lib/chat/service.ts` | DB 스키마 연결 |
| **이메일** | `lib/email/` | Resend 설정 유지 |
| **결제** | `lib/billing/` | PortOne 설정 유지 |
| **티어** | `lib/tier/` | 플랜 구조 단순화 |

### 3.3 구조 참고 후 재작성 (60% 이하)

| 모듈 | 기존 경로 | 변경 내용 |
|------|----------|----------|
| **Studio 레이아웃** | `app/(console)/` | 3개 메뉴로 단순화 |
| **가이드북 관리** | `app/.../datasets/` | 용어/UI 완전 재설계 |
| **공개 페이지** | `app/[slug]/` | 디자인 시스템 적용 |
| **API 라우트** | `app/api/datasets/` | 엔드포인트 재설계 |

### 3.4 베타 기능 (기존 완성도 유지)

| 모듈 | 경로 | 변경 사항 |
|------|------|----------|
| **OAuth 로그인** | `lib/auth/` | 카카오/구글 로그인 유지 |
| **이메일 인증** | `lib/email/` | 회원가입 인증 메일 |
| **구독 결제** | `lib/billing/` | PortOne 결제 유지 |
| **티어 시스템** | `lib/tier/` | Free/Pro/Business 플랜 |

### 3.5 사용하지 않음

| 모듈 | 이유 |
|------|------|
| `lib/points/` | 포인트 시스템 불필요 (단순화) |
| `lib/kakao/map/` | 카카오 맵 미사용 (로그인은 유지) |
| `lib/audit/` | 감사로그는 추후 추가 |
| `app/admin/` | 어드민은 추후 필요시 추가 |

---

## 4. 데이터베이스 스키마

### 4.1 기존 → 신규 용어 매핑

| 기존 (SOFA) | 신규 (faq.guide) | 설명 |
|-------------|-----------------|------|
| `tenants` | `companies` | 회사/고객사 |
| `chatbots` | `guides` | 가이드 (챗봇 역할) |
| `datasets` | `guidebooks` | 가이드북 (문서 모음) |
| `dataset_sources` | `sources` | 원본 파일 |
| `chunks` | `pages` | 가이드 페이지 (청크) |
| `conversations` | `chats` | 대화 |
| `messages` | `messages` | (동일) |

### 4.2 핵심 테이블 (단순화)

```sql
-- 회사
companies (
  id, slug, name, logo_url,
  created_at, updated_at
)

-- 사용자
users (
  id, company_id, email, password_hash,
  role, created_at
)

-- 가이드 (=챗봇)
guides (
  id, company_id, name, description,
  system_prompt, is_public, theme,
  created_at, updated_at
)

-- 가이드북 (=데이터셋)
guidebooks (
  id, guide_id, name, description,
  status, -- draft | processing | ready | published
  created_at, updated_at
)

-- 소스 파일
sources (
  id, guidebook_id, filename, file_url,
  file_type, file_size, status,
  created_at
)

-- 페이지 (=청크, 벡터 포함)
pages (
  id, guidebook_id, source_id,
  title, content, embedding,
  metadata, created_at
)

-- 대화
chats (
  id, guide_id, visitor_id,
  created_at, updated_at
)

-- 메시지
messages (
  id, chat_id, role, content,
  sources, created_at
)
```

---

## 5. 기능별 구현 계획

### Phase 1: 기초 셋업 (1주)

**Day 1-2: 프로젝트 초기화**
- [ ] Next.js 프로젝트 생성
- [ ] Tailwind CSS 4 + 디자인 토큰 적용
- [ ] shadcn/ui 컴포넌트 복사
- [ ] Drizzle ORM 셋업

**Day 3-5: 인증 시스템 (베타 수준)**
- [ ] `lib/auth/` 복사 및 수정
- [ ] 이메일/비밀번호 로그인
- [ ] 카카오 OAuth 로그인
- [ ] 구글 OAuth 로그인
- [ ] 회원가입 + 이메일 인증

**Day 6-7: 데이터베이스**
- [ ] 스키마 정의 (용어 변경 적용)
- [ ] 마이그레이션 실행
- [ ] 기본 쿼리 함수

### Phase 2: 핵심 기능 (2주)

**Week 2: 파싱 + RAG**
- [ ] `lib/parsers/` 복사
- [ ] `lib/rag/` 복사 및 수정
- [ ] 임베딩 API 연동
- [ ] Inngest 백그라운드 작업 설정
- [ ] 가이드북 생성 파이프라인

**Week 3: 채팅**
- [ ] `lib/chat/` 복사 및 수정
- [ ] 채팅 API 구현
- [ ] 채팅 UI 컴포넌트

### Phase 3: Studio UI (2주)

**Week 4: Studio 기본**
- [ ] 상태 기반 홈 화면
- [ ] 가이드북 목록/생성
- [ ] 파일 업로드

**Week 5: Studio 완성**
- [ ] 가이드 편집
- [ ] 내 페이지 설정
- [ ] 공개/비공개 토글

### Phase 4: 공개 페이지 + 위젯 (1주)

**Week 6**
- [ ] `[company]` 공개 페이지 (link-in-bio)
- [ ] 위젯 임베드
- [ ] 반응형 디자인

### Phase 5: 결제 + 플랜 (1주)

**Week 7**
- [ ] `lib/billing/` 복사 및 수정
- [ ] `lib/tier/` 플랜 구조 정리
- [ ] 결제 페이지 UI
- [ ] 구독 관리 (업그레이드/다운그레이드)
- [ ] 사용량 제한 적용

---

## 6. 의존성 목록

### 필수 (Core)

```json
{
  "next": "^16",
  "react": "^19",
  "drizzle-orm": "^0.45",
  "postgres": "^3.4",
  "@radix-ui/react-*": "latest",
  "tailwindcss": "^4",
  "zustand": "^5",
  "zod": "^4"
}
```

### AI/LLM

```json
{
  "@ai-sdk/google": "latest",
  "@ai-sdk/anthropic": "latest",
  "ai": "latest"
}
```

### 파일 처리

```json
{
  "unpdf": "latest",
  "mammoth": "latest",
  "papaparse": "latest"
}
```

### 인증/보안

```json
{
  "iron-session": "latest",
  "bcryptjs": "latest"
}
```

### OAuth (베타 기능)

```json
{
  "next-auth": "latest"
}
```
> 카카오/구글 로그인 지원

### 결제 (베타 기능)

```json
{
  "@portone/server-sdk": "latest",
  "@portone/browser-sdk": "latest"
}
```

### 이메일 (베타 기능)

```json
{
  "resend": "latest"
}
```

### 스토리지

```json
{
  "@aws-sdk/client-s3": "latest"
}
```

### 백그라운드 작업

```json
{
  "inngest": "latest"
}
```
> 문서 파싱, 임베딩 생성 등 비동기 작업

### 제외

- `@upstash/redis` - Rate limiting (필요시 추가)
- `lib/points/` - 포인트 시스템 (불필요)

---

## 7. 파일 복사 체크리스트

### 즉시 복사

```bash
# UI 컴포넌트
cp -r components/ui/ new-project/components/

# 테마
cp components/theme-provider.tsx new-project/components/

# 유틸리티
cp lib/utils.ts new-project/lib/
cp lib/errors.ts new-project/lib/
cp lib/logger.ts new-project/lib/
cp lib/format.ts new-project/lib/

# 파서
cp -r lib/parsers/ new-project/lib/core/

# 위젯
cp -r lib/widget/ new-project/lib/
```

### 수정 후 복사

```bash
# 인증 (세션 설정 변경, OAuth 포함)
cp -r lib/auth/ new-project/lib/

# 업로드 (S3 설정 변경)
cp -r lib/upload/ new-project/lib/

# RAG (테이블명 변경)
cp -r lib/rag/ new-project/lib/core/

# 채팅 (스키마 연결)
cp -r lib/chat/ new-project/lib/core/

# 이메일 (베타)
cp -r lib/email/ new-project/lib/

# 결제 (베타)
cp -r lib/billing/ new-project/lib/

# 티어/플랜 (베타, 단순화)
cp -r lib/tier/ new-project/lib/

# 백그라운드 작업
cp -r app/api/inngest/ new-project/app/api/
```

---

## 8. 환경 변수

### 필수

```env
# Database
DATABASE_URL=

# Auth
SESSION_SECRET=

# AI
GOOGLE_GENERATIVE_AI_API_KEY=
# 또는
ANTHROPIC_API_KEY=

# Embedding
EMBEDDING_API_URL=
EMBEDDING_API_KEY=

# Storage
S3_BUCKET=
S3_REGION=
S3_ACCESS_KEY=
S3_SECRET_KEY=
```

### OAuth (베타)

```env
# 카카오 로그인
KAKAO_CLIENT_ID=
KAKAO_CLIENT_SECRET=

# 구글 로그인
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
```

### 결제 (베타)

```env
# PortOne
PORTONE_API_KEY=
PORTONE_API_SECRET=
PORTONE_STORE_ID=
PORTONE_CHANNEL_KEY=
```

### 이메일 (베타)

```env
RESEND_API_KEY=
```

### 백그라운드 작업

```env
INNGEST_EVENT_KEY=
INNGEST_SIGNING_KEY=
```

### 선택 (추후)

```env
# Rate Limiting
UPSTASH_REDIS_URL=
```

---

## 9. 다음 단계

1. [ ] 이 계획 검토 및 확정
2. [ ] 새 프로젝트 디렉토리 생성
3. [ ] Phase 1 시작 (프로젝트 초기화)

---

## 관련 문서

- [MVP 방향](./2025-01-24-mvp-direction.md)
- [브랜딩 전략](./2025-01-25-branding-strategy.md)
- [UI/UX 철학](./2025-01-25-ui-ux-philosophy.md)
- [디자인 토큰](./2025-01-25-design-tokens.md)
