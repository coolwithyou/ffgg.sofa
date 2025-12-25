# SOFA 수동 설정 가이드

이 문서는 코드 구현 외에 **직접 진행해야 하는 설정 작업**들을 안내합니다.

---

## 목차

1. [Resend 이메일 서비스 설정](#1-resend-이메일-서비스-설정)
2. [Neon PostgreSQL 설정](#2-neon-postgresql-설정)
3. [Upstash Redis 설정](#3-upstash-redis-설정)
4. [Vercel 배포 설정](#4-vercel-배포-설정)
5. [카카오 비즈니스 채널 설정](#5-카카오-비즈니스-채널-설정)
6. [OpenAI API 설정](#6-openai-api-설정)
7. [Google Gemini API 설정](#7-google-gemini-api-설정)
8. [임베딩 서버 설정](#8-임베딩-서버-설정)
9. [환경변수 체크리스트](#9-환경변수-체크리스트)

---

## 1. Resend 이메일 서비스 설정

회원가입 인증 이메일, 비밀번호 재설정 이메일 발송에 필요합니다.

### 1.1 Resend 계정 생성

1. [Resend 홈페이지](https://resend.com) 접속
2. **Get Started** 클릭 → GitHub 또는 이메일로 가입
3. 무료 플랜: 월 3,000건 이메일 발송 가능

### 1.2 API 키 발급

1. 대시보드 → **API Keys** 메뉴
2. **Create API Key** 클릭
3. 이름 입력 (예: `sofa-production`)
4. Permission: **Full access** 선택
5. 생성된 API 키 복사 (한 번만 표시됨!)

```bash
# .env.local에 추가
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxx
```

### 1.3 발신 도메인 설정 (프로덕션 필수)

개발 환경에서는 `onboarding@resend.dev`로 발송 가능하지만, 프로덕션에서는 자체 도메인 필요.

1. 대시보드 → **Domains** 메뉴
2. **Add Domain** 클릭
3. 도메인 입력 (예: `sofa.ai`)
4. DNS 레코드 추가:
   - MX 레코드
   - TXT 레코드 (SPF)
   - TXT 레코드 (DKIM)

```bash
# 도메인 인증 후 환경변수 설정
EMAIL_FROM=noreply@sofa.ai
```

### 1.4 이메일 템플릿 확인

현재 구현된 이메일 발송 위치:
- 회원가입 인증: `app/api/auth/signup/route.ts` (TODO 주석)
- 비밀번호 재설정: `app/api/auth/forgot-password/route.ts` (TODO 주석)

이메일 발송 함수: `inngest/functions/send-notification.ts`

---

## 2. Neon PostgreSQL 설정

### 2.1 Neon 프로젝트 생성

1. [Neon Console](https://console.neon.tech) 접속
2. **New Project** 클릭
3. 설정:
   - Project name: `sofa-production`
   - Postgres version: 16 (권장)
   - Region: `Asia Pacific (Singapore)` 또는 `Asia Pacific (Tokyo)`
4. **Create Project** 클릭

### 2.2 연결 문자열 복사

1. 프로젝트 대시보드 → **Connection Details**
2. **Connection string** 복사

```bash
# .env.local에 추가
DATABASE_URL=postgresql://username:password@ep-xxx.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
```

### 2.3 pgvector 확장 활성화

Neon은 pgvector를 기본 지원합니다. 활성화 스크립트 실행:

```bash
pnpm tsx scripts/enable-pgvector.ts
```

또는 SQL 직접 실행:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

### 2.4 데이터베이스 마이그레이션

```bash
# 마이그레이션 실행
pnpm db:migrate

# 스키마 확인
pnpm db:studio
```

### 2.5 Branching (선택사항)

Neon의 브랜치 기능으로 개발/스테이징 환경 분리:

1. 대시보드 → **Branches**
2. **New Branch** 클릭
3. 브랜치별 연결 문자열 사용

---

## 3. Upstash Redis 설정

Rate Limiting에 사용됩니다.

### 3.1 Upstash 계정 생성

1. [Upstash Console](https://console.upstash.com) 접속
2. GitHub 또는 이메일로 가입
3. 무료 플랜: 일 10,000건 요청

### 3.2 Redis 데이터베이스 생성

1. 대시보드 → **Create Database**
2. 설정:
   - Name: `sofa-ratelimit`
   - Type: **Regional**
   - Region: `Asia Pacific (Tokyo)` 또는 `Asia Pacific (Singapore)`
   - TLS: **Enabled** (권장)
3. **Create** 클릭

### 3.3 환경변수 복사

1. 데이터베이스 상세 페이지 → **REST API** 섹션
2. `.env.local` 탭 클릭
3. 환경변수 복사

```bash
# .env.local에 추가
UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=xxxxxxxxxxxxxxxx
```

### 3.4 연결 테스트

```bash
# 간단한 테스트 (curl)
curl -X POST "https://xxx.upstash.io/set/test/hello" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## 4. Vercel 배포 설정

### 4.1 Vercel 프로젝트 연결

1. [Vercel Dashboard](https://vercel.com/dashboard) 접속
2. **Add New** → **Project**
3. GitHub 저장소 연결
4. Framework Preset: **Next.js** 자동 감지

### 4.2 환경변수 설정

1. 프로젝트 → **Settings** → **Environment Variables**
2. 다음 환경변수 추가:

| 변수명 | 환경 | 설명 |
|--------|------|------|
| `DATABASE_URL` | Production, Preview | Neon 연결 문자열 |
| `SESSION_SECRET` | Production, Preview | 32자 이상 랜덤 문자열 |
| `RESEND_API_KEY` | Production, Preview | Resend API 키 |
| `UPSTASH_REDIS_REST_URL` | Production, Preview | Upstash URL |
| `UPSTASH_REDIS_REST_TOKEN` | Production, Preview | Upstash 토큰 |
| `OPENAI_API_KEY` | Production, Preview | OpenAI API 키 |

### 4.3 세션 시크릿 생성

```bash
# 터미널에서 랜덤 문자열 생성
openssl rand -base64 32
# 예: K7xN2mP9qR4tY6wZ8aB3cD5eF1gH0iJ2kL4mN6oP8qR=
```

### 4.4 도메인 설정

1. 프로젝트 → **Settings** → **Domains**
2. 커스텀 도메인 추가 (예: `app.sofa.ai`)
3. DNS 설정:
   - CNAME: `cname.vercel-dns.com`

### 4.5 Preview 배포 설정

1. **Settings** → **Git**
2. Production Branch: `main`
3. Preview Branches: 모든 브랜치 또는 특정 패턴

---

## 5. 카카오 비즈니스 채널 설정

카카오톡 챗봇 연동에 필요합니다.

### 5.1 카카오 비즈니스 계정 생성

1. [카카오 비즈니스](https://business.kakao.com) 접속
2. 비즈니스 계정 생성 또는 로그인
3. 사업자 정보 등록 (사업자등록증 필요)

### 5.2 카카오톡 채널 생성

1. [카카오톡 채널 관리자센터](https://center-pf.kakao.com) 접속
2. **새 채널 만들기**
3. 채널 정보 입력:
   - 채널명
   - 프로필 이미지
   - 소개

### 5.3 챗봇 설정 (카카오 i 오픈빌더)

1. [카카오 i 오픈빌더](https://i.kakao.com) 접속
2. **봇 만들기** → **스킬 기반 봇**
3. 스킬 서버 URL 등록:

```
https://your-domain.com/api/kakao/skill
```

### 5.4 스킬 설정

1. **스킬** 메뉴 → **스킬 만들기**
2. 설정:
   - 스킬명: `SOFA 챗봇`
   - URL: `https://your-domain.com/api/kakao/skill`
   - 메서드: POST
3. **저장** 후 **배포**

### 5.5 환경변수 설정

```bash
# .env.local에 추가 (선택사항 - 검증용)
KAKAO_BOT_ID=your_bot_id
KAKAO_SKILL_SECRET=your_skill_secret
```

### 5.6 타임아웃 주의사항

카카오톡 스킬 서버는 **5초 타임아웃** 제한이 있습니다.
현재 구현에서는 4초 내 응답하도록 설계되어 있습니다.

---

## 6. OpenAI API 설정

### 6.1 OpenAI 계정 생성

1. [OpenAI Platform](https://platform.openai.com) 접속
2. 계정 생성 또는 로그인
3. 결제 정보 등록 (필수)

### 6.2 API 키 발급

1. **API Keys** 메뉴
2. **Create new secret key**
3. 이름 입력 (예: `sofa-production`)
4. 키 복사 (한 번만 표시!)

```bash
# .env.local에 추가
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxx
```

### 6.3 사용량 제한 설정 (권장)

1. **Settings** → **Limits**
2. Monthly budget 설정 (예: $100)
3. 알림 이메일 설정

### 6.4 모델 선택

현재 설정된 모델:
- Chat: `gpt-4o-mini` (비용 효율)
- Embedding: 별도 서버 사용 예정 (BGE-m3-ko)

```bash
# 모델 변경 시 환경변수
OPENAI_MODEL=gpt-4o-mini
```

### 6.5 DPA (Data Processing Agreement)

**중요**: 개인정보보호법 준수를 위해 OpenAI DPA 확인 필요

1. [OpenAI DPA](https://openai.com/policies/data-processing-addendum) 확인
2. 한국 개인정보보호법 요건 충족 여부 검토
3. 개인정보 처리방침에 OpenAI를 수탁자로 명시 (이미 완료)

---

## 7. Google Gemini API 설정

OpenAI 대안 또는 폴백으로 Google Gemini를 사용할 수 있습니다.

### 7.1 Google AI Studio 접속

1. [Google AI Studio](https://aistudio.google.com) 접속
2. Google 계정으로 로그인
3. 서비스 약관 동의

### 7.2 API 키 발급

1. 좌측 메뉴 → **Get API Key**
2. **Create API Key** 클릭
3. 프로젝트 선택 또는 새 프로젝트 생성
4. 생성된 API 키 복사

```bash
# .env.local에 추가
GOOGLE_AI_API_KEY=AIzaSy-xxxxxxxxxxxxxxxxxxxxxxxx
```

### 7.3 Vertex AI 사용 (엔터프라이즈)

프로덕션 환경에서는 Vertex AI 사용을 권장합니다.

1. [Google Cloud Console](https://console.cloud.google.com) 접속
2. 프로젝트 생성 또는 선택
3. **APIs & Services** → **Enable APIs**
4. "Vertex AI API" 검색 후 활성화
5. **IAM & Admin** → **Service Accounts** → 서비스 계정 생성
6. 역할: `Vertex AI User` 부여
7. JSON 키 다운로드

```bash
# .env.local에 추가
GOOGLE_CLOUD_PROJECT=your-project-id
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json

# 또는 Vercel에서는 JSON 내용을 직접 설정
GOOGLE_SERVICE_ACCOUNT_KEY={"type":"service_account","project_id":"..."}
```

### 7.4 모델 선택

| 모델 | 용도 | 특징 |
|------|------|------|
| `gemini-2.0-flash` | 채팅 (권장) | 빠른 응답, 비용 효율 |
| `gemini-1.5-pro` | 복잡한 작업 | 긴 컨텍스트 (100만 토큰) |
| `gemini-1.5-flash` | 채팅 | 빠른 응답 |
| `text-embedding-004` | 임베딩 | 768 차원 |

```bash
# .env.local에 추가
GEMINI_MODEL=gemini-2.0-flash
GEMINI_EMBEDDING_MODEL=text-embedding-004
```

### 7.5 코드에서 Gemini 사용

```typescript
// lib/ai/gemini.ts 예시
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY!);

export async function generateWithGemini(prompt: string) {
  const model = genAI.getGenerativeModel({
    model: process.env.GEMINI_MODEL || 'gemini-2.0-flash'
  });

  const result = await model.generateContent(prompt);
  return result.response.text();
}

// 임베딩 생성
export async function embedWithGemini(text: string) {
  const model = genAI.getGenerativeModel({
    model: 'text-embedding-004'
  });

  const result = await model.embedContent(text);
  return result.embedding.values; // 768 차원 벡터
}
```

### 7.6 OpenAI 폴백 설정

Gemini를 기본으로, OpenAI를 폴백으로 사용:

```bash
# .env.local
AI_PROVIDER=gemini          # gemini | openai
AI_FALLBACK_PROVIDER=openai # 폴백 제공자
```

```typescript
// lib/ai/provider.ts 예시
export async function generateResponse(prompt: string) {
  const provider = process.env.AI_PROVIDER || 'openai';

  try {
    if (provider === 'gemini') {
      return await generateWithGemini(prompt);
    }
    return await generateWithOpenAI(prompt);
  } catch (error) {
    // 폴백
    if (process.env.AI_FALLBACK_PROVIDER === 'openai') {
      return await generateWithOpenAI(prompt);
    }
    throw error;
  }
}
```

### 7.7 요금제 및 제한

**무료 티어 (AI Studio)**:
- 분당 15 요청 (RPM)
- 일 1,500 요청
- 분당 100만 토큰

**유료 티어 (Vertex AI)**:
- 입력: $0.075 / 100만 토큰 (Gemini 1.5 Flash)
- 출력: $0.30 / 100만 토큰
- 임베딩: $0.025 / 100만 토큰

### 7.8 DPA 및 데이터 처리

**Google Cloud DPA**:
1. [Google Cloud Data Processing Terms](https://cloud.google.com/terms/data-processing-addendum) 확인
2. Vertex AI 사용 시 자동 적용
3. AI Studio는 개발/테스트 용도로만 권장

**데이터 보관 정책**:
- AI Studio: 입력/출력이 모델 개선에 사용될 수 있음
- Vertex AI: 기본적으로 데이터 미보관 (설정 가능)

```bash
# Vertex AI 데이터 로깅 비활성화 (프로덕션 권장)
VERTEX_AI_DISABLE_LOGGING=true
```

---

## 8. 임베딩 서버 설정

BGE-m3-ko 한국어 임베딩 모델 사용을 위한 설정입니다.

### 8.1 옵션 A: 외부 API 사용 (권장)

HuggingFace Inference API 또는 유사 서비스 사용:

```bash
# .env.local에 추가
EMBEDDING_API_URL=https://api.huggingface.co/models/BAAI/bge-m3
HUGGINGFACE_API_KEY=hf_xxxxxxxxxxxxxxxx
```

### 8.2 옵션 B: 셀프 호스팅

Docker로 임베딩 서버 직접 운영:

```bash
# 임베딩 서버 실행 (예시)
docker run -d \
  --name embedding-server \
  -p 8080:8080 \
  ghcr.io/your-org/bge-m3-server:latest
```

```bash
# .env.local에 추가
EMBEDDING_API_URL=http://localhost:8080/embed
```

### 8.3 옵션 C: OpenAI Embeddings 사용

OpenAI의 text-embedding-3-small 사용 (한국어 성능은 BGE-m3-ko보다 낮음):

```bash
# .env.local에 추가
USE_OPENAI_EMBEDDINGS=true
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
```

### 8.4 옵션 D: Gemini Embeddings 사용

Google의 text-embedding-004 사용 (768 차원):

```bash
# .env.local에 추가
USE_GEMINI_EMBEDDINGS=true
GEMINI_EMBEDDING_MODEL=text-embedding-004
```

**주의**: Gemini 임베딩은 768 차원이므로, 기존 BGE-m3-ko (1024 차원)와 호환되지 않습니다.
새로운 프로젝트에서 시작하거나, 모든 문서를 재임베딩해야 합니다.

---

## 9. 환경변수 체크리스트

### 필수 환경변수

```bash
# 데이터베이스
DATABASE_URL=                    # Neon PostgreSQL

# 세션
SESSION_SECRET=                  # 32자 이상 랜덤 문자열

# 이메일
RESEND_API_KEY=                  # Resend API 키
EMAIL_FROM=noreply@yourdomain.com

# Rate Limiting
UPSTASH_REDIS_REST_URL=          # Upstash Redis URL
UPSTASH_REDIS_REST_TOKEN=        # Upstash Redis 토큰

# AI (OpenAI 또는 Gemini 중 하나 이상 필수)
OPENAI_API_KEY=                  # OpenAI API 키
GOOGLE_AI_API_KEY=               # Google AI Studio API 키
```

### 선택 환경변수

```bash
# AI 제공자 설정
AI_PROVIDER=openai               # openai | gemini
AI_FALLBACK_PROVIDER=gemini      # 폴백 제공자
GEMINI_MODEL=gemini-2.0-flash    # Gemini 모델

# Vertex AI (엔터프라이즈)
GOOGLE_CLOUD_PROJECT=            # GCP 프로젝트 ID
GOOGLE_SERVICE_ACCOUNT_KEY=      # 서비스 계정 JSON

# 임베딩
EMBEDDING_API_URL=               # 임베딩 서버 URL
HUGGINGFACE_API_KEY=             # HuggingFace API 키
GEMINI_EMBEDDING_MODEL=text-embedding-004

# 카카오
KAKAO_BOT_ID=                    # 카카오 봇 ID
KAKAO_SKILL_SECRET=              # 카카오 스킬 시크릿

# 모니터링
SENTRY_DSN=                      # Sentry DSN (에러 추적)
```

### 환경변수 검증

```bash
# 개발 서버 시작 시 환경변수 체크
pnpm dev

# 또는 직접 확인
pnpm tsx scripts/check-env.ts
```

---

## 부록: 문제 해결

### 이메일이 발송되지 않는 경우

1. Resend API 키 확인
2. 발신 도메인 DNS 설정 확인
3. Resend 대시보드에서 로그 확인

### 데이터베이스 연결 오류

1. DATABASE_URL 형식 확인 (`?sslmode=require` 포함)
2. Neon 대시보드에서 IP 허용 목록 확인
3. 연결 풀 제한 확인

### Rate Limiting이 작동하지 않는 경우

1. Upstash 환경변수 확인
2. Redis 연결 테스트
3. 미들웨어 로그 확인

### 카카오 연동 오류

1. 스킬 서버 URL이 HTTPS인지 확인
2. 5초 타임아웃 내 응답 확인
3. 오픈빌더 로그 확인

---

## 다음 단계

1. 위 설정 완료 후 개발 서버 실행: `pnpm dev`
2. 각 기능 테스트
3. 프로덕션 배포: `git push origin main`

문의사항은 이슈로 등록해주세요.
