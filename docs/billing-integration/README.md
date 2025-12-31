# PortOne V2 기반 정기결제 시스템 통합

## 개요

SOFA 프로젝트에 PortOne V2를 통한 토스페이먼츠 정기결제 시스템을 구현합니다.
PortOne을 중간 레이어로 사용하여 PG사 변경 유연성을 확보하고, 통합된 API로 결제를 관리합니다.

### PortOne 사용 이점
- **PG사 추상화**: 토스, 나이스, KCP 등 다양한 PG 통합 지원
- **통합 API**: 일관된 API로 모든 PG 연동
- **향후 확장성**: PG사 변경 시 최소한의 코드 수정

## 핵심 결정 사항

| 항목 | 결정 |
|------|------|
| **결제 게이트웨이** | PortOne V2 (토스페이먼츠 채널) |
| **결제 권한** | admin 역할만 구독 관리 가능 |
| **서비스 제한** | 점진적 제한 정책 (past_due → suspended → expired) |
| **가격 정책** | 원화(KRW) 전용 |

### 가격표

| 플랜 | 월간 가격 | 연간 가격 | 대상 |
|------|----------|----------|------|
| Basic | 무료 | 무료 | 개인/소규모 팀 |
| Standard | ₩29,000/월 | ₩290,000/년 | 중간 규모 비즈니스 |
| Premium | ₩99,000/월 | ₩990,000/년 | 대규모 비즈니스 |

## Phase 구성

### [Phase 1: 기반 구축](./phase-1-foundation.md)
- DB 스키마 설계 및 마이그레이션
- 환경변수 설정 (PortOne)
- 플랜 시드 데이터

### [Phase 2: PortOne 클라이언트](./phase-2-portone-client.md)
- PortOne 서버 SDK 클라이언트 구현
- 웹훅 보안 검증
- 주문 ID 생성

### [Phase 3: API 엔드포인트](./phase-3-api-endpoints.md)
- 구독 관리 API
- 빌링키 발급 API
- 웹훅 엔드포인트

### [Phase 4: Inngest 함수](./phase-4-inngest.md)
- 결제 처리 함수
- 결제 재시도 함수
- 알림 함수

### [Phase 5: 크론 작업](./phase-5-cron.md)
- 정기결제 트리거
- 만료 구독 처리
- Vercel Cron 설정

### [Phase 6: 클라이언트 UI](./phase-6-client-ui.md)
- PortOne Browser SDK 연동
- 구독 페이지 개선
- 결제 플로우 페이지

### [Phase 7: 서비스 제한](./phase-7-service-restriction.md)
- 구독 상태별 제한 정책
- 미들웨어 적용

## 아키텍처 다이어그램

