# Phase 6: 클라이언트 UI

## 개요

이 Phase에서는 결제 관련 프론트엔드 UI를 구현합니다:
- 토스 SDK 연동
- 플랜 선택 페이지
- 결제 콜백 페이지
- 구독 관리 페이지 개선
- 결제 내역 페이지

## 6.1 토스 SDK 연동

### 신규 파일
`lib/toss/sdk.ts`

```typescript
'use client';

import { loadTossPayments, TossPayments } from '@tosspayments/payment-sdk';

let tossPayments: TossPayments | null = null;

/**
 * 토스페이먼츠 SDK를 로드합니다.
 */
export async function getTossPayments(): Promise<TossPayments> {
  if (tossPayments) {
    return tossPayments;
  }

  const clientKey = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY;
  if (!clientKey) {
    throw new Error('NEXT_PUBLIC_TOSS_CLIENT_KEY가 설정되지 않았습니다.');
  }

  tossPayments = await loadTossPayments(clientKey);
  return tossPayments;
}

/**
 * 빌링키 인증을 요청합니다.
 */
export async function requestBillingAuth(params: {
  customerKey: string;
  successUrl: string;
  failUrl: string;
}) {
  const toss = await getTossPayments();

  await toss.requestBillingAuth({
    method: 'CARD',
    customerKey: params.customerKey,
    successUrl: params.successUrl,
    failUrl: params.failUrl,
  });
}

/**
 * 결제창을 여는 훅 (React Hook)
 */
export function useTossPayments() {
  const requestBilling = async (customerKey: string) => {
    const baseUrl = window.location.origin;

    await requestBillingAuth({
      customerKey,
      successUrl: `${baseUrl}/billing/success`,
      failUrl: `${baseUrl}/billing/fail`,
    });
  };

  return { requestBilling };
}
```

### 패키지 설치

```bash
pnpm add @tosspayments/payment-sdk
```

---

## 6.2 플랜 선택 페이지

### 신규 파일
`app/(portal)/billing/page.tsx`

```tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTossPayments } from '@/lib/toss/sdk';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Check, Loader2 } from 'lucide-react';

interface Plan {
  id: string;
  name: string;
  monthlyPrice: number;
  features: string[];
}

export default function BillingPage() {
  const router = useRouter();
  const { requestBilling } = useTossPayments();

  const [plans, setPlans] = useState<Plan[]>([]);
  const [currentPlanId, setCurrentPlanId] = useState<string | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    fetchPlans();
    fetchCurrentSubscription();
  }, []);

  const fetchPlans = async () => {
    try {
      const res = await fetch('/api/billing/plans');
      const data = await res.json();
      setPlans(data.plans);
    } catch (error) {
      console.error('플랜 조회 실패:', error);
    }
  };

  const fetchCurrentSubscription = async () => {
    try {
      const res = await fetch('/api/billing/subscription');
      const data = await res.json();
      if (data.subscription) {
        setCurrentPlanId(data.plan?.id || null);
      }
    } catch (error) {
      console.error('구독 조회 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubscribe = async (planId: string) => {
    setProcessing(true);
    setSelectedPlanId(planId);

    try {
      // 구독 생성 (customerKey 발급)
      const res = await fetch('/api/billing/subscription/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error);
      }

      // 토스 결제창 열기
      await requestBilling(data.customerKey);
    } catch (error) {
      console.error('구독 처리 실패:', error);
      alert(error instanceof Error ? error.message : '구독 처리에 실패했습니다.');
    } finally {
      setProcessing(false);
      setSelectedPlanId(null);
    }
  };

  const handleChangePlan = async (planId: string) => {
    if (!confirm('플랜을 변경하시겠습니까? 다음 결제일부터 적용됩니다.')) {
      return;
    }

    setProcessing(true);
    setSelectedPlanId(planId);

    try {
      const res = await fetch('/api/billing/plan/change', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPlanId: planId }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error);
      }

      alert(data.message);
      router.refresh();
    } catch (error) {
      console.error('플랜 변경 실패:', error);
      alert(error instanceof Error ? error.message : '플랜 변경에 실패했습니다.');
    } finally {
      setProcessing(false);
      setSelectedPlanId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="container max-w-5xl py-8">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold text-foreground">플랜 선택</h1>
        <p className="mt-2 text-muted-foreground">
          비즈니스에 맞는 플랜을 선택하세요
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {plans.map((plan) => {
          const isCurrent = plan.id === currentPlanId;
          const isSelected = plan.id === selectedPlanId;

          return (
            <Card
              key={plan.id}
              className={`relative ${isCurrent ? 'border-primary' : ''}`}
            >
              {isCurrent && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground">
                    현재 플랜
                  </span>
                </div>
              )}

              <CardHeader>
                <CardTitle className="text-foreground">{plan.name}</CardTitle>
                <CardDescription>
                  <span className="text-2xl font-bold text-foreground">
                    ₩{plan.monthlyPrice.toLocaleString()}
                  </span>
                  <span className="text-muted-foreground">/월</span>
                </CardDescription>
              </CardHeader>

              <CardContent>
                <ul className="space-y-2">
                  {plan.features.map((feature, idx) => (
                    <li key={idx} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Check className="h-4 w-4 text-primary" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </CardContent>

              <CardFooter>
                {isCurrent ? (
                  <Button disabled className="w-full" variant="secondary">
                    현재 구독 중
                  </Button>
                ) : currentPlanId ? (
                  <Button
                    className="w-full"
                    onClick={() => handleChangePlan(plan.id)}
                    disabled={processing}
                  >
                    {isSelected && processing ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : null}
                    플랜 변경
                  </Button>
                ) : (
                  <Button
                    className="w-full"
                    onClick={() => handleSubscribe(plan.id)}
                    disabled={processing}
                  >
                    {isSelected && processing ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : null}
                    구독하기
                  </Button>
                )}
              </CardFooter>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
```

