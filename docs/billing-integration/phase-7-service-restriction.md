# Phase 7: 서비스 제한 로직

## 개요

이 Phase에서는 구독 상태에 따른 서비스 제한 로직을 구현합니다:
- 구독 상태별 제한 정책 정의
- API 라우트에 제한 미들웨어 적용
- 사용자에게 제한 상태 안내

## 7.1 구독 정책 정의

### 신규 파일
`lib/billing/subscription-policy.ts`

```typescript
/**
 * 구독 상태 타입
 */
export type SubscriptionStatus =
  | 'none'       // 구독 없음 (무료)
  | 'pending'    // 구독 생성됨, 빌링키 미등록
  | 'active'     // 정상 활성 상태
  | 'past_due'   // 결제 실패, 유예기간 중
  | 'suspended'  // 서비스 일시 정지
  | 'canceled'   // 취소됨
  | 'expired';   // 만료됨

/**
 * 서비스 접근 레벨
 */
export type ServiceAccess =
  | 'full'       // 전체 접근
  | 'limited'    // 제한된 접근 (신규 생성 불가)
  | 'read_only'  // 읽기 전용
  | 'none';      // 접근 불가

/**
 * 제한되는 작업 타입
 */
export type RestrictedAction =
  | 'create_chatbot'
  | 'create_dataset'
  | 'upload_document'
  | 'api_access'
  | 'chat_message'
  | 'export_data';

/**
 * 구독 상태별 정책
 */
export interface SubscriptionPolicy {
  serviceAccess: ServiceAccess;
  gracePeriodDays?: number;
  restrictions: RestrictedAction[];
  message: string;
}

/**
 * 구독 상태별 정책 정의
 */
export const SUBSCRIPTION_POLICIES: Record<SubscriptionStatus, SubscriptionPolicy> = {
  none: {
    serviceAccess: 'limited',
    restrictions: ['api_access'],
    message: '무료 플랜입니다. 더 많은 기능을 사용하려면 구독하세요.',
  },
  pending: {
    serviceAccess: 'limited',
    restrictions: ['api_access'],
    message: '결제 수단을 등록하면 서비스를 이용할 수 있습니다.',
  },
  active: {
    serviceAccess: 'full',
    restrictions: [],
    message: '',
  },
  past_due: {
    serviceAccess: 'limited',
    gracePeriodDays: 7,
    restrictions: ['create_chatbot', 'create_dataset', 'upload_document'],
    message: '결제에 실패했습니다. 7일 이내에 결제 수단을 확인해주세요.',
  },
  suspended: {
    serviceAccess: 'read_only',
    gracePeriodDays: 30,
    restrictions: [
      'create_chatbot',
      'create_dataset',
      'upload_document',
      'api_access',
      'chat_message',
    ],
    message: '결제 실패로 서비스가 일시 정지되었습니다. 결제 수단을 업데이트해주세요.',
  },
  canceled: {
    serviceAccess: 'none',
    restrictions: [
      'create_chatbot',
      'create_dataset',
      'upload_document',
      'api_access',
      'chat_message',
      'export_data',
    ],
    message: '구독이 취소되었습니다. 데이터는 30일 후 삭제됩니다.',
  },
  expired: {
    serviceAccess: 'none',
    restrictions: [
      'create_chatbot',
      'create_dataset',
      'upload_document',
      'api_access',
      'chat_message',
      'export_data',
    ],
    message: '구독이 만료되었습니다. 다시 구독하려면 플랜을 선택하세요.',
  },
};

/**
 * 특정 작업이 제한되는지 확인
 */
export function isActionRestricted(
  status: SubscriptionStatus,
  action: RestrictedAction
): boolean {
  const policy = SUBSCRIPTION_POLICIES[status];
  return policy.restrictions.includes(action);
}

/**
 * 서비스 접근 가능 여부 확인
 */
export function canAccessService(status: SubscriptionStatus): boolean {
  const policy = SUBSCRIPTION_POLICIES[status];
  return policy.serviceAccess !== 'none';
}

/**
 * 쓰기 작업 가능 여부 확인
 */
export function canWriteData(status: SubscriptionStatus): boolean {
  const policy = SUBSCRIPTION_POLICIES[status];
  return policy.serviceAccess === 'full' || policy.serviceAccess === 'limited';
}

/**
 * 제한 메시지 반환
 */
export function getRestrictionMessage(
  status: SubscriptionStatus,
  action?: RestrictedAction
): string {
  const policy = SUBSCRIPTION_POLICIES[status];

  if (action && policy.restrictions.includes(action)) {
    const actionMessages: Record<RestrictedAction, string> = {
      create_chatbot: '현재 상태에서는 새 챗봇을 생성할 수 없습니다.',
      create_dataset: '현재 상태에서는 새 데이터셋을 생성할 수 없습니다.',
      upload_document: '현재 상태에서는 문서를 업로드할 수 없습니다.',
      api_access: 'API 접근이 제한되어 있습니다.',
      chat_message: '현재 상태에서는 채팅을 이용할 수 없습니다.',
      export_data: '현재 상태에서는 데이터를 내보낼 수 없습니다.',
    };
    return actionMessages[action];
  }

  return policy.message;
}
```