```
┌─────────────────────────────────────────────────────────────────┐
│                         클라이언트                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │ 플랜 선택    │  │ 결제 수단   │  │ 구독 관리 페이지     │  │
│  │ 페이지       │  │ 등록 UI     │  │ (상태/내역/취소)     │  │
│  └──────┬───────┘  └──────┬───────┘  └──────────┬───────────┘  │
│         │PortOne SDK      │                     │              │
└─────────┼─────────────────┼─────────────────────┼──────────────┘
          │                 │                     │
          ▼                 ▼                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Next.js API Routes                          │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ /api/billing/*                                              │ │
│  │  - billing-key/prepare (빌링키 발급 준비)                   │ │
│  │  - billing-key/save (빌링키 저장)                           │ │
│  │  - subscription (조회/생성)                                 │ │
│  │  - subscription/change (플랜 변경)                          │ │
│  │  - subscription/cancel (구독 취소)                          │ │
│  │  - payments (결제 내역)                                     │ │
│  └────────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ /api/billing/webhook                                        │ │
│  │  - PortOne 웹훅 서명 검증                                   │ │
│  │  - 멱등성 체크                                              │ │
│  │  - Inngest 이벤트 발송                                      │ │
│  └────────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ /api/cron/billing/*                                         │ │
│  │  - check-renewals (매일 00:00 UTC)                          │ │
│  │  - expire-subscriptions (매일 01:00 UTC)                    │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
          │                                   │
          ▼                                   ▼
┌─────────────────────┐           ┌──────────────────────────────┐
│      PortOne V2      │           │        Inngest               │
│  ┌───────────────┐  │           │  ┌────────────────────────┐  │
│  │ 빌링키 발급   │  │           │  │ process-billing-payment│  │
│  │ 빌링키 결제   │  │◄─────────►│  │ billing-retry          │  │
│  │ 결제 조회     │  │           │  │ billing-notification   │  │
│  │ 웹훅 발송     │  │           │  └────────────────────────┘  │
│  └───────────────┘  │           └──────────────────────────────┘
│         │           │                        │
│         ▼           │                        ▼
│  ┌───────────────┐  │  ┌─────────────────────────────────────────┐
│  │ 토스페이먼츠  │  │  │              PostgreSQL (Neon)           │
│  │ (PG 채널)     │  │  │ ┌────────┐ ┌────────────┐ ┌──────────┐  │
│  └───────────────┘  │  │ │ plans  │ │subscriptions│ │ payments │  │
└─────────────────────┘  │ └────────┘ └────────────┘ └──────────┘  │
                         │ ┌──────────────────────┐                │
                         │ │ billing_webhook_logs │                │
                         │ └──────────────────────┘                │
                         └─────────────────────────────────────────┘
```

## 구독 상태 플로우

```
                    ┌─────────────┐
                    │   pending   │ ◄── 구독 생성 (빌링키 미등록)
                    └──────┬──────┘
                           │ 빌링키 발급 완료 + 첫 결제 성공
                           ▼
                    ┌─────────────┐
      ┌────────────►│   active    │◄────────────┐
      │             └──────┬──────┘             │
      │                    │ 결제 실패          │ 결제 성공
      │                    ▼                    │
      │             ┌─────────────┐             │
      │             │  past_due   │─────────────┘
      │             └──────┬──────┘
      │                    │ 7일 경과 후 계속 실패
      │                    ▼
      │             ┌─────────────┐
      │             │  suspended  │
      │             └──────┬──────┘
      │                    │
      │    ┌───────────────┼───────────────┐
      │    │               │               │
      │    ▼               ▼               ▼
      │ 결제 성공     30일 경과     사용자 취소
      │    │               │               │
      │    │        ┌──────▼──────┐ ┌──────▼──────┐
      └────┘        │   expired   │ │  canceled   │
                    └─────────────┘ └─────────────┘
```

## 재시도 전략

```
결제 실패 발생
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│ 1차 재시도: 1일 후                                          │
│   └─ 성공 → active                                          │
│   └─ 실패 → 2차 재시도 예약                                 │
├─────────────────────────────────────────────────────────────┤
│ 2차 재시도: 3일 후                                          │
│   └─ 성공 → active                                          │
│   └─ 실패 → 3차 재시도 예약, past_due 상태 전환             │
├─────────────────────────────────────────────────────────────┤
│ 3차 재시도: 7일 후                                          │
│   └─ 성공 → active                                          │
│   └─ 실패 → suspended 상태 전환, 관리자 알림                │
└─────────────────────────────────────────────────────────────┘
```

## 환경 변수

```bash
# PortOne V2 설정
PORTONE_STORE_ID=store-xxxxx
PORTONE_CHANNEL_KEY=channel-key-xxxxx    # 토스페이먼츠 채널
PORTONE_API_SECRET=xxxxx                 # V2 API Secret
PORTONE_WEBHOOK_SECRET=xxxxx             # 웹훅 시크릿

# Cron 인증
CRON_SECRET=xxxxx
```

## 파일 구조