---

## 6.3 결제 성공 콜백 페이지

### 신규 파일
`app/(portal)/billing/success/page.tsx`

```tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, Loader2, XCircle } from 'lucide-react';

export default function BillingSuccessPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const authKey = searchParams.get('authKey');
    const customerKey = searchParams.get('customerKey');

    if (!authKey || !customerKey) {
      setStatus('error');
      setErrorMessage('인증 정보가 누락되었습니다.');
      return;
    }

    completeBillingKeyRegistration(authKey, customerKey);
  }, [searchParams]);

  const completeBillingKeyRegistration = async (
    authKey: string,
    customerKey: string
  ) => {
    try {
      const res = await fetch('/api/billing/billing-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ authKey, customerKey }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error);
      }

      setStatus('success');
    } catch (error) {
      setStatus('error');
      setErrorMessage(
        error instanceof Error ? error.message : '빌링키 등록에 실패했습니다.'
      );
    }
  };

  return (
    <div className="container flex min-h-[60vh] max-w-md items-center justify-center py-8">
      <Card className="w-full">
        <CardHeader className="text-center">
          {status === 'loading' && (
            <>
              <Loader2 className="mx-auto h-12 w-12 animate-spin text-primary" />
              <CardTitle className="mt-4 text-foreground">결제 수단 등록 중...</CardTitle>
              <CardDescription>잠시만 기다려주세요.</CardDescription>
            </>
          )}

          {status === 'success' && (
            <>
              <CheckCircle className="mx-auto h-12 w-12 text-green-500" />
              <CardTitle className="mt-4 text-foreground">등록 완료!</CardTitle>
              <CardDescription>
                결제 수단이 성공적으로 등록되었습니다.
              </CardDescription>
            </>
          )}

          {status === 'error' && (
            <>
              <XCircle className="mx-auto h-12 w-12 text-destructive" />
              <CardTitle className="mt-4 text-foreground">등록 실패</CardTitle>
              <CardDescription className="text-destructive">
                {errorMessage}
              </CardDescription>
            </>
          )}
        </CardHeader>

        <CardContent className="text-center">
          {status === 'success' && (
            <Button onClick={() => router.push('/mypage/subscription')}>
              구독 관리로 이동
            </Button>
          )}

          {status === 'error' && (
            <div className="space-y-2">
              <Button onClick={() => router.push('/billing')} variant="outline">
                다시 시도
              </Button>
              <Button
                onClick={() => router.push('/mypage/subscription')}
                variant="ghost"
                className="ml-2"
              >
                돌아가기
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
```