---

## 7.2 구독 상태 조회 유틸리티

### 신규 파일
`lib/billing/get-subscription-status.ts`

```typescript
import { db } from '@/lib/db';
import { subscriptions } from '@/drizzle/schema';
import { eq } from 'drizzle-orm';
import { SubscriptionStatus } from './subscription-policy';

/**
 * 테넌트의 구독 상태를 조회합니다.
 */
export async function getSubscriptionStatus(
  tenantId: string
): Promise<SubscriptionStatus> {
  const [subscription] = await db
    .select({ status: subscriptions.status })
    .from(subscriptions)
    .where(eq(subscriptions.tenantId, tenantId))
    .limit(1);

  if (!subscription) {
    return 'none';
  }

  return subscription.status as SubscriptionStatus;
}

/**
 * 캐시된 구독 상태 조회 (Redis 사용 시)
 */
export async function getCachedSubscriptionStatus(
  tenantId: string
): Promise<SubscriptionStatus> {
  // TODO: Redis 캐시 구현 시
  // const cached = await redis.get(`subscription:${tenantId}`);
  // if (cached) return cached as SubscriptionStatus;

  const status = await getSubscriptionStatus(tenantId);

  // await redis.set(`subscription:${tenantId}`, status, 'EX', 300); // 5분 캐시

  return status;
}
```

---

## 7.3 API 미들웨어

### 신규 파일
`lib/middleware/subscription-guard.ts`

```typescript
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { getSubscriptionStatus } from '@/lib/billing/get-subscription-status';
import {
  RestrictedAction,
  isActionRestricted,
  getRestrictionMessage,
  canAccessService,
} from '@/lib/billing/subscription-policy';

interface SubscriptionCheckResult {
  allowed: boolean;
  status?: string;
  error?: NextResponse;
}

/**
 * 구독 상태를 확인하고 접근을 제어합니다.
 */
export async function checkSubscription(
  action?: RestrictedAction
): Promise<SubscriptionCheckResult> {
  const session = await getSession();

  if (!session.userId || !session.tenantId) {
    return {
      allowed: false,
      error: NextResponse.json(
        { error: '로그인이 필요합니다.' },
        { status: 401 }
      ),
    };
  }

  const status = await getSubscriptionStatus(session.tenantId);

  // 서비스 접근 불가
  if (!canAccessService(status)) {
    return {
      allowed: false,
      status,
      error: NextResponse.json(
        {
          error: getRestrictionMessage(status),
          code: 'SUBSCRIPTION_INACTIVE',
          status,
        },
        { status: 403 }
      ),
    };
  }

  // 특정 작업 제한
  if (action && isActionRestricted(status, action)) {
    return {
      allowed: false,
      status,
      error: NextResponse.json(
        {
          error: getRestrictionMessage(status, action),
          code: 'ACTION_RESTRICTED',
          action,
          status,
        },
        { status: 403 }
      ),
    };
  }

  return { allowed: true, status };
}

/**
 * 구독 가드 래퍼
 *
 * 특정 작업에 대한 접근 제어를 적용합니다.
 */
export function withSubscriptionGuard(action: RestrictedAction) {
  return async function guard() {
    return checkSubscription(action);
  };
}
```

