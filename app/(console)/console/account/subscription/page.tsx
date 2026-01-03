'use client';

/**
 * Console 구독 관리 페이지
 * 현재 구독 상태, 사용량, 결제 관리
 */

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { AlertCircle, CreditCard, History, Sparkles } from 'lucide-react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAlertDialog } from '@/components/ui/alert-dialog';
import {
  subscriptionStatusBadge,
  planTierBadge,
  getUsageVariant,
  getUsageWarningBadge,
} from '@/lib/constants/status-badges';

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

export default function SubscriptionPage() {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { confirm } = useAlertDialog();

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
    } catch {
      setError('데이터를 불러오는데 실패했습니다');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelSubscription = async () => {
    const periodEndDate = formatDate(subscription?.currentPeriodEnd ?? null);

    await confirm({
      title: '구독 취소',
      message: `정말 구독을 취소하시겠습니까? ${periodEndDate}까지 사용 후 Basic 플랜으로 전환됩니다.`,
      confirmText: '구독 취소',
      cancelText: '돌아가기',
      variant: 'destructive',
      onConfirm: async () => {
        const res = await fetch('/api/billing/subscription/cancel', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ immediate: false }),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || '구독 취소에 실패했습니다');
        }

        fetchData();
      },
    });
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  // 티어 정보
  const tierKey = usage?.tier || 'basic';
  const tierConfig = planTierBadge[tierKey] || planTierBadge.free;

  // 구독 상태 정보
  const statusKey = subscription?.status || 'active';
  const statusConfig = subscriptionStatusBadge[statusKey] || subscriptionStatusBadge.active;

  const usageItems = usage
    ? [
        {
          key: 'chatbots',
          label: '챗봇',
          ...usage.usage.chatbots,
          format: (v: number) => formatNumber(v) + '개',
        },
        {
          key: 'datasets',
          label: '데이터셋',
          ...usage.usage.datasets,
          format: (v: number) => formatNumber(v) + '개',
        },
        {
          key: 'documents',
          label: '문서',
          ...usage.usage.documents,
          format: (v: number) => formatNumber(v) + '개',
        },
        {
          key: 'storage',
          label: '저장 용량',
          ...usage.usage.storage,
          format: (v: number) => formatBytes(v),
        },
        {
          key: 'conversations',
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
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            {error}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setError(null)}
              className="h-auto p-0 text-destructive underline hover:no-underline"
            >
              닫기
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* 현재 플랜 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-muted-foreground" />
              <CardTitle>현재 플랜</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={tierConfig.variant}>
                {subscription?.plan?.nameKo || tierConfig.label}
              </Badge>
              {subscription && (
                <Badge variant={statusConfig.variant}>{statusConfig.label}</Badge>
              )}
            </div>
          </div>
          <CardDescription>
            {subscription?.plan?.nameKo || tierConfig.label} 플랜을 사용 중입니다
          </CardDescription>
        </CardHeader>

        {/* 구독 상세 정보 */}
        {subscription && subscription.plan && subscription.plan.monthlyPrice > 0 && (
          <CardContent className="pt-0">
            <div className="space-y-3 rounded-lg bg-muted/50 p-4">
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
                <Alert variant="destructive" className="mt-2 border-yellow-500/30 bg-yellow-500/10 text-yellow-500 [&>svg]:text-yellow-500">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    {formatDate(subscription.currentPeriodEnd)}에 구독이 종료됩니다.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </CardContent>
        )}

        {/* 액션 버튼 */}
        <CardFooter className="flex-wrap gap-3">
          <Button asChild>
            <Link href="/console/account/subscription/plans">
              <Sparkles className="mr-2 h-4 w-4" />
              {subscription?.plan?.monthlyPrice === 0 ? '업그레이드' : '플랜 변경'}
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/console/account/subscription/history">
              <History className="mr-2 h-4 w-4" />
              결제 내역
            </Link>
          </Button>
          {subscription?.status === 'active' &&
            subscription?.hasBillingKey &&
            !subscription?.cancelAtPeriodEnd && (
              <Button variant="outline" onClick={handleCancelSubscription}>
                구독 취소
              </Button>
            )}
        </CardFooter>
      </Card>

      {/* 사용량 현황 */}
      {usage && (
        <Card>
          <CardHeader>
            <CardTitle>사용량 현황</CardTitle>
            <CardDescription>현재 플랜의 리소스 사용 현황입니다</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {usageItems.map((item) => {
              const percentage = Math.min((item.used / item.limit) * 100, 100);
              const usageVariant = getUsageVariant(item.used, item.limit);
              const warningBadge = getUsageWarningBadge(percentage);

              return (
                <div key={item.key} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-foreground">{item.label}</span>
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-sm ${
                          usageVariant === 'destructive'
                            ? 'text-destructive'
                            : usageVariant === 'warning'
                              ? 'text-yellow-500'
                              : 'text-muted-foreground'
                        }`}
                      >
                        {item.format(item.used)} / {item.format(item.limit)}
                      </span>
                      {warningBadge && (
                        <Badge variant={warningBadge.variant}>{warningBadge.label}</Badge>
                      )}
                    </div>
                  </div>
                  <Progress value={percentage} variant={usageVariant} />
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
