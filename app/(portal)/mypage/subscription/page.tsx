'use client';

/**
 * 구독 관리 페이지
 * [Billing System] 현재 구독 상태, 사용량, 결제 관리
 */

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Plan {
  id: string;
  name: string;
  nameKo: string;
  monthlyPrice: number;
  yearlyPrice: number;
}

interface Subscription {
  id: string;
  planId: string;
  plan: Plan;
  status: string;
  billingCycle: string;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  nextPaymentDate: string | null;
  cancelAtPeriodEnd: boolean;
  hasBillingKey: boolean;
}

interface UsageData {
  tier: 'basic' | 'standard' | 'premium';
  usage: {
    chatbots: { used: number; limit: number };
    datasets: { used: number; limit: number };
    documents: { used: number; limit: number };
    storage: { used: number; limit: number };
    conversations: { used: number; limit: number };
  };
}

const statusLabels: Record<string, { label: string; className: string }> = {
  active: { label: '활성', className: 'bg-green-500/10 text-green-500' },
  past_due: { label: '결제 지연', className: 'bg-yellow-500/10 text-yellow-500' },
  cancelled: { label: '취소됨', className: 'bg-muted text-muted-foreground' },
  expired: { label: '만료됨', className: 'bg-destructive/10 text-destructive' },
};

const tierLabels: Record<string, { name: string; color: string }> = {
  basic: { name: 'Basic', color: 'bg-muted text-muted-foreground' },
  standard: { name: 'Standard', color: 'bg-primary/10 text-primary' },
  premium: { name: 'Premium', color: 'bg-purple-500/10 text-purple-500' },
};

