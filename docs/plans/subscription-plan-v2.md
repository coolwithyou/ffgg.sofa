# SOFA 구독 플랜 V2 설계 문서

> **문서 버전**: 1.0
> **작성일**: 2025-01-05
> **상태**: 설계 완료, 구현 대기

---

## 목차

1. [개요](#개요)
2. [플랜 구조](#플랜-구조)
3. [포인트 시스템](#포인트-시스템)
4. [상수 설계](#상수-설계)
5. [데이터 모델](#데이터-모델)
6. [구현 가이드](#구현-가이드)
7. [마이그레이션](#마이그레이션)

---

## 개요

### 배경

기존 구독 플랜(Basic/Standard/Premium)을 새로운 구조(Free/Pro/Business)로 개편하고, 포인트 기반 과금 시스템을 도입합니다.

### 핵심 변경사항

| 항목 | 기존 | 변경 |
|------|------|------|
| 플랜 이름 | Basic/Standard/Premium | Free/Pro/Business |
| 과금 방식 | 월간 대화 수 제한 | 포인트 기반 (1P = 1 AI 응답) |
| 무료 플랜 | 기능 제한 | 모든 기능 체험, 배포만 제한 |
| 배포 | Boolean 플래그 | 티어별 개수 제한 |

---

## 플랜 구조

### 플랜별 상세 스펙

#### Free (무료)

| 항목 | 값 | 비고 |
|------|-----|------|
| **월 가격** | ₩0 | - |
| **연 가격** | ₩0 | - |
| **체험 포인트** | 500P | 1회성, 가입 시 지급 |
| **월 포인트** | 0P | 추가 구매만 가능 |
| **챗봇** | 3개 | - |
| **데이터셋** | 3개 | 챗봇당 1개 (1:1) |
| **문서/챗봇** | 10개 | - |
| **총 문서** | 30개 | 3 챗봇 × 10 문서 |
| **저장공간** | 100MB | - |
| **버전 이력** | 1개 | - |
| **배포** | 0개 | 미리보기만 가능 |
| **API 액세스** | ❌ | - |
| **커스텀 도메인** | ❌ | - |
| **지원** | 커뮤니티 | - |

#### Pro (월 ₩50,000)

| 항목 | 값 | 비고 |
|------|-----|------|
| **월 가격** | ₩50,000 | - |
| **연 가격** | ₩500,000 | 17% 할인 |
| **월 포인트** | 3,000P | AI 응답 ~300회 |
| **챗봇** | 3개 | - |
| **데이터셋** | 3개 | 챗봇당 1개 (1:1) |
| **문서/챗봇** | 33개 | - |
| **총 문서** | 100개 | - |
| **저장공간** | 1GB | - |
| **버전 이력** | 10개 | - |
| **배포** | 1개 | - |
| **API 액세스** | ❌ | - |
| **커스텀 도메인** | ❌ | - |
| **지원** | 이메일 | - |

#### Business (월 ₩150,000)

| 항목 | 값 | 비고 |
|------|-----|------|
| **월 가격** | ₩150,000 | - |
| **연 가격** | ₩1,500,000 | 17% 할인 |
| **월 포인트** | 10,000P | AI 응답 ~1,000회 |
| **챗봇** | 10개 | - |
| **데이터셋** | 10개 | 챗봇당 1개 (1:1) |
| **문서/챗봇** | 50개 | - |
| **총 문서** | 500개 | - |
| **저장공간** | 10GB | - |
| **버전 이력** | 30개 | - |
| **배포** | 3개 | - |
| **API 액세스** | ✅ | - |
| **커스텀 도메인** | ✅ | - |
| **지원** | 슬랙/카톡 우선 응대 | - |

### 플랜 비교표

| 기능 | Free | Pro | Business |
|------|------|-----|----------|
| **가격** | ₩0 | ₩50,000/월 | ₩150,000/월 |
| **포인트** | 500P (1회) | 3,000P/월 | 10,000P/월 |
| **챗봇** | 3 | 3 | 10 |
| **총 문서** | 30 | 100 | 500 |
| **저장공간** | 100MB | 1GB | 10GB |
| **버전 이력** | 1 | 10 | 30 |
| **배포** | ❌ | 1개 | 3개 |
| **커스텀 도메인** | ❌ | ❌ | ✅ |
| **API 액세스** | ❌ | ❌ | ✅ |

---

## 포인트 시스템

### 개요

- **1P = 1 AI 응답** (GPT/Claude 등 모델 호출 1회)
- 포인트는 월초에 자동 충전 (구독 플랜)
- 잔여 포인트는 익월 이월되지 않음
- 추가 포인트는 별도 구매 가능

### 추가 포인트 패키지

| 패키지 | 포인트 | 가격 | 단가 | 할인율 |
|--------|--------|------|------|--------|
| 기본 | 5,000P | ₩30,000 | 6원/P | - |
| 대용량 | 10,000P | ₩50,000 | 5원/P | 17% |

### 포인트 사용 정책

```
포인트 차감 시점: AI 응답 생성 완료 후
포인트 부족 시: 402 Payment Required 응답
    → "포인트가 부족합니다. 포인트를 충전해주세요."
    → 충전 페이지로 유도
```

### 체험 포인트 정책

- **지급 시점**: 신규 가입 시 1회
- **유효 기간**: 무제한 (사용 전까지)
- **재지급**: 불가 (계정당 1회)
- **용도**: 모든 AI 기능 체험

---

## 상수 설계

모든 수치는 상수로 관리하여 쉽게 조절 가능합니다.

### 파일 위치

```
lib/
├── tier/
│   ├── constants.ts      # 티어별 제한 상수
│   └── types.ts          # 타입 정의
├── points/
│   └── constants.ts      # 포인트 관련 상수
└── billing/
    └── constants.ts      # 가격 관련 상수
```

### 티어 제한 상수 (`lib/tier/constants.ts`)

```typescript
/**
 * 티어별 제한 상수 정의
 *
 * 수치 조정 시 이 파일만 수정하면 됩니다.
 */
export const TIER_LIMITS = {
  free: {
    // 리소스 제한
    maxChatbots: 3,
    maxDatasets: 3,                    // = maxChatbots (1:1)
    maxDocumentsPerDataset: 10,
    maxTotalDocuments: 30,             // 3 × 10
    maxStorageBytes: 100 * 1024 * 1024, // 100MB
    maxChunksPerDocument: 100,

    // 버전 관리
    maxPublishHistory: 1,

    // 배포 제한
    maxDeployments: 0,
    canDeploy: false,

    // 포인트
    monthlyPoints: 0,

    // API Rate Limiting
    apiRequestsPerMinute: 60,
    chatRequestsPerDay: 100,
    uploadRequestsPerHour: 10,
  },

  pro: {
    maxChatbots: 3,
    maxDatasets: 3,
    maxDocumentsPerDataset: 33,
    maxTotalDocuments: 100,
    maxStorageBytes: 1024 * 1024 * 1024, // 1GB
    maxChunksPerDocument: 500,

    maxPublishHistory: 10,

    maxDeployments: 1,
    canDeploy: true,

    monthlyPoints: 3000,

    apiRequestsPerMinute: 300,
    chatRequestsPerDay: 1000,
    uploadRequestsPerHour: 50,
  },

  business: {
    maxChatbots: 10,
    maxDatasets: 10,
    maxDocumentsPerDataset: 50,
    maxTotalDocuments: 500,
    maxStorageBytes: 10 * 1024 * 1024 * 1024, // 10GB
    maxChunksPerDocument: 1000,

    maxPublishHistory: 30,

    maxDeployments: 3,
    canDeploy: true,

    monthlyPoints: 10000,

    apiRequestsPerMinute: 1000,
    chatRequestsPerDay: 10000,
    uploadRequestsPerHour: 200,
  },
} as const;

/**
 * 티어별 기능 활성화
 */
export const TIER_FEATURES = {
  free: {
    customDomain: false,
    apiAccess: false,
    prioritySupport: false,
    advancedAnalytics: false,
  },
  pro: {
    customDomain: false,
    apiAccess: false,
    prioritySupport: false,
    advancedAnalytics: true,
  },
  business: {
    customDomain: true,
    apiAccess: true,
    prioritySupport: true,
    advancedAnalytics: true,
  },
} as const;

export type Tier = 'free' | 'pro' | 'business';
```

### 가격 상수 (`lib/billing/constants.ts`)

```typescript
/**
 * 플랜 가격 정보
 *
 * 가격 변경 시 이 파일만 수정하면 됩니다.
 */
export const PLAN_PRICING = {
  free: {
    monthlyPrice: 0,
    yearlyPrice: 0,
    yearlyDiscount: 0,
  },
  pro: {
    monthlyPrice: 50000,          // ₩50,000
    yearlyPrice: 500000,          // ₩500,000 (17% 할인)
    yearlyDiscount: 0.17,
  },
  business: {
    monthlyPrice: 150000,         // ₩150,000
    yearlyPrice: 1500000,         // ₩1,500,000 (17% 할인)
    yearlyDiscount: 0.17,
  },
} as const;

/**
 * 추가 포인트 패키지
 */
export const POINT_PACKAGES = {
  points_5000: {
    id: 'points_5000',
    name: '5,000 포인트',
    points: 5000,
    price: 30000,                 // ₩30,000
    pricePerPoint: 6,
    discount: 0,
  },
  points_10000: {
    id: 'points_10000',
    name: '10,000 포인트',
    points: 10000,
    price: 50000,                 // ₩50,000
    pricePerPoint: 5,
    discount: 0.17,               // 17% 할인
  },
} as const;
```

### 포인트 상수 (`lib/points/constants.ts`)

```typescript
/**
 * 포인트 시스템 상수
 */
export const POINTS = {
  // 체험 포인트
  FREE_TRIAL_POINTS: 500,

  // AI 응답당 포인트 소비
  POINTS_PER_RESPONSE: 1,

  // 최소 잔액 경고 임계값
  LOW_BALANCE_THRESHOLD: 100,

  // 포인트 만료 (구독 포인트는 월말 만료, 구매 포인트는 무제한)
  SUBSCRIPTION_POINTS_EXPIRE: true,
  PURCHASED_POINTS_EXPIRE: false,
} as const;
```

---

## 데이터 모델

### 새로 추가되는 테이블

#### tenant_points (포인트 잔액)

```sql
CREATE TABLE tenant_points (
  tenant_id UUID PRIMARY KEY REFERENCES tenants(id),
  balance INTEGER NOT NULL DEFAULT 0,
  free_points_used BOOLEAN DEFAULT FALSE,
  last_recharged_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### point_transactions (포인트 이력)

```sql
CREATE TABLE point_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id),
  type VARCHAR(20) NOT NULL,  -- 'charge', 'use', 'refund', 'expire'
  amount INTEGER NOT NULL,     -- 양수: 충전, 음수: 사용
  balance INTEGER NOT NULL,    -- 트랜잭션 후 잔액
  description TEXT,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 인덱스
CREATE INDEX idx_point_transactions_tenant ON point_transactions(tenant_id);
CREATE INDEX idx_point_transactions_created ON point_transactions(created_at);
```

#### point_packages (포인트 패키지)

```sql
CREATE TABLE point_packages (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  points INTEGER NOT NULL,
  price INTEGER NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  sort_order INTEGER DEFAULT 0
);
```

### 기존 테이블 수정

#### plans 테이블

```typescript
// limits 필드에 추가
limits: {
  // 기존 필드...
  maxDeployments: number;      // 🆕 배포 개수 제한
  monthlyPoints: number;       // 🆕 월간 포인트
}

// features 필드에 추가
features: {
  // 기존 필드...
  customDomain: boolean;       // 🆕 커스텀 도메인
  apiAccess: boolean;          // 🆕 API 액세스
  canDeploy: boolean;          // 🆕 배포 가능 여부
}
```

---

## 구현 가이드

### Phase 1: 데이터 모델 (2-3시간)

1. `drizzle/schema.ts`에 새 테이블 추가
2. `drizzle/seed/plans.ts` 플랜 데이터 업데이트
3. `drizzle/seed/point-packages.ts` 시드 파일 생성
4. 마이그레이션 실행

### Phase 2: 포인트 시스템 (3-4시간)

1. `lib/points/` 디렉토리 생성
2. 포인트 서비스 구현 (`service.ts`)
3. 포인트 검증 함수 구현 (`validator.ts`)
4. AI 응답 시 포인트 차감 로직 추가

### Phase 3: 배포 제한 (1-2시간)

1. `lib/tier/constants.ts` 업데이트
2. `lib/tier/validator.ts`에 `canDeploy()` 함수 추가
3. 배포 API에 검증 로직 적용

### Phase 4: API 라우트 (2-3시간)

1. `GET /api/points` - 잔액 조회
2. `GET /api/points/packages` - 패키지 목록
3. `POST /api/points/purchase` - 포인트 구매
4. 웹훅 핸들러에 포인트 충전 로직 추가

### Phase 5: 프론트엔드 (4-5시간)

1. **사이드바 포인트 현황 위젯** (NavPointsStatus 컴포넌트)
2. 구독 페이지 포인트 잔액 표시
3. 플랜 선택 페이지 UI 업데이트
4. 포인트 구매 페이지 신규 생성
5. 배포 제한 안내 모달

#### 5.1 사이드바 포인트 현황 위젯

**위치**: `SidebarFooter` 내, `NavUser` 위
**파일**: `app/(console)/console/components/nav/app-sidebar.tsx`

```
┌─────────────────────────┐
│ ...메뉴...              │
├─────────────────────────┤
│ 💎 1,234 P              │  ← 잔여 포인트
│ ████████░░ 41% 사용     │  ← 프로그레스 바
│ 이번 달 500P 사용       │  ← 사용량 텍스트
├─────────────────────────┤
│ [👤] 사용자명      ▾   │
└─────────────────────────┘
```

**동작**:
- 클릭 시 포인트 충전 페이지로 이동 (`/console/account/subscription/points`)
- 포인트 부족 시 (100P 이하) 경고 스타일 적용 (빨간색)
- 사이드바 축소 시 아이콘만 표시 (💎)

**컴포넌트 구조**:
```typescript
function NavPointsStatus() {
  const { balance, used, total } = usePointsStatus(); // 신규 훅
  const usagePercent = total > 0 ? (used / total) * 100 : 0;
  const isLow = balance <= 100;

  return (
    <Link href="/console/account/subscription/points">
      <div className="px-3 py-2 rounded-lg hover:bg-sidebar-accent">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">
            💎 {balance.toLocaleString()} P
          </span>
          {isLow && <Badge variant="destructive">부족</Badge>}
        </div>
        <Progress value={usagePercent} className="h-1.5 mt-1" />
        <span className="text-xs text-muted-foreground">
          이번 달 {used.toLocaleString()}P 사용
        </span>
      </div>
    </Link>
  );
}
```

### Phase 6: Cron 작업 (1-2시간)

1. 월간 포인트 자동 충전 크론
2. 체험 포인트 지급 로직 (회원가입 시)

---

## 마이그레이션

### 플랜 매핑

| 기존 | 신규 | 처리 |
|------|------|------|
| Basic | Free | 자동 전환 |
| Standard | Pro | 자동 전환 + 포인트 지급 |
| Premium | Business | 자동 전환 + 포인트 지급 |

### 기존 사용자 포인트 지급

```sql
-- 기존 구독 사용자에게 잔여 기간 비례 포인트 지급
-- (예: Pro 플랜, 남은 기간 15일 → 3000 × 15/30 = 1500P)
```

### 롤백 계획

문제 발생 시 기존 플랜으로 복구 가능하도록:
1. 기존 플랜 데이터 백업
2. 기능 플래그로 신규 시스템 on/off
3. 포인트 테이블은 별도 관리 (기존 로직 영향 없음)

---

## 부록: 상수 변경 예시

### 가격 변경

```typescript
// lib/billing/constants.ts
export const PLAN_PRICING = {
  pro: {
    monthlyPrice: 50000,    // ← 이 값만 변경
    yearlyPrice: 500000,
    yearlyDiscount: 0.17,
  },
  // ...
};
```

### 포인트 수량 변경

```typescript
// lib/tier/constants.ts
export const TIER_LIMITS = {
  pro: {
    monthlyPoints: 3000,    // ← 이 값만 변경
    // ...
  },
  // ...
};
```

### 배포 개수 변경

```typescript
// lib/tier/constants.ts
export const TIER_LIMITS = {
  business: {
    maxDeployments: 3,      // ← 이 값만 변경
    // ...
  },
  // ...
};
```

---

## 체크리스트

### 기능 검증

- [ ] Free 사용자 배포 시도 → 업그레이드 유도 모달
- [ ] Pro 사용자 2번째 배포 → 제한 안내
- [ ] AI 응답 시 1P 차감
- [ ] 포인트 0 시 402 에러 + 안내
- [ ] 추가 포인트 구매 후 즉시 반영
- [ ] 월간 포인트 자동 충전
- [ ] 체험 포인트 1회성 지급

### 보안

- [ ] 포인트 조작 방지 (서버사이드 검증)
- [ ] 결제 웹훅 서명 검증
- [ ] Rate limiting 적용

### UX

- [ ] 포인트 부족 사전 경고 (100P 이하)
- [ ] 사용량 대시보드
- [ ] 플랜 비교표