---

## 7.4 API 라우트에 적용

### 예시: 챗봇 생성 API
`app/api/chatbots/route.ts`

```typescript
import { NextResponse } from 'next/server';
import { checkSubscription } from '@/lib/middleware/subscription-guard';

export async function POST(request: Request) {
  // 구독 상태 확인
  const subscriptionCheck = await checkSubscription('create_chatbot');
  if (!subscriptionCheck.allowed) {
    return subscriptionCheck.error;
  }

  // 기존 로직...
  try {
    const body = await request.json();
    // 챗봇 생성 로직
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: '챗봇 생성에 실패했습니다.' },
      { status: 500 }
    );
  }
}
```

### 예시: 문서 업로드 API
`app/api/documents/route.ts`

```typescript
import { NextResponse } from 'next/server';
import { checkSubscription } from '@/lib/middleware/subscription-guard';

export async function POST(request: Request) {
  const subscriptionCheck = await checkSubscription('upload_document');
  if (!subscriptionCheck.allowed) {
    return subscriptionCheck.error;
  }

  // 기존 업로드 로직...
}
```

### 예시: 채팅 API
`app/api/chat/route.ts`

```typescript
import { NextResponse } from 'next/server';
import { checkSubscription } from '@/lib/middleware/subscription-guard';

export async function POST(request: Request) {
  const subscriptionCheck = await checkSubscription('chat_message');
  if (!subscriptionCheck.allowed) {
    return subscriptionCheck.error;
  }

  // 기존 채팅 로직...
}
```

---

## 7.5 적용할 API 목록

| API 경로 | 작업 | 제한 시작 상태 |
|----------|------|---------------|
| `POST /api/chatbots` | create_chatbot | past_due |
| `POST /api/datasets` | create_dataset | past_due |
| `POST /api/documents` | upload_document | past_due |
| `POST /api/documents/[id]/upload` | upload_document | past_due |
| `POST /api/chat` | chat_message | suspended |
| `POST /api/chat/[id]/message` | chat_message | suspended |
| `GET /api/v1/*` | api_access | past_due |
| `POST /api/v1/*` | api_access | past_due |
| `GET /api/export/*` | export_data | canceled |

---

## 7.6 클라이언트 상태 표시

### 신규 파일
`components/billing/subscription-banner.tsx`

```tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, CreditCard, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface SubscriptionInfo {
  status: string;
  message: string;
}

export function SubscriptionBanner() {
  const [info, setInfo] = useState<SubscriptionInfo | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    fetchSubscriptionInfo();
  }, []);

  const fetchSubscriptionInfo = async () => {
    try {
      const res = await fetch('/api/billing/subscription');
      const data = await res.json();

      if (data.subscription) {
        const status = data.subscription.status;

        // 경고가 필요한 상태만 표시
        if (['past_due', 'suspended', 'canceled', 'expired'].includes(status)) {
          setInfo({
            status,
            message: getStatusMessage(status),
          });
        }
      }
    } catch (error) {
      console.error('구독 정보 조회 실패:', error);
    }
  };

  const getStatusMessage = (status: string): string => {
    const messages: Record<string, string> = {
      past_due: '결제에 실패했습니다. 결제 수단을 확인해주세요.',
      suspended: '서비스가 일시 정지되었습니다. 결제 수단을 업데이트해주세요.',
      canceled: '구독이 취소되었습니다.',
      expired: '구독이 만료되었습니다.',
    };
    return messages[status] || '';
  };

  const getStatusColor = (status: string): string => {
    if (['suspended', 'canceled', 'expired'].includes(status)) {
      return 'bg-destructive/10 border-destructive text-destructive';
    }
    return 'bg-yellow-500/10 border-yellow-500 text-yellow-600 dark:text-yellow-500';
  };

  if (!info || dismissed) return null;

  return (
    <div className={`border-b p-3 ${getStatusColor(info.status)}`}>
      <div className="container flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 flex-shrink-0" />
          <span className="text-sm font-medium">{info.message}</span>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/billing/recovery">
            <Button size="sm" variant="outline" className="gap-1">
              <CreditCard className="h-4 w-4" />
              결제 복구
            </Button>
          </Link>
          <button
            onClick={() => setDismissed(true)}
            className="p-1 hover:opacity-70"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
```

