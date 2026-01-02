# SOFA Public Page - Linktree 스타일 독립 페이지

> 현재 iframe 위젯 기반 챗봇을 Linktree 스타일 독립 페이지로 확장하는 프로젝트입니다.

## 개요

### 배경
SOFA는 현재 `<iframe>` 위젯 방식으로 쇼핑몰 등 외부 사이트에 챗봇을 임베드하는 구조입니다. 이 프로젝트는 Linktree처럼 **독립적인 공개 페이지**를 제공하여, 사용자가 직접 URL로 챗봇에 접근할 수 있도록 합니다.

### 목표
- **URL 형식**: `https://sofa.example.com/[slug]`
- **슬러그 단위**: 챗봇별 (한 조직이 여러 공개 페이지 운영 가능)
- **MVP 범위**: 챗봇 인터페이스 + 프로필 헤더
- **기존 위젯**: 완전 유지 (병행 운영)

### 아키텍처

```
┌─────────────────────────────────────────────────────────────────┐
│                         SOFA Platform                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────┐   │
│  │  Widget      │    │  Public Page │    │  Portal (관리)    │   │
│  │  /widget/*   │    │  /[slug]     │    │  /chatbots/*     │   │
│  └──────┬───────┘    └──────┬───────┘    └────────┬─────────┘   │
│         │                   │                      │             │
│         │                   │                      │             │
│         ▼                   ▼                      ▼             │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                     Chat Service                          │   │
│  │               (processChat / RAG Pipeline)                │   │
│  └──────────────────────────────────────────────────────────┘   │
│                              │                                   │
│                              ▼                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                      PostgreSQL                           │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐   │   │
│  │  │  chatbots   │  │  messages   │  │  sessions       │   │   │
│  │  │  + slug     │  │             │  │                 │   │   │
│  │  │  + config   │  │             │  │                 │   │   │
│  │  └─────────────┘  └─────────────┘  └─────────────────┘   │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Phase 구성

| Phase | 기간 | 주요 작업 | 문서 |
|-------|------|----------|------|
| 1 | 2-3일 | DB 스키마 및 기반 인프라 | [phase-1-db-schema.md](./phase-1-db-schema.md) |
| 2 | 3-4일 | 라우팅 및 공개 페이지 렌더링 | [phase-2-routing.md](./phase-2-routing.md) |
| 3 | 4-5일 | 포탈 관리 UI | [phase-3-portal-ui.md](./phase-3-portal-ui.md) |
| 4 | 2-3일 | 보안 및 Rate Limiting | [phase-4-security.md](./phase-4-security.md) |
| 5 | 2-3일 | 통합 테스트 및 배포 | [phase-5-deployment.md](./phase-5-deployment.md) |

**총 예상 기간: 2-3주**

## 핵심 파일 목록

### 수정 파일
| 파일 | 변경 내용 |
|------|----------|
| `drizzle/schema.ts` | chatbots 테이블에 slug, publicPageEnabled, publicPageConfig 추가 |
| `proxy.ts` | PUBLIC_PATH_PATTERNS에 /[slug] 패턴 추가 |
| `lib/middleware/rate-limit.ts` | 공개 페이지용 rate limit 추가 |
| `next.config.ts` | 보안 헤더 추가 |
| `app/(portal)/chatbots/[id]/page.tsx` | 공개 페이지 설정 탭 추가 |

### 신규 파일
| 파일 | 설명 |
|------|------|
| `lib/public-page/types.ts` | PublicPageConfig 타입 정의 |
| `lib/public-page/reserved-slugs.ts` | 예약어 및 검증 함수 |
| `app/[slug]/page.tsx` | 공개 페이지 서버 컴포넌트 |
| `app/[slug]/public-page-view.tsx` | 공개 페이지 클라이언트 뷰 |
| `app/[slug]/actions.ts` | 공개 페이지 서버 액션 |
| `app/[slug]/components/header-block.tsx` | 헤더 블록 컴포넌트 |
| `app/[slug]/components/chatbot-block.tsx` | 챗봇 블록 컴포넌트 |
| `app/(portal)/chatbots/[id]/public-page-settings.tsx` | 관리 UI 컴포넌트 |
| `app/api/chatbots/check-slug/route.ts` | 슬러그 중복 체크 API |
| `app/api/chatbots/[id]/public-page/route.ts` | 설정 CRUD API |

## 향후 확장 계획 (MVP 이후)

1. **추가 블록 타입**: 링크 버튼, 소셜 아이콘, 이미지, 텍스트, 구분선
2. **드래그앤드롭 블록 편집기**: @dnd-kit 활용
3. **CAPTCHA 통합**: Cloudflare Turnstile
4. **분석 대시보드**: 페이지 조회수, 채팅 통계
5. **커스텀 도메인 지원**: 고객 도메인 연결

## 관련 문서

- [기존 Widget 시스템 문서](../widget/README.md) (있는 경우)
- [Drizzle ORM 마이그레이션 가이드](../database/README.md) (있는 경우)
- [Rate Limiting 정책](../security/rate-limiting.md) (있는 경우)