---

## 6.4 결제 실패 콜백 페이지

### 신규 파일
`app/(portal)/billing/fail/page.tsx`

```tsx
'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { XCircle } from 'lucide-react';

export default function BillingFailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const code = searchParams.get('code');
  const message = searchParams.get('message');

  // 에러 메시지 한글화
  const getErrorMessage = (code: string | null, message: string | null) => {
    if (code === 'USER_CANCEL') {
      return '결제가 취소되었습니다.';
    }
    return message || '결제 처리 중 문제가 발생했습니다.';
  };

  return (
    <div className="container flex min-h-[60vh] max-w-md items-center justify-center py-8">
      <Card className="w-full">
        <CardHeader className="text-center">
          <XCircle className="mx-auto h-12 w-12 text-destructive" />
          <CardTitle className="mt-4 text-foreground">결제 실패</CardTitle>
          <CardDescription className="text-destructive">
            {getErrorMessage(code, message)}
          </CardDescription>
        </CardHeader>

        <CardContent className="text-center space-y-4">
          <p className="text-sm text-muted-foreground">
            문제가 지속되면 고객센터로 문의해주세요.
          </p>

          <div className="flex justify-center gap-2">
            <Button onClick={() => router.push('/billing')} variant="default">
              다시 시도
            </Button>
            <Button
              onClick={() => router.push('/mypage/subscription')}
              variant="ghost"
            >
              돌아가기
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

---

## 6.5 결제 복구 페이지

### 신규 파일
`app/(portal)/billing/recovery/page.tsx`

결제 실패 후 카드 정보를 다시 등록하는 페이지입니다.

```tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTossPayments } from '@/lib/toss/sdk';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, CreditCard, Loader2 } from 'lucide-react';

interface SubscriptionData {
  status: string;
  failedPaymentCount: number;
  billingKeyMasked: string | null;
  plan: {
    name: string;
    monthlyPrice: number;
  };
}