### 레이아웃에 배너 추가
`app/(portal)/layout.tsx`

```tsx
import { SubscriptionBanner } from '@/components/billing/subscription-banner';

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <SubscriptionBanner />
      <Header />
      <main>{children}</main>
    </div>
  );
}
```

---

## 7.7 제한 상태 모달

### 신규 파일
`components/billing/restriction-modal.tsx`

사용자가 제한된 작업을 시도할 때 표시되는 모달입니다.

```tsx
'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { AlertTriangle } from 'lucide-react';

interface RestrictionModalProps {
  open: boolean;
  onClose: () => void;
  message: string;
  action?: string;
}

export function RestrictionModal({
  open,
  onClose,
  message,
  action,
}: RestrictionModalProps) {
  const router = useRouter();

  const handleRecover = () => {
    onClose();
    router.push('/billing/recovery');
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-6 w-6 text-destructive" />
            <DialogTitle className="text-foreground">작업 제한</DialogTitle>
          </div>
          <DialogDescription>{message}</DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <p className="text-sm text-muted-foreground">
            서비스를 계속 이용하시려면 결제 수단을 확인하고 업데이트해주세요.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            닫기
          </Button>
          <Button onClick={handleRecover}>결제 복구하기</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

### 사용 예시

```tsx
'use client';

import { useState } from 'react';
import { RestrictionModal } from '@/components/billing/restriction-modal';

export function CreateChatbotButton() {
  const [showRestriction, setShowRestriction] = useState(false);
  const [restrictionMessage, setRestrictionMessage] = useState('');

  const handleCreate = async () => {
    try {
      const res = await fetch('/api/chatbots', {
        method: 'POST',
        // ...
      });

      if (res.status === 403) {
        const data = await res.json();
        if (data.code === 'ACTION_RESTRICTED') {
          setRestrictionMessage(data.error);
          setShowRestriction(true);
          return;
        }
      }

      // 정상 처리...
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <>
      <button onClick={handleCreate}>새 챗봇 만들기</button>

      <RestrictionModal
        open={showRestriction}
        onClose={() => setShowRestriction(false)}
        message={restrictionMessage}
      />
    </>
  );
}
```

---

## 7.8 React Hook

### 신규 파일
`hooks/use-subscription.ts`

```typescript
'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  SubscriptionStatus,
  RestrictedAction,
  isActionRestricted,
  getRestrictionMessage,
} from '@/lib/billing/subscription-policy';

interface SubscriptionData {
  status: SubscriptionStatus;
  planName?: string;
  nextBillingDate?: string;
  billingKeyMasked?: string;
}

