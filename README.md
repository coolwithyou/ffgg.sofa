# SOFA - 기업용 RAG 챗봇 SaaS

기업 고객을 위한 멀티테넌트 RAG(Retrieval-Augmented Generation) 챗봇 서비스입니다.

## 기술 스택

### 인프라
- **프레임워크**: Next.js 16 (App Router)
- **데이터베이스**: Neon PostgreSQL + pgvector
- **ORM**: Drizzle ORM
- **인증**: Iron Session
- **Rate Limiting**: Upstash Redis
- **파일 저장소**: S3 호환 스토리지
- **테스트**: Vitest

### AI 모델 (2025년 12월 기준)
| 용도 | 모델 | 비고 |
|------|------|------|
| **LLM (메인)** | Gemini 2.5 Flash-Lite | 가성비 최고 |
| **LLM (폴백)** | GPT-4o-mini | 안정성 |
| **임베딩** | BGE-m3-ko | 한국어 최적화, 1024차원 |
| **FTS** | Nori + BM25 | Hybrid Retrieval |

## 주요 기능

- 멀티테넌트 데이터 격리 (RLS 기반)
- 문서 업로드 및 RAG 파이프라인
- **Hybrid Retrieval**: Dense (BGE-m3-ko) + Sparse (BM25) 검색
- 관리자 2FA (TOTP) 인증
- 개인정보보호법 준수 (F36 접속기록)
- Rate Limiting 및 사용량 관리
- LLM 폴백 전략 (Gemini → GPT-4o-mini)

## 시작하기

### 1. 환경 변수 설정

`.env.local` 파일을 생성하고 다음 환경 변수를 설정하세요:

```bash
# 데이터베이스 (Neon PostgreSQL)
DATABASE_URL=postgresql://...

# 세션 암호화 키 (32자 이상 권장)
SESSION_SECRET=your-secret-key-at-least-32-characters

# Upstash Redis (Rate Limiting)
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=...

# S3 호환 스토리지 (선택)
S3_BUCKET=your-bucket-name
S3_REGION=ap-northeast-2
S3_ACCESS_KEY_ID=...
S3_SECRET_ACCESS_KEY=...
S3_ENDPOINT=https://... # MinIO/Cloudflare R2 등 사용 시

# Google Gemini (LLM)
GOOGLE_GENERATIVE_AI_API_KEY=...

# OpenAI (폴백용)
OPENAI_API_KEY=...

# BGE-m3-ko 임베딩 서버 (셀프호스팅)
EMBEDDING_API_URL=http://localhost:8000
```

### 2. 의존성 설치

```bash
pnpm install
```

### 3. 데이터베이스 설정

```bash
# 스키마를 데이터베이스에 푸시
pnpm db:push

# pgvector 확장 활성화
pnpm db:enable-vector
```

### 4. 초기 어드민 생성

```bash
# 환경변수로 비밀번호 설정
ADMIN_EMAIL=admin@your-domain.com \
ADMIN_PASSWORD=YourSecurePassword123! \
pnpm db:seed:admin
```

또는 `.env.local`에 추가:
```bash
ADMIN_EMAIL=admin@your-domain.com
ADMIN_PASSWORD=YourSecurePassword123!
ADMIN_COMPANY=Your Company Name
```

### 5. 개발 서버 실행

```bash
pnpm dev
```

[http://localhost:3000](http://localhost:3000)에서 확인할 수 있습니다.

## 테스트

### 단위 테스트 실행

```bash
# 테스트 실행 (watch 모드)
pnpm test

# 테스트 1회 실행
pnpm test:run

# 커버리지 포함 테스트
pnpm test:coverage
```

### 테스트 파일 위치

```
__tests__/
├── lib/
│   ├── auth/
│   │   └── password.test.ts    # 비밀번호 검증 테스트
│   └── upload/
│       └── file-validator.test.ts  # 파일 검증 테스트
```

## 프로젝트 구조

```
ffgg.sofa/
├── app/                    # Next.js App Router
│   ├── api/               # API 라우트
│   │   ├── auth/          # 인증 API (login, logout, me)
│   │   └── documents/     # 문서 API (upload)
│   └── page.tsx           # 메인 페이지
├── lib/                    # 핵심 라이브러리
│   ├── auth/              # 인증 모듈
│   │   ├── session.ts     # 세션 관리
│   │   ├── password.ts    # 비밀번호 검증/해싱
│   │   ├── account-lock.ts # 계정 잠금
│   │   └── totp.ts        # 2FA TOTP
│   ├── audit/             # 감사 로그
│   │   ├── logger.ts      # F36 접속기록
│   │   └── permission-audit.ts # 권한 변경 이력
│   ├── db/                # 데이터베이스
│   │   └── index.ts       # Drizzle 클라이언트
│   ├── middleware/        # 미들웨어
│   │   ├── tenant.ts      # 테넌트 격리
│   │   └── rate-limit.ts  # Rate Limiting
│   ├── upload/            # 파일 업로드
│   │   ├── file-validator.ts # 파일 검증 (Magic Number)
│   │   └── storage.ts     # S3 스토리지
│   ├── errors.ts          # 에러 처리
│   └── logger.ts          # 로깅
├── drizzle/               # DB 스키마 및 마이그레이션
│   └── schema.ts
├── __tests__/             # 테스트 파일
└── docs/                  # 개발 문서
    ├── DEVELOPMENT_PLAN.md       # 12주 개발 계획
    └── REVIEW_AND_IMPROVEMENTS.md # 개선사항 및 로드맵
```

## 스크립트

| 명령어 | 설명 |
|--------|------|
| `pnpm dev` | 개발 서버 실행 |
| `pnpm build` | 프로덕션 빌드 |
| `pnpm start` | 프로덕션 서버 실행 |
| `pnpm lint` | ESLint 실행 |
| `pnpm test` | 테스트 실행 (watch 모드) |
| `pnpm test:run` | 테스트 1회 실행 |
| `pnpm test:coverage` | 커버리지 포함 테스트 |
| `pnpm db:push` | DB 스키마 푸시 |
| `pnpm db:generate` | 마이그레이션 생성 |
| `pnpm db:migrate` | 마이그레이션 실행 |
| `pnpm db:studio` | Drizzle Studio 실행 |
| `pnpm db:seed:admin` | 초기 어드민 생성 |
| `pnpm db:enable-vector` | pgvector 확장 활성화 |

## API 엔드포인트

### 인증

| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | `/api/auth/login` | 로그인 |
| POST | `/api/auth/logout` | 로그아웃 |
| GET | `/api/auth/me` | 현재 사용자 정보 |

### 문서

| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | `/api/documents/upload` | 문서 업로드 |

## 보안 기능

- **비밀번호 정책**: 8자 이상, 대소문자/숫자/특수문자 포함
- **계정 잠금**: 5회 실패 시 30분 잠금
- **세션 타임아웃**: 30분 비활성 시 만료
- **2FA**: 관리자 TOTP 필수
- **Rate Limiting**: 티어별 요청 제한
- **파일 검증**: 확장자 + Magic Number 이중 검증
- **테넌트 격리**: API 레벨 tenant_id 검증

## 개발 상태

- [x] Week 1: 프로젝트 셋업 + 보안 기반
- [x] Week 2: 인증 + 멀티테넌시 + 보안
- [x] Week 3: 파일 업로드 + 테스트
- [ ] Week 4: 문서 처리 파이프라인
- [ ] Week 5-12: RAG 챗봇, 검토 도구, 카카오 연동 등

## 라이선스

Private