export default function BillingRecoveryPage() {
  const router = useRouter();
  const { requestBilling } = useTossPayments();

  const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    fetchSubscription();
  }, []);

  const fetchSubscription = async () => {
    try {
      const res = await fetch('/api/billing/subscription');
      const data = await res.json();

      if (data.subscription) {
        setSubscription({
          status: data.subscription.status,
          failedPaymentCount: data.subscription.failedPaymentCount,
          billingKeyMasked: data.subscription.billingKeyMasked,
          plan: data.plan,
        });
      }
    } catch (error) {
      console.error('구독 조회 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateCard = async () => {
    setProcessing(true);

    try {
      // 기존 카드 삭제
      await fetch('/api/billing/billing-key', { method: 'DELETE' });

      // 새 카드 등록
      const res = await fetch('/api/billing/subscription');
      const data = await res.json();

      if (data.subscription?.customerKey) {
        await requestBilling(data.subscription.customerKey);
      }
    } catch (error) {
      console.error('카드 변경 실패:', error);
      alert('카드 변경에 실패했습니다.');
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!subscription || !['past_due', 'suspended'].includes(subscription.status)) {
    return (
      <div className="container max-w-md py-8">
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground">
              결제 복구가 필요하지 않습니다.
            </p>
            <Button
              className="mt-4"
              onClick={() => router.push('/mypage/subscription')}
            >
              구독 관리로 이동
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const statusMessages = {
    past_due: {
      title: '결제 실패',
      description: '결제에 실패했습니다. 카드 정보를 확인하고 다시 시도해주세요.',
      severity: 'warning' as const,
    },
    suspended: {
      title: '서비스 일시 정지',
      description: '결제 실패로 서비스가 일시 정지되었습니다. 결제 수단을 업데이트해주세요.',
      severity: 'error' as const,
    },
  };

  const statusInfo = statusMessages[subscription.status as keyof typeof statusMessages];

  return (
    <div className="container max-w-md py-8">
      <Card>
        <CardHeader className="text-center">
          <AlertTriangle
            className={`mx-auto h-12 w-12 ${
              statusInfo.severity === 'error' ? 'text-destructive' : 'text-yellow-500'
            }`}
          />
          <CardTitle className="mt-4 text-foreground">{statusInfo.title}</CardTitle>
          <CardDescription>{statusInfo.description}</CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="rounded-lg border border-border bg-muted/50 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-foreground">{subscription.plan.name}</p>
                <p className="text-sm text-muted-foreground">
                  ₩{subscription.plan.monthlyPrice.toLocaleString()}/월
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">현재 카드</p>
                <p className="font-medium text-foreground">
                  {subscription.billingKeyMasked || '등록된 카드 없음'}
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <Button
              className="w-full"
              onClick={handleUpdateCard}
              disabled={processing}
            >
              {processing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CreditCard className="mr-2 h-4 w-4" />
              )}
              결제 수단 변경
            </Button>

            <Button
              variant="ghost"
              className="w-full"
              onClick={() => router.push('/mypage/subscription')}
            >
              나중에 하기
            </Button>
          </div>

          {subscription.failedPaymentCount > 0 && (
            <p className="text-center text-sm text-muted-foreground">
              결제 시도 실패: {subscription.failedPaymentCount}회
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
```

---

## 6.6 구독 관리 페이지 개선

### 수정 파일
`app/(portal)/mypage/subscription/page.tsx`

```tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { CreditCard, Calendar, AlertTriangle, Loader2 } from 'lucide-react';

interface SubscriptionData {
  subscription: {
    id: string;
    status: string;
    currentPeriodStart: string;
    currentPeriodEnd: string;
    nextBillingDate: string;
    cancelAtPeriodEnd: boolean;
    failedPaymentCount: number;
    billingKeyMasked: string | null;
  } | null;
  plan: {
    id: string;
    name: string;
    monthlyPrice: number;
    features: string[];
  } | null;
  recentPayments: Array<{
    id: string;
    amount: number;
    status: string;
    paidAt: string;
    cardCompany: string;
    cardNumber: string;
  }>;
}

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  pending: { label: '대기 중', variant: 'secondary' },
  active: { label: '활성', variant: 'default' },
  past_due: { label: '결제 지연', variant: 'destructive' },
  suspended: { label: '일시 정지', variant: 'destructive' },
  canceled: { label: '취소됨', variant: 'outline' },
  expired: { label: '만료됨', variant: 'outline' },
};

export default function SubscriptionPage() {
  const router = useRouter();
  const [data, setData] = useState<SubscriptionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    fetchSubscription();
  }, []);

  const fetchSubscription = async () => {
    try {
      const res = await fetch('/api/billing/subscription');
      const result = await res.json();
      setData(result);
    } catch (error) {
      console.error('구독 조회 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async (immediately: boolean) => {
    setCancelling(true);

    try {
      const res = await fetch('/api/billing/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cancelImmediately: immediately,
          reason: '사용자 요청',
        }),
      });

      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.error);
      }

      alert(result.message);
      fetchSubscription();
    } catch (error) {
      console.error('구독 취소 실패:', error);
      alert(error instanceof Error ? error.message : '구독 취소에 실패했습니다.');
    } finally {
      setCancelling(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const { subscription, plan, recentPayments } = data || {};

  // 구독 없음
  if (!subscription) {
    return (
      <div className="container max-w-2xl py-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-foreground">구독 관리</CardTitle>
            <CardDescription>아직 구독 중인 플랜이 없습니다.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => router.push('/billing')}>
              플랜 선택하기
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const status = statusConfig[subscription.status] || statusConfig.pending;
  const needsRecovery = ['past_due', 'suspended'].includes(subscription.status);

  return (
    <div className="container max-w-2xl space-y-6 py-8">
      {/* 경고 배너 */}
      {needsRecovery && (
        <Card className="border-destructive bg-destructive/10">
          <CardContent className="flex items-center justify-between py-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <div>
                <p className="font-medium text-destructive">결제 문제 발생</p>
                <p className="text-sm text-muted-foreground">
                  결제 수단을 확인하고 업데이트해주세요.
                </p>
              </div>
            </div>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => router.push('/billing/recovery')}
            >
              결제 복구
            </Button>
          </CardContent>
        </Card>
      )}

      {/* 현재 플랜 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-foreground">현재 플랜</CardTitle>
              <CardDescription>{plan?.name}</CardDescription>
            </div>
            <Badge variant={status.variant}>{status.label}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border border-border p-4">
            <div>
              <p className="text-2xl font-bold text-foreground">
                ₩{plan?.monthlyPrice.toLocaleString()}
              </p>
              <p className="text-sm text-muted-foreground">/월</p>
            </div>
            <Button variant="outline" onClick={() => router.push('/billing')}>
              플랜 변경
            </Button>
          </div>

          {subscription.currentPeriodEnd && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span>
                현재 기간: {new Date(subscription.currentPeriodStart).toLocaleDateString()} ~{' '}
                {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
              </span>
            </div>
          )}

          {subscription.cancelAtPeriodEnd && (
            <div className="rounded-lg bg-yellow-500/10 p-3 text-sm text-yellow-500">
              ⚠️ 구독이 {new Date(subscription.currentPeriodEnd).toLocaleDateString()}에 종료됩니다.
            </div>
          )}
        </CardContent>
      </Card>

      {/* 결제 수단 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-foreground">결제 수단</CardTitle>
        </CardHeader>
        <CardContent>
          {subscription.billingKeyMasked ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CreditCard className="h-5 w-5 text-muted-foreground" />
                <span className="text-foreground">{subscription.billingKeyMasked}</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push('/billing/recovery')}
              >
                변경
              </Button>
            </div>
          ) : (
            <div className="text-center py-4">
              <p className="text-muted-foreground mb-4">등록된 결제 수단이 없습니다.</p>
              <Button onClick={() => router.push('/billing')}>
                결제 수단 등록
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 최근 결제 내역 */}
      {recentPayments && recentPayments.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-foreground">최근 결제 내역</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push('/mypage/payments')}
            >
              전체 보기
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentPayments.map((payment) => (
                <div
                  key={payment.id}
                  className="flex items-center justify-between rounded-lg border border-border p-3"
                >
                  <div>
                    <p className="font-medium text-foreground">
                      ₩{payment.amount.toLocaleString()}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {payment.cardCompany} {payment.cardNumber}
                    </p>
                  </div>
                  <div className="text-right">
                    <Badge
                      variant={payment.status === 'paid' ? 'default' : 'destructive'}
                    >
                      {payment.status === 'paid' ? '완료' : '실패'}
                    </Badge>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(payment.paidAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 구독 취소 */}
      {subscription.status === 'active' && !subscription.cancelAtPeriodEnd && (
        <Card>
          <CardHeader>
            <CardTitle className="text-foreground">구독 취소</CardTitle>
            <CardDescription>
              구독을 취소하면 현재 기간이 끝난 후 서비스를 이용할 수 없습니다.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" disabled={cancelling}>
                  {cancelling && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  구독 취소
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>구독을 취소하시겠습니까?</AlertDialogTitle>
                  <AlertDialogDescription>
                    취소 방식을 선택해주세요.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="flex-col gap-2 sm:flex-row">
                  <AlertDialogCancel>돌아가기</AlertDialogCancel>
                  <AlertDialogAction onClick={() => handleCancel(false)}>
                    기간 만료 후 취소
                  </AlertDialogAction>
                  <AlertDialogAction
                    onClick={() => handleCancel(true)}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    즉시 취소
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
```

---

## 6.7 결제 내역 페이지

### 신규 파일
`app/(portal)/mypage/payments/page.tsx`

```tsx
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Receipt, Download } from 'lucide-react';

interface Payment {
  id: string;
  orderId: string;
  amount: number;
  status: string;
  cardCompany: string;
  cardNumber: string;
  receiptUrl: string | null;
  periodStart: string;
  periodEnd: string;
  paidAt: string | null;
  failedAt: string | null;
  failureMessage: string | null;
  createdAt: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export default function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  useEffect(() => {
    fetchPayments(page);
  }, [page]);

  const fetchPayments = async (pageNum: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/billing/payments?page=${pageNum}&limit=10`);
      const data = await res.json();
      setPayments(data.payments);
      setPagination(data.pagination);
    } catch (error) {
      console.error('결제 내역 조회 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
    pending: { label: '처리 중', variant: 'secondary' },
    paid: { label: '완료', variant: 'default' },
    failed: { label: '실패', variant: 'destructive' },
    canceled: { label: '취소', variant: 'outline' },
    refunded: { label: '환불', variant: 'outline' },
  };

  if (loading && payments.length === 0) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="container max-w-3xl py-8">
      <Card>
        <CardHeader>
          <CardTitle className="text-foreground">결제 내역</CardTitle>
        </CardHeader>
        <CardContent>
          {payments.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              결제 내역이 없습니다.
            </div>
          ) : (
            <div className="space-y-4">
              {payments.map((payment) => {
                const status = statusConfig[payment.status] || statusConfig.pending;

                return (
                  <div
                    key={payment.id}
                    className="rounded-lg border border-border p-4"
                  >
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-foreground">
                            ₩{payment.amount.toLocaleString()}
                          </span>
                          <Badge variant={status.variant}>{status.label}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {payment.cardCompany} {payment.cardNumber}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          결제 기간: {new Date(payment.periodStart).toLocaleDateString()} ~{' '}
                          {new Date(payment.periodEnd).toLocaleDateString()}
                        </p>
                      </div>

                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">
                          {payment.paidAt
                            ? new Date(payment.paidAt).toLocaleDateString()
                            : new Date(payment.createdAt).toLocaleDateString()}
                        </p>

                        {payment.receiptUrl && (
                          <a
                            href={payment.receiptUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-2 inline-flex items-center gap-1 text-sm text-primary hover:underline"
                          >
                            <Receipt className="h-3 w-3" />
                            영수증
                          </a>
                        )}
                      </div>
                    </div>

                    {payment.failureMessage && (
                      <div className="mt-3 rounded bg-destructive/10 p-2 text-sm text-destructive">
                        실패 사유: {payment.failureMessage}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* 페이지네이션 */}
          {pagination && pagination.totalPages > 1 && (
            <div className="mt-6 flex items-center justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 1}
                onClick={() => setPage(page - 1)}
              >
                이전
              </Button>
              <span className="text-sm text-muted-foreground">
                {page} / {pagination.totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page === pagination.totalPages}
                onClick={() => setPage(page + 1)}
              >
                다음
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
```

---

## 체크리스트

- [ ] 토스 SDK 패키지 설치 (`@tosspayments/payment-sdk`)
- [ ] `lib/toss/sdk.ts` 클라이언트 SDK 래퍼 구현
- [ ] `app/(portal)/billing/page.tsx` 플랜 선택 페이지
- [ ] `app/(portal)/billing/success/page.tsx` 결제 성공 콜백
- [ ] `app/(portal)/billing/fail/page.tsx` 결제 실패 콜백
- [ ] `app/(portal)/billing/recovery/page.tsx` 결제 복구 페이지
- [ ] `app/(portal)/mypage/subscription/page.tsx` 구독 관리 개선
- [ ] `app/(portal)/mypage/payments/page.tsx` 결제 내역 페이지
- [ ] 다크모드 호환성 확인
- [ ] 반응형 디자인 확인

---

## 다음 단계

Phase 6 완료 후 [Phase 7: 서비스 제한](./phase-7-service-restriction.md)으로 진행합니다.