export function useSubscription() {
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSubscription();
  }, []);

  const fetchSubscription = async () => {
    try {
      const res = await fetch('/api/billing/subscription');
      const data = await res.json();

      if (data.subscription) {
        setSubscription({
          status: data.subscription.status as SubscriptionStatus,
          planName: data.plan?.name,
          nextBillingDate: data.subscription.nextBillingDate,
          billingKeyMasked: data.subscription.billingKeyMasked,
        });
      } else {
        setSubscription({ status: 'none' });
      }
    } catch (error) {
      console.error('구독 조회 실패:', error);
      setSubscription({ status: 'none' });
    } finally {
      setLoading(false);
    }
  };

  const checkAction = useCallback(
    (action: RestrictedAction): { allowed: boolean; message?: string } => {
      if (!subscription) {
        return { allowed: false, message: '구독 정보를 확인 중입니다.' };
      }

      const restricted = isActionRestricted(subscription.status, action);

      if (restricted) {
        return {
          allowed: false,
          message: getRestrictionMessage(subscription.status, action),
        };
      }

      return { allowed: true };
    },
    [subscription]
  );

  const needsRecovery =
    subscription?.status === 'past_due' ||
    subscription?.status === 'suspended';

  const isActive = subscription?.status === 'active';

  return {
    subscription,
    loading,
    checkAction,
    needsRecovery,
    isActive,
    refresh: fetchSubscription,
  };
}
```

### 사용 예시

```tsx
'use client';

import { useSubscription } from '@/hooks/use-subscription';

export function MyComponent() {
  const { checkAction, needsRecovery } = useSubscription();

  const handleCreate = () => {
    const { allowed, message } = checkAction('create_chatbot');

    if (!allowed) {
      alert(message);
      return;
    }

    // 생성 로직...
  };

  return (
    <div>
      {needsRecovery && (
        <div className="bg-destructive/10 p-4">결제 복구가 필요합니다.</div>
      )}
      <button onClick={handleCreate}>새 챗봇</button>
    </div>
  );
}
```

---

## 체크리스트

- [ ] `lib/billing/subscription-policy.ts` 정책 정의
- [ ] `lib/billing/get-subscription-status.ts` 상태 조회
- [ ] `lib/middleware/subscription-guard.ts` 미들웨어 구현
- [ ] 다음 API에 가드 적용:
  - [ ] `POST /api/chatbots`
  - [ ] `POST /api/datasets`
  - [ ] `POST /api/documents`
  - [ ] `POST /api/chat`
  - [ ] `GET/POST /api/v1/*`
  - [ ] `GET /api/export/*`
- [ ] `components/billing/subscription-banner.tsx` 배너 컴포넌트
- [ ] `components/billing/restriction-modal.tsx` 제한 모달
- [ ] `hooks/use-subscription.ts` 클라이언트 훅
- [ ] 레이아웃에 배너 추가
- [ ] 통합 테스트

---

## 테스트 시나리오

### 상태별 테스트

1. **active 상태**
   - 모든 기능 정상 동작 확인

2. **past_due 상태**
   - 챗봇/데이터셋/문서 생성 차단 확인
   - 기존 데이터 읽기 가능 확인
   - 배너 표시 확인

3. **suspended 상태**
   - 채팅 차단 확인
   - API 접근 차단 확인
   - 읽기 전용 모드 확인

4. **canceled/expired 상태**
   - 모든 쓰기 작업 차단 확인
   - 데이터 내보내기 차단 확인

---

## 완료

이로써 토스 페이먼츠 정기결제 시스템 통합의 모든 Phase가 완료되었습니다.

### 전체 구현 요약

| Phase | 내용 |
|-------|------|
| Phase 1 | DB 스키마, 환경설정, 암호화 유틸리티 |
| Phase 2 | 토스 API 클라이언트, 웹훅 보안 |
| Phase 3 | 결제 API 엔드포인트 |
| Phase 4 | Inngest 비동기 결제 처리 |
| Phase 5 | Vercel Cron 정기결제 트리거 |
| Phase 6 | 클라이언트 UI |
| Phase 7 | 서비스 제한 로직 |

### 다음 단계

1. 각 Phase 순서대로 구현
2. 단위 테스트 작성
3. 토스 테스트 환경에서 통합 테스트
4. 스테이징 환경 배포 및 QA
5. 프로덕션 배포