export default function SubscriptionPage() {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const [subRes, usageRes] = await Promise.all([
        fetch('/api/billing/subscription'),
        fetch('/api/user/usage'),
      ]);

      if (subRes.ok) {
        const subData = await subRes.json();
        // API는 subscription과 currentPlan을 별도로 반환하므로 병합
        if (subData.subscription) {
          setSubscription({
            ...subData.subscription,
            plan: subData.currentPlan,
          });
        } else {
          setSubscription(null);
        }
      }

      if (usageRes.ok) {
        const usageData = await usageRes.json();
        setUsage(usageData);
      }
    } catch (err) {
      setError('데이터를 불러오는데 실패했습니다');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelSubscription = async (immediate: boolean = false) => {
    if (isCancelling) return;

    try {
      setIsCancelling(true);
      const res = await fetch('/api/billing/subscription/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ immediate }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || '구독 취소에 실패했습니다');
      }

      setShowCancelDialog(false);
      fetchData();
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다');
    } finally {
      setIsCancelling(false);
    }
  };

  const formatDate = (dateStr: string | null): string => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatPrice = (price: number): string => {
    if (price === 0) return '무료';
    return price.toLocaleString('ko-KR') + '원';
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const formatNumber = (num: number): string => {
    return num.toLocaleString('ko-KR');
  };

  const getProgressColor = (used: number, limit: number): string => {
    const percentage = (used / limit) * 100;
    if (percentage >= 90) return 'bg-destructive';
    if (percentage >= 70) return 'bg-yellow-500';
    return 'bg-primary';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  const tierInfo = tierLabels[usage?.tier || 'basic'] || tierLabels.basic;
  const statusInfo = statusLabels[subscription?.status || 'active'] || statusLabels.active;

  const usageItems = usage
    ? [
        {
          label: '챗봇',
          ...usage.usage.chatbots,
          format: (v: number) => formatNumber(v) + '개',
        },
        {
          label: '데이터셋',
          ...usage.usage.datasets,
          format: (v: number) => formatNumber(v) + '개',
        },
        {
          label: '문서',
          ...usage.usage.documents,
          format: (v: number) => formatNumber(v) + '개',
        },
        {
          label: '저장 용량',
          ...usage.usage.storage,
          format: (v: number) => formatBytes(v),
        },
        {
          label: '월간 대화',
          ...usage.usage.conversations,
          format: (v: number) => formatNumber(v) + '회',
        },
      ]
    : [];

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* 에러 메시지 */}
      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive">
          {error}
          <button
            onClick={() => setError(null)}
            className="ml-2 text-sm underline hover:no-underline"
          >
            닫기
          </button>
        </div>
      )}

      {/* 현재 플랜 */}
      <div className="rounded-lg border border-border bg-card p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">현재 플랜</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {subscription?.plan?.nameKo || tierInfo.name} 플랜을 사용 중입니다
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`rounded-full px-3 py-1 text-sm font-medium ${tierInfo.color}`}
            >
              {subscription?.plan?.nameKo || tierInfo.name}
            </span>
            {subscription && (
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusInfo.className}`}
              >
                {statusInfo.label}
              </span>
            )}
          </div>
        </div>

        {/* 구독 상세 정보 */}
        {subscription && subscription.plan && subscription.plan.monthlyPrice > 0 && (
          <div className="mt-4 space-y-3 rounded-lg bg-muted/50 p-4">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">결제 주기</span>
              <span className="text-foreground">
                {subscription.billingCycle === 'yearly' ? '연간' : '월간'}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">다음 결제 금액</span>
              <span className="font-medium text-foreground">
                {formatPrice(
                  subscription.billingCycle === 'yearly'
                    ? subscription.plan.yearlyPrice
                    : subscription.plan.monthlyPrice
                )}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">다음 결제일</span>
              <span className="text-foreground">
                {subscription.cancelAtPeriodEnd
                  ? '취소 예정'
                  : formatDate(subscription.nextPaymentDate)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">현재 기간</span>
              <span className="text-foreground">
                {formatDate(subscription.currentPeriodStart)} ~{' '}
                {formatDate(subscription.currentPeriodEnd)}
              </span>
            </div>
            {subscription.cancelAtPeriodEnd && (
              <div className="mt-2 rounded border border-yellow-500/30 bg-yellow-500/10 p-2 text-sm text-yellow-500">
                {formatDate(subscription.currentPeriodEnd)}에 구독이 종료됩니다.
              </div>
            )}
          </div>
        )}

        {/* 액션 버튼 */}
        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            href="/mypage/subscription/plans"
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            {subscription?.plan?.monthlyPrice === 0 ? '업그레이드' : '플랜 변경'}
          </Link>
          <Link
            href="/mypage/subscription/history"
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
          >
            결제 내역
          </Link>
          {subscription?.status === 'active' &&
            subscription?.hasBillingKey &&
            !subscription?.cancelAtPeriodEnd && (
              <button
                onClick={() => setShowCancelDialog(true)}
                className="rounded-lg border border-destructive/50 px-4 py-2 text-sm font-medium text-destructive hover:bg-destructive/10"
              >
                구독 취소
              </button>
            )}
        </div>
      </div>

      {/* 사용량 현황 */}
      {usage && (
        <div className="rounded-lg border border-border bg-card p-6">
          <h2 className="mb-6 text-lg font-semibold text-foreground">사용량 현황</h2>

          <div className="space-y-6">
            {usageItems.map((item) => {
              const percentage = Math.min((item.used / item.limit) * 100, 100);
              const isNearLimit = percentage >= 90;

              return (
                <div key={item.label}>
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm font-medium text-foreground">
                      {item.label}
                    </span>
                    <span
                      className={`text-sm ${
                        isNearLimit ? 'text-destructive' : 'text-muted-foreground'
                      }`}
                    >
                      {item.format(item.used)} / {item.format(item.limit)}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className={`h-full rounded-full transition-all ${getProgressColor(item.used, item.limit)}`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                  {isNearLimit && (
                    <p className="mt-1 text-xs text-destructive">
                      사용 한도에 도달했습니다. 업그레이드를 고려해주세요.
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 구독 취소 다이얼로그 */}
      {showCancelDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-md rounded-lg border border-border bg-card p-6">
            <h3 className="text-lg font-semibold text-foreground">구독 취소</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              정말 구독을 취소하시겠습니까?
            </p>

            <div className="mt-4 space-y-3">
              <button
                onClick={() => handleCancelSubscription(false)}
                disabled={isCancelling}
                className="w-full rounded-lg border border-border px-4 py-3 text-left hover:bg-muted disabled:opacity-50"
              >
                <div className="font-medium text-foreground">기간 종료 시 취소</div>
                <div className="text-sm text-muted-foreground">
                  {formatDate(subscription?.currentPeriodEnd ?? null)}까지 사용 후 취소됩니다
                </div>
              </button>

              <button
                onClick={() => handleCancelSubscription(true)}
                disabled={isCancelling}
                className="w-full rounded-lg border border-destructive/50 px-4 py-3 text-left hover:bg-destructive/10 disabled:opacity-50"
              >
                <div className="font-medium text-destructive">즉시 취소</div>
                <div className="text-sm text-muted-foreground">
                  지금 바로 구독이 취소되고 Basic으로 다운그레이드됩니다
                </div>
              </button>
            </div>

            <button
              onClick={() => setShowCancelDialog(false)}
              disabled={isCancelling}
              className="mt-4 w-full rounded-lg bg-muted px-4 py-2 text-sm font-medium text-foreground hover:bg-muted/80"
            >
              취소
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