```
lib/
├── config/
│   └── billing-env.ts             # 환경변수 검증
├── portone/
│   ├── client.ts                  # PortOne 서버 SDK 클라이언트
│   └── webhook.ts                 # 웹훅 검증
├── billing/
│   ├── order-id.ts                # 주문 ID 생성
│   └── subscription-policy.ts     # 구독 정책

app/api/
├── billing/
│   ├── billing-key/
│   │   ├── prepare/route.ts       # POST: 빌링키 발급 준비
│   │   └── save/route.ts          # POST: 빌링키 저장
│   ├── subscription/
│   │   ├── route.ts               # GET: 조회
│   │   ├── change/route.ts        # POST: 변경
│   │   └── cancel/route.ts        # POST: 취소
│   ├── payments/route.ts          # GET: 내역
│   ├── plans/route.ts             # GET: 플랜 목록
│   └── webhook/route.ts           # POST: 웹훅 수신
└── cron/
    └── billing/
        ├── check-renewals/route.ts
        └── expire-subscriptions/route.ts

inngest/functions/
├── billing/
│   ├── process-payment.ts
│   ├── retry-payment.ts
│   └── notification.ts
└── index.ts

app/(portal)/
├── mypage/
│   └── subscription/
│       ├── page.tsx               # 구독 관리
│       ├── plans/page.tsx         # 플랜 선택
│       └── history/page.tsx       # 결제 내역

drizzle/
├── schema.ts                      # 테이블 추가
└── seed/
    └── plans.ts                   # 플랜 시드
```

## 구현 일정 (권장)

| 주차 | Phase | 작업 내용 |
|------|-------|----------|
| 1주차 | Phase 1 | DB 스키마, 환경설정 |
| 2주차 | Phase 2-3 | PortOne 클라이언트, API 엔드포인트 |
| 3주차 | Phase 4-5 | Inngest 함수, 크론 작업 |
| 4주차 | Phase 6 | 클라이언트 UI |
| 5주차 | Phase 7 | 서비스 제한 + 통합 테스트 |

## 테스트 체크리스트

### 빌링키 관련
- [ ] 빌링키 발급 성공
- [ ] 빌링키 발급 실패 (카드 정보 오류)
- [ ] 빌링키 삭제
- [ ] 빌링키 재등록

### 결제 관련
- [ ] 정기결제 성공
- [ ] 정기결제 실패 (잔액 부족)
- [ ] 재시도 후 성공
- [ ] 최종 실패 후 suspended 전환

### 웹훅 관련
- [ ] 웹훅 수신 및 처리
- [ ] 웹훅 서명 검증 실패 거부
- [ ] 중복 웹훅 멱등성 처리

### 구독 관리
- [ ] 플랜 업그레이드
- [ ] 플랜 다운그레이드
- [ ] 구독 취소 (즉시)
- [ ] 구독 취소 (기간 만료 시)

### 서비스 제한
- [ ] past_due 상태에서 제한 적용
- [ ] suspended 상태에서 읽기 전용
- [ ] 결제 복구 후 제한 해제

## 보안 고려사항

1. **웹훅 검증**: PortOne 웹훅 서명 검증 (`PortOne.Webhook.verify`)
2. **API 인증**: admin 역할만 결제 관련 API 접근 가능
3. **환경변수**: 민감한 키는 환경변수로만 관리
4. **멱등성**: 웹훅 webhookId로 중복 처리 방지

## 참고 자료

- [PortOne V2 개발자 문서](https://developers.portone.io/)
- [PortOne 빌링키 발급 가이드](https://developers.portone.io/opi/ko/integration/billing-key/readme?v=v2)
- [PortOne 웹훅 가이드](https://developers.portone.io/opi/ko/integration/webhook/readme?v=v2)
- [PortOne Server SDK](https://developers.portone.io/sdk/server?v=v2)
- [PortOne Browser SDK](https://developers.portone.io/sdk/browser?v=v2)
