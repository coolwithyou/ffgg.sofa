# faq.guide 최종 개발 문서

**버전**: 1.0
**작성일**: 2025년 1월 25일
**상태**: 확정

---

## 목차

1. [프로젝트 개요](#1-프로젝트-개요)
2. [제품 비전](#2-제품-비전)
3. [핵심 기능](#3-핵심-기능)
4. [기술 아키텍처](#4-기술-아키텍처)
5. [브랜딩 및 디자인](#5-브랜딩-및-디자인)
6. [정보 구조 및 용어 체계](#6-정보-구조-및-용어-체계)
7. [화면 설계](#7-화면-설계)
8. [데이터 모델](#8-데이터-모델)
9. [개발 전략](#9-개발-전략)
10. [환경 설정](#10-환경-설정)
11. [부록](#11-부록)

---

# 1. 프로젝트 개요

## 1.1 서비스 정보

| 항목 | 내용 |
|------|------|
| **서비스명** | faq.guide |
| **도메인** | faq.guide (Cloudflare에서 구매 완료) |
| **한 줄 소개** | 소규모 사업자를 위한 가장 쉬운 FAQ 가이드 챗봇 서비스 |

## 1.2 프로젝트 배경

### 문제 인식

소규모 사업자, 특히 복잡한 제품/서비스를 다루는 사업장에서는 다음과 같은 문제를 겪고 있다:

```
"같은 질문에 백 번째 답변하느라 지쳤다"
"챗봇? 어려워 보여서 엄두가 안 났다"
"시간도 없고 돈도 없는데 뭔가 해결책이 필요하다"
```

**구체적 사례**: 첫 번째 타겟 고객은 **옻칠 공방**이다. 옻칠은 복잡한 공예 기법으로, 고객들이 "옻칠이 뭔가요?", "관리는 어떻게 하나요?" 같은 반복 질문을 끊임없이 한다. 사업주는 이에 답하느라 본업에 집중하기 어렵다.

### 기존 솔루션의 한계

| 기존 솔루션 | 문제점 |
|-------------|--------|
| **채널톡, 카카오 상담** | CS 중심, 설정 복잡, 비용 부담 |
| **노션, 블로그** | 검색 어려움, 고객이 직접 찾아야 함 |
| **FAQ 페이지** | 정적, 업데이트 번거로움 |
| **직접 챗봇 개발** | 기술력 필요, 비용 과다 |

### 우리의 해결책

> **파일 하나 올리면 AI가 알아서 FAQ 가이드를 만들어주는 서비스**

기존 CS 챗봇(채널톡)과 달리, faq.guide는 **"도슨트/가이드"** 역할을 한다.
- CS 챗봇: "문의하세요" → 상담원 연결
- faq.guide: "이건 이렇게 하시면 됩니다" → 즉시 답변

## 1.3 타겟 사용자

### 1차 타겟: 복잡한 제품/서비스를 가진 소규모 사업자

| 특성 | 설명 |
|------|------|
| **업종** | 공예(옻칠, 도자기), 전문 서비스, 교육, 수제 제품 |
| **규모** | 1-10인 |
| **디지털 역량** | 낮음 ~ 중간 |
| **주요 고민** | 반복 질문 응대, 시간 부족, 비용 민감 |

### 2차 타겟 (확장)

- 아트페어/전시 참가 작가
- 온라인 강의 운영자
- 수공예품 판매자

## 1.4 경쟁 차별점

| 비교 항목 | 채널톡 | 노션 FAQ | faq.guide |
|----------|--------|----------|-----------|
| 설정 난이도 | 중간 | 쉬움 | **매우 쉬움** |
| 자동 답변 | △ (학습 필요) | ✕ | **✓ (파일 업로드만)** |
| 비용 | 월 수만원~ | 무료 | **Free 플랜 제공** |
| 타겟 | B2B CS | 내부 문서화 | **B2C 고객 안내** |
| 핵심 역할 | 상담 연결 | 정보 저장 | **즉시 답변** |

---

# 2. 제품 비전

## 2.1 핵심 철학

> **"복잡한 기계가 아닌, 누구나 만질 수 있는 장난감"**

이 철학은 모든 설계 결정의 기준이 된다:

| 우리가 만드는 것 | 우리가 만들지 않는 것 |
|-----------------|---------------------|
| 레고 블록처럼 단순한 도구 | 전문가용 대시보드 |
| 가전제품처럼 직관적인 경험 | 기능이 많은 SaaS |
| 5분 안에 완성되는 결과물 | 학습이 필요한 시스템 |

### Apple 철학 적용

> "복잡함은 내부에서 감당하고, 사용자에게는 단순함만 보여준다"

- 내부: RAG, 임베딩, 벡터 검색 등 복잡한 AI 기술
- 외부: "파일 올리면 끝" 단순한 인터페이스

## 2.2 서비스가 주는 가치

### 사용자 여정

**Before (현재)**
```
고객 질문 → 사업주가 직접 답변 → 반복 → 지침 → 본업 방해
```

**After (faq.guide 도입 후)**
```
고객 질문 → AI 가이드가 즉시 답변 → 사업주는 본업 집중
```

### 감정 설계

| 단계 | 목표 감정 |
|------|----------|
| **첫 3초** | "오, 이건 나도 할 수 있겠다" |
| **사용 중** | "깔끔하네, 복잡하지 않네" |
| **완료 후** | "진짜 5분 만에 됐네" |

## 2.3 성공 지표 (KPI)

| 지표 | 목표 | 측정 방법 |
|------|------|----------|
| **가입→가이드 생성** | 5분 이내 | 온보딩 완료 시간 |
| **첫 주 재방문율** | 60% 이상 | DAU/WAU |
| **고객 만족도** | 4.5/5 이상 | NPS 설문 |
| **유료 전환율** | 5% 이상 | Free→Pro 전환 |

---

# 3. 핵심 기능

## 3.1 MVP 기능 목록

### Tier 1: 필수 (MVP)

| 기능 | 설명 | 상태 |
|------|------|------|
| 회원가입/로그인 | 이메일, 카카오, 구글 | 기존 완성 |
| 파일 업로드 | PDF, DOCX, CSV, TXT | 기존 완성 |
| 자동 가이드 생성 | 파싱 → 청킹 → 임베딩 | 기존 완성 |
| AI 채팅 | RAG 기반 질의응답 | 기존 완성 |
| 공개 페이지 | faq.guide/[company] | 리디자인 필요 |
| 위젯 임베드 | 외부 사이트 삽입 | 기존 완성 |

### Tier 2: 베타

| 기능 | 설명 | 상태 |
|------|------|------|
| 구독 결제 | Free/Pro/Business | 기존 완성 |
| 사용량 제한 | 플랜별 한도 | 기존 완성 |
| 이메일 알림 | 가입 인증, 알림 | 기존 완성 |

### Tier 3: 추후

| 기능 | 설명 | 우선순위 |
|------|------|----------|
| 다국어 지원 | 영어, 일본어 | 낮음 |
| 팀 협업 | 다중 사용자 | 낮음 |
| API 제공 | 외부 연동 | 낮음 |

## 3.2 사용자 플로우

### 전체 플로우

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  [1. 회원가입]  →  [2. 가이드 생성]  →  [3. 공개]  →  [4. 운영]  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 상세 플로우

#### 1단계: 회원가입 (1분)
```
랜딩 페이지 → "무료로 시작하기" 클릭
    ↓
로그인 방식 선택
  - 카카오로 시작 (원클릭)
  - 구글로 시작 (원클릭)
  - 이메일로 시작 (인증 필요)
    ↓
Studio 진입 (Empty 상태)
```

#### 2단계: 가이드 생성 (3분)
```
Empty 상태 화면
  - "Q&A 직접 작성" 또는 "파일로 만들기" 선택
    ↓
파일 업로드 (드래그 앤 드롭)
  - 지원 형식: PDF, DOCX, CSV, TXT
  - 최대 크기: 10MB (Free), 50MB (Pro)
    ↓
Processing 상태
  - 파싱 중... → 정리 중... → 학습 중...
  - 예상 시간 표시
    ↓
Ready 상태
  - "가이드가 준비됐어요!"
```

#### 3단계: 공개 (1분)
```
Ready 상태
  - [미리보기] → 채팅 테스트
  - [공개하기] → URL 활성화
    ↓
Live 상태
  - faq.guide/[company] 접속 가능
  - 위젯 코드 복사 가능
```

#### 4단계: 운영
```
Live 상태 대시보드
  - 오늘 통계 (방문, 질문, 만족도)
  - 가이드 추가/수정
  - 페이지 꾸미기
```

## 3.3 기능별 상세

### 3.3.1 파일 업로드 & 파싱

**지원 형식**
| 형식 | 처리 방식 | 라이브러리 |
|------|----------|-----------|
| PDF | 텍스트 + 구조 추출 | unpdf |
| DOCX | 마크다운 변환 | mammoth |
| CSV | 테이블 파싱 | papaparse |
| TXT | 직접 처리 | - |

**처리 파이프라인**
```
파일 업로드 → S3 저장 → Inngest 트리거
    ↓
파싱 (텍스트 추출)
    ↓
청킹 (의미 단위 분할, 512~1024 토큰)
    ↓
임베딩 (BGE-m3-ko)
    ↓
pgvector 저장
    ↓
완료 알림
```

### 3.3.2 AI 채팅 (RAG)

**검색 방식: Hybrid Search**
```
사용자 질문
    ↓
┌─────────────┬─────────────┐
│ Dense Search │ Sparse Search│
│ (임베딩)     │ (키워드)      │
└─────────────┴─────────────┘
    ↓
RRF (Reciprocal Rank Fusion)
    ↓
Re-ranking
    ↓
LLM 응답 생성 (Gemini 2.0 Flash)
```

**Intent 분류**
| Intent | 처리 |
|--------|------|
| DOMAIN_QUERY | RAG 검색 → 답변 |
| CHITCHAT | 간단한 대화 응답 |
| OUT_OF_SCOPE | "이 주제는 제가 답하기 어려워요" |

### 3.3.3 공개 페이지

**URL 구조**
```
faq.guide/[company]          → 메인 (link-in-bio 스타일)
faq.guide/[company]/chat     → 채팅 페이지
```

**구성 요소**
- 프로필 (로고, 이름, 소개)
- 가이드북 목록 또는 바로 채팅
- 테마 (라이트/다크)
- 커스텀 컬러

### 3.3.4 위젯 임베드

**삽입 코드**
```html
<script src="https://faq.guide/widget.js" data-id="xxx"></script>
```

**위젯 형태**
- 플로팅 버튼 (우하단)
- 채팅창 (팝업)
- 커스터마이징 (색상, 위치)

---

# 4. 기술 아키텍처

## 4.1 기술 스택

### Frontend
| 기술 | 버전 | 용도 |
|------|------|------|
| Next.js | 16 | 프레임워크 |
| React | 19 | UI 라이브러리 |
| Tailwind CSS | 4 | 스타일링 |
| Zustand | 5 | 상태 관리 |
| Radix UI | - | 컴포넌트 (shadcn/ui) |

### Backend
| 기술 | 버전 | 용도 |
|------|------|------|
| Next.js API Routes | - | API 서버 |
| Drizzle ORM | 0.45 | 데이터베이스 ORM |
| PostgreSQL | 16 | 메인 데이터베이스 |
| pgvector | - | 벡터 검색 |
| Inngest | - | 백그라운드 작업 |

### AI/ML
| 기술 | 용도 |
|------|------|
| Gemini 2.0 Flash | LLM (응답 생성) |
| BGE-m3-ko | 임베딩 모델 (한국어) |
| AI SDK (Vercel) | LLM 통합 |

### 인프라
| 서비스 | 용도 |
|--------|------|
| Vercel | 호스팅, 배포 |
| Supabase / Neon | PostgreSQL |
| AWS S3 | 파일 저장 |
| Cloudflare | 도메인, CDN |

### 외부 서비스
| 서비스 | 용도 |
|--------|------|
| PortOne | 결제 |
| Resend | 이메일 |
| 카카오 | OAuth 로그인 |
| Google | OAuth 로그인 |

## 4.2 시스템 구조도

```
┌─────────────────────────────────────────────────────────────────┐
│                          Client                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │   Landing   │  │   Studio    │  │ Public Page │             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Next.js API Routes                         │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐        │
│  │ Auth │ │ Chat │ │Guide │ │Upload│ │Widget│ │Billing│       │
│  └──────┘ └──────┘ └──────┘ └──────┘ └──────┘ └──────┘        │
└─────────────────────────────────────────────────────────────────┘
          │              │              │              │
          ▼              ▼              ▼              ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│  PostgreSQL  │ │   Inngest    │ │     S3       │ │   External   │
│  + pgvector  │ │ (Background) │ │  (Storage)   │ │   Services   │
└──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘
                       │
                       ▼
              ┌──────────────┐
              │  Embedding   │
              │     API      │
              └──────────────┘
```

## 4.3 핵심 모듈

### lib/parsers/ - 문서 파싱
```
parsers/
├── pdf-parser.ts      # PDF → 텍스트
├── docx-parser.ts     # DOCX → 마크다운
├── csv-parser.ts      # CSV → 구조화 데이터
├── text-parser.ts     # TXT 처리
└── document-parser.ts # 통합 파서
```

### lib/rag/ - RAG 파이프라인
```
rag/
├── retrieval.ts       # Hybrid Search
├── embedding.ts       # 임베딩 생성
├── chunking.ts        # 문서 청킹
├── reranker.ts        # 결과 재순위
├── generator.ts       # LLM 응답 생성
└── query-rewriter.ts  # 쿼리 재작성
```

### lib/chat/ - 채팅 서비스
```
chat/
├── service.ts         # 채팅 로직
├── intent-classifier.ts # Intent 분류
├── query-router.ts    # 쿼리 라우팅
└── conversation.ts    # 대화 관리
```

### lib/auth/ - 인증
```
auth/
├── session.ts         # 세션 관리 (iron-session)
├── password.ts        # 비밀번호 해싱
├── oauth/             # OAuth 처리
│   ├── kakao.ts
│   └── google.ts
└── email-verification.ts
```

---

# 5. 브랜딩 및 디자인

## 5.1 서비스명 결정 과정

### 후보 검토

| 후보 | 장점 | 단점 | 결정 |
|------|------|------|------|
| ffaq.ai | 재미있음 | 의미 불명확 | ✕ |
| askguide.ai | 명확함 | 평범함 | ✕ |
| **faq.guide** | 직관적, 기억하기 쉬움 | - | ✓ |

### 최종 결정

- **도메인 = 브랜드명**: faq.guide
- **로고**: 텍스트 로고, 점(.)에 브랜드 컬러 적용
- **발음**: "에프에이큐 가이드" 또는 "팩 가이드"

## 5.2 톤 & 보이스

### 성격
> 친구처럼 편하게, 하지만 할 일은 확실하게

| 특성 | O | X |
|------|---|---|
| 친근함 | "파일 올리면 끝이에요" | "파일을 업로드하십시오" |
| 명확함 | "5분이면 충분해요" | "빠른 시간 내에 가능합니다" |
| 자신감 | "AI가 알아서 해요" | "AI가 도와드릴 수 있습니다" |

### 피해야 할 표현

- 기술 용어: 임베딩, RAG, 벡터, 청크
- 수동태: "처리됩니다" → "처리해요"
- 과장: "혁신적인", "획기적인"

## 5.3 컬러 시스템

### 브랜드 컬러

| 역할 | 이름 | HEX | 용도 |
|------|------|-----|------|
| **Brand** | Coral | `#FF6B4A` | CTA, 로고 강조점 |
| **Brand Light** | - | `#FFF0ED` | 브랜드 배경 |

### 시맨틱 컬러

| 역할 | Light Mode | Dark Mode |
|------|------------|-----------|
| Primary | `#1A1A1A` | `#ECECEC` |
| Background | `#FCFCFC` | `#090909` |
| Surface | `#FFFFFF` | `#171717` |
| Border | `#E5E5E5` | `#282828` |
| Muted | `#6B6B6B` | `#808080` |

### 상태 컬러

| 상태 | HEX | 용도 |
|------|-----|------|
| Success | `#22C55E` | 완료, 성공 |
| Warning | `#F59E0B` | 주의, 안내 |
| Error | `#EF4444` | 오류 |
| Info | `#3B82F6` | 정보 |

## 5.4 타이포그래피

### 폰트

**Pretendard Variable** - 단일 사용

선택 이유:
- 문서 서비스이므로 장시간 가독성 중요
- 한글/영문 균형 우수
- 다양한 웨이트 지원

### 크기 스케일

| 용도 | 크기 | 웨이트 |
|------|------|--------|
| Display | 48px | Bold (700) |
| H1 | 32px | Bold (700) |
| H2 | 24px | SemiBold (600) |
| H3 | 20px | SemiBold (600) |
| Body | 16px | Regular (400) |
| Small | 14px | Regular (400) |
| Caption | 12px | Medium (500) |

### 한글 최적화

```css
--line-height-korean: 1.75;
--letter-spacing-korean: -0.01em;
```

## 5.5 UI/UX 원칙

### 5가지 핵심 원칙

#### 1. 선택지는 최대 3개
```
❌ 버튼 5개가 나열된 화면
✓ 버튼 2개 + "더 보기"
```

#### 2. 다음 할 일이 항상 보인다
```
❌ "대시보드에 오신 것을 환영합니다"
✓ "가이드를 만들어 시작하세요 [시작하기]"
```

#### 3. 깊이는 1단계까지
```
❌ 메뉴 → 서브메뉴 → 서브서브메뉴
✓ 메뉴 → 바로 기능
```

#### 4. 전문 용어 없음
```
❌ "데이터셋을 생성하고 청크를 임베딩합니다"
✓ "파일 올리면 끝. AI가 알아서 정리해요"
```

#### 5. 여백은 자신감
```
❌ 빽빽하게 채운 화면
✓ 숨 쉴 공간이 있는 화면
```

### 디자인 레퍼런스

**Readymag** 스타일:
- Flat (그림자 최소)
- Colorful (과감한 포인트)
- Bold (두꺼운 폰트)
- Minimal (요소 최소화)

---

# 6. 정보 구조 및 용어 체계

## 6.1 URL 구조

```
faq.guide
├── /                       → 랜딩 페이지
├── /login                  → 로그인
├── /signup                 → 회원가입
│
├── /studio                 → 관리자 (리다이렉트 → /studio/home)
│   ├── /studio/home        → 상태 기반 메인
│   ├── /studio/guidebook   → 가이드북 목록
│   │   ├── /new            → 새 가이드북
│   │   └── /[id]           → 편집
│   ├── /studio/my-page     → 내 페이지 설정
│   └── /studio/settings    → 설정
│
├── /[company]              → 공개 페이지
│   └── /[company]/chat     → 채팅
│
└── /widget/[id]            → 임베드 위젯
```

## 6.2 메뉴 구조 (Studio)

**3개 메뉴만**

```
┌─────────────────┐
│  faq.guide      │
│  ───────────    │
│                 │
│  📚 가이드북     │  ← 가이드 목록, 추가, 편집
│  🎨 내 페이지    │  ← 디자인, 미리보기, 공개
│  ⚙️ 설정        │  ← 계정, 결제, 알림
│                 │
│  ───────────    │
│  👤 내 계정     │
└─────────────────┘
```

## 6.3 용어 정의

### 사용자 노출 용어

| 용어 | 정의 | 예시 |
|------|------|------|
| **가이드** | AI 챗봇 자체 | "가이드가 답변해드려요" |
| **가이드북** | 가이드가 참조하는 지식 모음 | "가이드북에 내용을 추가하세요" |
| **페이지** | 가이드북 내 개별 항목 | "12개 페이지가 준비됐어요" |
| **내 페이지** | 공개되는 사이트 | "내 페이지를 꾸며보세요" |
| **Studio** | 관리자 화면 | "Studio에서 설정하세요" |

### 내부 용어 (코드)

| 사용자 용어 | 코드 용어 | DB 테이블 |
|-------------|----------|-----------|
| 가이드 | guide | guides |
| 가이드북 | guidebook | guidebooks |
| 페이지 | page | pages |
| 회사 | company | companies |

### 기존 → 신규 매핑

| 기존 (SOFA) | 신규 (faq.guide) |
|-------------|-----------------|
| console | studio |
| tenant | company |
| chatbot | guide |
| dataset | guidebook |
| chunk | page |
| conversation | chat |

---

# 7. 화면 설계

## 7.1 상태 기반 UI 개념

### 핵심 아이디어

> 사용자가 메뉴를 탐색하는 게 아니라, 시스템이 현재 상황에 맞는 화면을 보여준다.

RPG 게임처럼 "지금 해야 할 퀘스트"가 명확하게 보인다.

### 상태 정의

| 상태 | 조건 | 화면 | 목표 |
|------|------|------|------|
| **Empty** | 가이드북 0개 | 시작 유도 | 첫 가이드북 생성 |
| **Processing** | 생성 중 | 진행 상태 | 기다림 |
| **Ready** | 완성, 미공개 | 공개 유도 | 공개하기 |
| **Live** | 공개됨 | 대시보드 | 운영/확장 |

## 7.2 주요 화면

### 7.2.1 랜딩 페이지

```
┌─────────────────────────────────────────────────────┐
│  [Header]                                           │
│  faq.guide                              [로그인]    │
├─────────────────────────────────────────────────────┤
│                                                     │
│  [Hero]                                             │
│                                                     │
│     질문에 답하느라 지치셨나요?                      │
│                                                     │
│     파일 하나면 AI 가이드 완성.                      │
│     5분이면 충분해요.                               │
│                                                     │
│     [무료로 시작하기]  데모 보기 →                   │
│                                                     │
├─────────────────────────────────────────────────────┤
│                                                     │
│  [How it Works]                                     │
│                                                     │
│    1. 파일 올리기  →  2. AI가 정리  →  3. 공유하기   │
│       📄              🤖              🔗            │
│                                                     │
├─────────────────────────────────────────────────────┤
│                                                     │
│  [Pricing]                                          │
│                                                     │
│    Free          Pro                                │
│    ₩0/월         ₩19,000/월                         │
│    [시작하기]    [시작하기]                          │
│                                                     │
├─────────────────────────────────────────────────────┤
│  [Footer]                                           │
│  © faq.guide   이용약관   개인정보처리방침           │
└─────────────────────────────────────────────────────┘
```

### 7.2.2 Studio - Empty 상태

```
┌─────────────────────────────────────────────────────┐
│ [사이드바]              [메인 영역]                  │
│                                                     │
│ faq.guide                                           │
│ ──────────                      📄                  │
│                                                     │
│ 📚 가이드북              가이드를 만들어 시작하세요   │
│ 🎨 내 페이지                                        │
│ ⚙️ 설정               ┌────────────┐ ┌────────────┐ │
│                       │Q&A 직접작성 │ │파일로 만들기│ │
│                       └────────────┘ └────────────┘ │
│ ──────────                                          │
│ 👤 송욱                 샘플 가이드 둘러보기 →        │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### 7.2.3 Studio - Processing 상태

```
┌─────────────────────────────────────────────────────┐
│                                                     │
│                      ⏳                             │
│                                                     │
│              가이드를 만들고 있어요                  │
│              "옻칠 입문서.pdf"                       │
│                                                     │
│         ████████████░░░░░░░░░░░░  60%              │
│                                                     │
│           예상 시간: 약 2분 남음                     │
│                                                     │
│         완성되면 알림을 보내드릴게요                 │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### 7.2.4 Studio - Ready 상태

```
┌─────────────────────────────────────────────────────┐
│                                                     │
│                      ✅                             │
│                                                     │
│              가이드가 준비됐어요!                    │
│                                                     │
│       ┌─────────────┐    ┌─────────────┐           │
│       │  미리보기   │    │   공개하기   │ ← 코랄    │
│       └─────────────┘    └─────────────┘           │
│                                                     │
│                 나중에 공개할게요 →                  │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### 7.2.5 Studio - Live 상태 (대시보드)

```
┌─────────────────────────────────────────────────────┐
│                                                     │
│   내 페이지                                         │
│   faq.guide/ottchil                    [복사] [열기]│
│                                                     │
│   ─────────────────────────────────────────────     │
│                                                     │
│   📊 오늘                                           │
│   ┌──────────┐ ┌──────────┐ ┌──────────┐           │
│   │ 방문 12명 │ │ 질문 8개  │ │ 만족 95% │           │
│   └──────────┘ └──────────┘ └──────────┘           │
│                                                     │
│   ─────────────────────────────────────────────     │
│                                                     │
│   ┌─────────┐  ┌─────────┐  ┌─────────┐            │
│   │가이드 추가│ │페이지 꾸미기│ │  설정   │            │
│   └─────────┘  └─────────┘  └─────────┘            │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### 7.2.6 공개 페이지 ([company])

```
┌─────────────────────────────────────────────────────┐
│                                                     │
│                    [로고]                           │
│                   옻칠공방                          │
│            전통 옻칠의 아름다움                      │
│                                                     │
│   ─────────────────────────────────────────────     │
│                                                     │
│              무엇이든 물어보세요                     │
│                                                     │
│   ┌─────────────────────────────────────────────┐  │
│   │ 옻칠 관리는 어떻게 하나요?              [→] │  │
│   └─────────────────────────────────────────────┘  │
│                                                     │
│   ─────────────────────────────────────────────     │
│                                                     │
│                Powered by faq.guide                 │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

# 8. 데이터 모델

## 8.1 ERD 개요

```
┌──────────────┐       ┌──────────────┐       ┌──────────────┐
│  companies   │──1:N──│    guides    │──1:N──│  guidebooks  │
└──────────────┘       └──────────────┘       └──────────────┘
       │                      │                      │
       │                      │                      │
      1:N                    1:N                    1:N
       │                      │                      │
       ▼                      ▼                      ▼
┌──────────────┐       ┌──────────────┐       ┌──────────────┐
│    users     │       │    chats     │──1:N──│    pages     │
└──────────────┘       └──────────────┘       └──────────────┘
                              │                      │
                             1:N                    1:1
                              │                      │
                              ▼                      ▼
                       ┌──────────────┐       ┌──────────────┐
                       │   messages   │       │   sources    │
                       └──────────────┘       └──────────────┘
```

## 8.2 테이블 상세

### companies (회사)
```sql
CREATE TABLE companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR(50) UNIQUE NOT NULL,      -- URL용 식별자
  name VARCHAR(100) NOT NULL,            -- 회사명
  logo_url TEXT,                         -- 로고 이미지
  description TEXT,                      -- 소개
  theme JSONB DEFAULT '{}',              -- 테마 설정
  is_public BOOLEAN DEFAULT false,       -- 공개 여부
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### users (사용자)
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255),            -- OAuth면 NULL
  name VARCHAR(100),
  role VARCHAR(20) DEFAULT 'owner',      -- owner, admin, member
  oauth_provider VARCHAR(20),            -- kakao, google, NULL
  oauth_id VARCHAR(255),
  email_verified BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### guides (가이드 = 챗봇)
```sql
CREATE TABLE guides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id),
  name VARCHAR(100) NOT NULL,
  description TEXT,
  system_prompt TEXT,                    -- 시스템 프롬프트
  welcome_message TEXT,                  -- 환영 메시지
  model VARCHAR(50) DEFAULT 'gemini-2.0-flash',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### guidebooks (가이드북 = 지식 모음)
```sql
CREATE TABLE guidebooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guide_id UUID REFERENCES guides(id),
  name VARCHAR(100) NOT NULL,
  description TEXT,
  status VARCHAR(20) DEFAULT 'draft',    -- draft, processing, ready, published
  page_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### sources (원본 파일)
```sql
CREATE TABLE sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guidebook_id UUID REFERENCES guidebooks(id),
  filename VARCHAR(255) NOT NULL,
  file_url TEXT NOT NULL,                -- S3 URL
  file_type VARCHAR(20) NOT NULL,        -- pdf, docx, csv, txt
  file_size INTEGER NOT NULL,            -- bytes
  status VARCHAR(20) DEFAULT 'uploaded', -- uploaded, processing, completed, failed
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### pages (페이지 = 청크 + 벡터)
```sql
CREATE TABLE pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guidebook_id UUID REFERENCES guidebooks(id),
  source_id UUID REFERENCES sources(id),
  title VARCHAR(255),
  content TEXT NOT NULL,
  embedding VECTOR(1024),                -- BGE-m3-ko 임베딩
  metadata JSONB DEFAULT '{}',           -- 추가 정보
  token_count INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 벡터 검색 인덱스
CREATE INDEX pages_embedding_idx ON pages
USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
```

### chats (대화)
```sql
CREATE TABLE chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guide_id UUID REFERENCES guides(id),
  visitor_id VARCHAR(100),               -- 익명 방문자 ID
  started_at TIMESTAMPTZ DEFAULT NOW(),
  last_message_at TIMESTAMPTZ DEFAULT NOW()
);
```

### messages (메시지)
```sql
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id UUID REFERENCES chats(id),
  role VARCHAR(20) NOT NULL,             -- user, assistant
  content TEXT NOT NULL,
  sources JSONB,                         -- 참조한 페이지 정보
  feedback VARCHAR(10),                  -- positive, negative, NULL
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### subscriptions (구독)
```sql
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) UNIQUE,
  plan VARCHAR(20) DEFAULT 'free',       -- free, pro, business
  status VARCHAR(20) DEFAULT 'active',   -- active, canceled, past_due
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  portone_subscription_id VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

# 9. 개발 전략

## 9.1 접근 방식 결정

### 검토한 옵션

| 옵션 | 장점 | 단점 |
|------|------|------|
| **클린 스타트** | 깔끔한 구조 | 연결 재구축 필요 (+2-3주) |
| **전면 리팩토링** | 기존 연결 유지 | 레거시 부담 |
| **하이브리드** | 둘의 장점 조합 | - |

### 최종 결정: 하이브리드 리팩토링

> 백엔드는 거의 그대로, UI/용어만 새로 설계

**이유**:
1. OAuth, 결제, 이메일 등 **검증된 연결 유지**
2. 핵심 로직(파싱, RAG, 채팅)은 **그대로 활용**
3. Studio UI는 **어차피 새로 만들어야 함**
4. 예상 시간: 4-5주 (클린 스타트 7주 대비)

## 9.2 모듈 분류

### 그대로 사용 (100%)

| 모듈 | 경로 | 파일 수 |
|------|------|--------|
| UI 컴포넌트 | `components/ui/` | 43개 |
| 문서 파싱 | `lib/parsers/` | 6개 |
| 위젯 | `lib/widget/` | 3개 |
| 유틸리티 | `lib/utils.ts` 등 | 3개 |

### 설정 변경 (80-90%)

| 모듈 | 변경 사항 |
|------|----------|
| 인증 | OAuth 포함 유지 |
| RAG | 테이블명 변경 |
| 채팅 | 스키마 연결 |
| 결제 | PortOne 유지 |
| 이메일 | Resend 유지 |

### 재설계 (60% 이하)

| 모듈 | 변경 사항 |
|------|----------|
| Studio UI | 상태 기반, 3개 메뉴 |
| 공개 페이지 | 새 디자인 시스템 |
| API 라우트 | 엔드포인트 재설계 |

### 제거

| 모듈 | 이유 |
|------|------|
| `lib/points/` | 불필요 |
| `lib/audit/` | 추후 추가 |
| `app/admin/` | 추후 추가 |
| `lib/kakao/map/` | 미사용 |

## 9.3 작업 일정

### 전체: 5주

```
Week 1: 준비 + 백엔드 리팩토링
Week 2: 핵심 기능 연결
Week 3: Studio UI (상태 기반)
Week 4: Studio UI 완성 + 공개 페이지
Week 5: 결제/플랜 + 테스트 + 배포
```

### Phase 1: 준비 + 백엔드 (Week 1)

**Day 1-2: 브랜치 및 준비**
- [ ] `refactor/faq-guide` 브랜치 생성
- [ ] 디자인 토큰 적용 확인
- [ ] 테스트 환경 준비

**Day 3-5: 용어 변경**
- [ ] DB 마이그레이션 (테이블명)
- [ ] Drizzle 스키마 변경
- [ ] 타입 정의 변경

**Day 6-7: 폴더 구조**
- [ ] `(console)` → `(studio)` 변경
- [ ] 불필요한 폴더 삭제
- [ ] API 라우트 정리

### Phase 2: 핵심 기능 (Week 2)

- [ ] 인증 연결 확인 (OAuth 포함)
- [ ] 파일 업로드 테스트
- [ ] RAG 파이프라인 테스트
- [ ] 채팅 기능 테스트

### Phase 3: Studio UI (Week 3)

- [ ] 상태 기반 홈 화면
- [ ] Empty/Processing/Ready/Live 상태
- [ ] 가이드북 목록

### Phase 4: Studio 완성 + 공개 (Week 4)

- [ ] 가이드북 생성/편집
- [ ] 내 페이지 설정
- [ ] 공개 페이지 리디자인
- [ ] 위젯 테스트

### Phase 5: 마무리 (Week 5)

- [ ] 결제 연결 확인
- [ ] 플랜 구조 정리
- [ ] 전체 테스트
- [ ] 랜딩 페이지 업데이트
- [ ] 배포

## 9.4 테스트 체크리스트

### 인증
- [ ] 이메일/비밀번호 로그인
- [ ] 카카오 OAuth
- [ ] 구글 OAuth
- [ ] 회원가입 + 이메일 인증
- [ ] 비밀번호 재설정

### 핵심 기능
- [ ] PDF 업로드 및 파싱
- [ ] DOCX 업로드 및 파싱
- [ ] 가이드북 생성 (청킹 + 임베딩)
- [ ] 채팅 (RAG 검색 + 응답)
- [ ] 위젯 임베드

### 결제
- [ ] 플랜 조회
- [ ] 결제 진행
- [ ] 구독 관리

### UI
- [ ] 상태 전환 (Empty → Processing → Ready → Live)
- [ ] 반응형 (Mobile, Tablet, Desktop)
- [ ] 다크 모드

---

# 10. 환경 설정

## 10.1 환경 변수

### 필수

```env
# App
NEXT_PUBLIC_APP_NAME=faq.guide
NEXT_PUBLIC_APP_URL=https://faq.guide

# Database
DATABASE_URL=postgresql://...

# Auth
SESSION_SECRET=your-session-secret

# AI
GOOGLE_GENERATIVE_AI_API_KEY=...
EMBEDDING_API_URL=...
EMBEDDING_API_KEY=...

# Storage
S3_BUCKET=...
S3_REGION=...
S3_ACCESS_KEY=...
S3_SECRET_KEY=...
```

### OAuth

```env
# 카카오
KAKAO_CLIENT_ID=...
KAKAO_CLIENT_SECRET=...

# 구글
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
```

### 결제

```env
# PortOne
PORTONE_API_KEY=...
PORTONE_API_SECRET=...
PORTONE_STORE_ID=...
PORTONE_CHANNEL_KEY=...
```

### 이메일

```env
RESEND_API_KEY=...
```

### 백그라운드

```env
INNGEST_EVENT_KEY=...
INNGEST_SIGNING_KEY=...
```

## 10.2 외부 서비스 설정

### Cloudflare (도메인)
- 도메인: faq.guide
- DNS: Vercel 연결

### Vercel (호스팅)
- 프로젝트 연결
- 환경 변수 설정
- 도메인 연결

### PostgreSQL
- pgvector 확장 활성화
- 연결 풀링 설정

### S3
- 버킷 생성
- CORS 설정
- IAM 권한 설정

### PortOne
- 상점 등록
- 웹훅 URL 설정
- 테스트 → 프로덕션 전환

### OAuth
- 카카오 개발자센터: 앱 등록, Redirect URI 설정
- Google Cloud Console: OAuth 2.0 클라이언트 설정

---

# 11. 부록

## 11.1 관련 문서

| 문서 | 경로 | 설명 |
|------|------|------|
| MVP 방향 | `docs/vision-talks/2025-01-24-mvp-direction.md` | 초기 방향 논의 |
| 브랜딩 전략 | `docs/vision-talks/2025-01-25-branding-strategy.md` | 네이밍, 톤앤보이스 |
| UI/UX 철학 | `docs/vision-talks/2025-01-25-ui-ux-philosophy.md` | 디자인 원칙 |
| 디자인 토큰 | `docs/vision-talks/2025-01-25-design-tokens.md` | 컬러, 타이포, 간격 |
| 클린 스타트 계획 | `docs/vision-talks/2025-01-25-clean-start-plan.md` | 모듈 분류 (참고) |
| Figma 프롬프트 | `docs/figma-design-prompt.md` | 디자인 요청용 |
| 리팩토링 스펙 | `docs/refactoring-spec.md` | 개발 상세 |

## 11.2 의사결정 로그

| 일자 | 결정 사항 | 이유 |
|------|----------|------|
| 01/24 | MVP 타겟: 옻칠 공방 | 복잡한 제품 + 반복 질문 |
| 01/25 | 도메인: faq.guide | 직관적, 기억하기 쉬움 |
| 01/25 | 폰트: Pretendard 단일 | 장시간 가독성 |
| 01/25 | 컬러: Coral #FF6B4A | 따뜻함, 친근함 |
| 01/25 | 메뉴: 3개로 제한 | 선택 피로 방지 |
| 01/25 | 개발: 하이브리드 리팩토링 | 시간 절약 + 안정성 |

## 11.3 참고 레퍼런스

### 디자인
- Readymag (UI 스타일)
- Apple (단순함 철학)
- Notion (문서 서비스 UX)

### 기술
- Vercel AI SDK
- Drizzle ORM
- shadcn/ui

---

**문서 끝**

---

*이 문서는 faq.guide 개발의 기준이 되는 최종 문서입니다.*
*변경 사항이 있을 경우 이 문서를 업데이트하고 버전을 갱신합니다.*
