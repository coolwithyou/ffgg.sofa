'use client';

/**
 * 플랜 선택 페이지
 * [Billing System] 구독 플랜 비교 및 선택
 *
 * PortOne Browser SDK를 사용하여 빌링키 발급 후 구독 시작
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import PortOne from '@portone/browser-sdk/v2';

interface Plan {
  id: string;
  name: string;
  nameKo: string;
  description: string | null;
  monthlyPrice: number;
  yearlyPrice: number;
  features: string[];
  limits: {
    maxChatbots: number;
    maxDatasets: number;
    maxDocuments: number;
    maxStorageBytes: number;
    maxMonthlyConversations: number;
  };
}

interface CurrentSubscription {
  id: string;
  planId: string;
  status: string;
  billingCycle: string;
  currentPeriodEnd: string | null;
  hasBillingKey: boolean;
}

export default function PlansPage() {
  const router = useRouter();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [currentSubscription, setCurrentSubscription] = useState<CurrentSubscription | null>(null);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // 플랜 목록과 현재 구독 정보 동시 조회
      const [plansRes, subscriptionRes] = await Promise.all([
        fetch('/api/billing/plans'),
        fetch('/api/billing/subscription'),
      ]);

      if (plansRes.ok) {
        const plansData = await plansRes.json();
        setPlans(plansData.plans || []);
      }

      if (subscriptionRes.ok) {
        const subData = await subscriptionRes.json();
        setCurrentSubscription(subData.subscription || null);
        if (subData.subscription?.billingCycle) {
          setBillingCycle(subData.subscription.billingCycle);
        }
      }
    } catch (err) {
      setError('데이터를 불러오는데 실패했습니다');
    } finally {
      setIsLoading(false);
    }
  };

  const formatPrice = (price: number): string => {
    if (price === 0) return '무료';
    return price.toLocaleString('ko-KR') + '원';
  };

  const formatBytes = (bytes: number): string => {
    if (bytes >= 1073741824) return (bytes / 1073741824).toFixed(0) + 'GB';
    return (bytes / 1048576).toFixed(0) + 'MB';
  };

  const handleSubscribe = async (planId: string) => {
    if (isProcessing) return;

    try {
      setIsProcessing(true);
      setError(null);

      // 무료 플랜인 경우 바로 처리
      const selectedPlan = plans.find((p) => p.id === planId);
      if (selectedPlan && selectedPlan.monthlyPrice === 0) {
        // 무료 플랜으로 변경 API 호출
        const res = await fetch('/api/billing/subscription/change', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ planId, billingCycle: 'monthly' }),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || '플랜 변경에 실패했습니다');
        }

        router.push('/mypage/subscription');
        return;
      }

      // 1. 빌링키 발급 준비 정보 조회
      const prepareRes = await fetch('/api/billing/billing-key/prepare', {
        method: 'POST',
      });

      if (!prepareRes.ok) {
        throw new Error('결제 준비에 실패했습니다');
      }

      const prepareData = await prepareRes.json();

      // 2. PortOne 빌링키 발급 창 호출
      const response = await PortOne.requestIssueBillingKey({
        storeId: prepareData.storeId,
        channelKey: prepareData.channelKey,
        billingKeyMethod: 'CARD',
        customer: {
          customerId: prepareData.customerId,
          fullName: prepareData.customerName,
          email: prepareData.customerEmail,
        },
        windowType: {
          pc: 'IFRAME',
          mobile: 'REDIRECTION',
        },
        redirectUrl: `${window.location.origin}/mypage/subscription/callback`,
      });

      // 3. 결과 처리
      if (response?.code) {
        // 에러 발생
        throw new Error(response.message || '빌링키 발급에 실패했습니다');
      }

      if (!response?.billingKey) {
        throw new Error('빌링키를 받지 못했습니다');
      }

      // 4. 빌링키 저장 및 구독 시작
      const saveRes = await fetch('/api/billing/billing-key/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          billingKey: response.billingKey,
          planId,
          billingCycle,
        }),
      });

      if (!saveRes.ok) {
        const data = await saveRes.json();
        throw new Error(data.error || '구독 시작에 실패했습니다');
      }

      // 성공 시 구독 페이지로 이동
      router.push('/mypage/subscription');
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다');
    } finally {
      setIsProcessing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* 헤더 */}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-foreground">플랜 선택</h2>
        <p className="mt-2 text-muted-foreground">
          비즈니스에 맞는 플랜을 선택하세요
        </p>
      </div>

      {/* 결제 주기 토글 */}
      <div className="flex items-center justify-center gap-4">
        <button
          onClick={() => setBillingCycle('monthly')}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            billingCycle === 'monthly'
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground hover:bg-muted/80'
          }`}
        >
          월간 결제
        </button>
        <button
          onClick={() => setBillingCycle('yearly')}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            billingCycle === 'yearly'
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground hover:bg-muted/80'
          }`}
        >
          연간 결제
          <span className="ml-1 text-xs opacity-75">(2개월 할인)</span>
        </button>
      </div>

      {/* 에러 메시지 */}
      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-center text-destructive">
          {error}
        </div>
      )}

      {/* 플랜 카드 */}
      <div className="grid gap-6 md:grid-cols-3">
        {plans.map((plan) => {
          const price = billingCycle === 'yearly' ? plan.yearlyPrice : plan.monthlyPrice;
          const isCurrentPlan = currentSubscription?.planId === plan.id;
          const isFree = plan.monthlyPrice === 0;

          return (
            <div
              key={plan.id}
              className={`rounded-xl border p-6 transition-shadow hover:shadow-lg ${
                isCurrentPlan
                  ? 'border-primary bg-primary/5'
                  : 'border-border bg-card'
              }`}
            >
              {/* 플랜 이름 */}
              <div className="mb-4">
                <h3 className="text-xl font-bold text-foreground">{plan.nameKo}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{plan.description}</p>
              </div>

              {/* 가격 */}
              <div className="mb-6">
                <span className="text-3xl font-bold text-foreground">
                  {formatPrice(price)}
                </span>
                {!isFree && (
                  <span className="text-muted-foreground">
                    /{billingCycle === 'yearly' ? '년' : '월'}
                  </span>
                )}
              </div>

              {/* 기능 목록 */}
              <ul className="mb-6 space-y-3">
                {plan.features.map((feature, idx) => (
                  <li key={idx} className="flex items-center gap-2 text-sm text-foreground">
                    <svg
                      className="h-4 w-4 shrink-0 text-primary"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    {feature}
                  </li>
                ))}
              </ul>

              {/* 상세 한도 */}
              <div className="mb-6 rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
                <div className="grid grid-cols-2 gap-2">
                  <div>챗봇: {plan.limits.maxChatbots}개</div>
                  <div>데이터셋: {plan.limits.maxDatasets}개</div>
                  <div>문서: {plan.limits.maxDocuments}개</div>
                  <div>저장공간: {formatBytes(plan.limits.maxStorageBytes)}</div>
                  <div className="col-span-2">
                    월간 대화: {plan.limits.maxMonthlyConversations.toLocaleString()}회
                  </div>
                </div>
              </div>

              {/* 버튼 */}
              {isCurrentPlan ? (
                <div className="rounded-lg bg-primary/10 py-3 text-center text-sm font-medium text-primary">
                  현재 플랜
                </div>
              ) : (
                <button
                  onClick={() => handleSubscribe(plan.id)}
                  disabled={isProcessing}
                  className={`w-full rounded-lg py-3 text-sm font-medium transition-colors ${
                    isFree
                      ? 'bg-muted text-foreground hover:bg-muted/80'
                      : 'bg-primary text-primary-foreground hover:bg-primary/90'
                  } disabled:cursor-not-allowed disabled:opacity-50`}
                >
                  {isProcessing ? (
                    <span className="flex items-center justify-center gap-2">
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      처리 중...
                    </span>
                  ) : isFree ? (
                    '무료로 시작하기'
                  ) : (
                    '구독하기'
                  )}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* 안내 사항 */}
      <div className="rounded-lg bg-muted/50 p-4 text-center text-sm text-muted-foreground">
        <p>모든 유료 플랜은 언제든지 취소할 수 있습니다.</p>
        <p className="mt-1">결제 관련 문의: support@ffgg.works</p>
      </div>
    </div>
  );
}
