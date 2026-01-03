'use client';

/**
 * Console 플랜 선택 페이지
 * PortOne Browser SDK를 사용하여 빌링키 발급 후 구독 시작
 * UI/UX 베스트 프랙티스 적용
 */

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import PortOne from '@portone/browser-sdk/v2';
import { Check, Sparkles, AlertCircle, Loader2, Crown } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

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

// Console용 SessionStorage 키
const SESSION_STORAGE_KEY = 'console_pendingSubscription';

// 추천 플랜 ID (가장 많이 선택되는 플랜)
const RECOMMENDED_PLAN_ID = 'standard';

export default function PlansPage() {
  const router = useRouter();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [currentSubscription, setCurrentSubscription] = useState<CurrentSubscription | null>(null);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingPlanId, setProcessingPlanId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      setError(null);

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
    } catch {
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

  // 연간 결제 시 월별 환산 가격
  const getMonthlyEquivalent = (plan: Plan): number => {
    if (billingCycle === 'yearly' && plan.yearlyPrice > 0) {
      return Math.floor(plan.yearlyPrice / 12);
    }
    return plan.monthlyPrice;
  };

  // 연간 결제 시 할인율 계산
  const calculateDiscount = (plan: Plan): number => {
    if (plan.monthlyPrice === 0 || plan.yearlyPrice === 0) return 0;
    const yearlyEquivalent = plan.monthlyPrice * 12;
    const discount = ((yearlyEquivalent - plan.yearlyPrice) / yearlyEquivalent) * 100;
    return Math.round(discount);
  };

  // 모바일에서는 추천 플랜을 첫 번째로 표시
  const sortedPlans = useMemo(() => {
    const plansCopy = [...plans];
    // 추천 플랜을 맨 앞으로 이동 (모바일 대응)
    const recommendedIndex = plansCopy.findIndex((p) => p.id === RECOMMENDED_PLAN_ID);
    if (recommendedIndex > 0) {
      const [recommended] = plansCopy.splice(recommendedIndex, 1);
      plansCopy.unshift(recommended);
    }
    return plansCopy;
  }, [plans]);

  const handleSubscribe = async (planId: string) => {
    if (isProcessing) return;

    try {
      setIsProcessing(true);
      setProcessingPlanId(planId);
      setError(null);

      const selectedPlan = plans.find((p) => p.id === planId);
      if (selectedPlan && selectedPlan.monthlyPrice === 0) {
        const res = await fetch('/api/billing/subscription/change', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ planId, billingCycle: 'monthly' }),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || '플랜 변경에 실패했습니다');
        }

        router.push('/console/account/subscription');
        return;
      }

      // 빌링키 발급 준비 정보 조회
      const prepareRes = await fetch('/api/billing/billing-key/prepare', {
        method: 'POST',
      });

      if (!prepareRes.ok) {
        throw new Error('결제 준비에 실패했습니다');
      }

      const prepareData = await prepareRes.json();

      // 모바일 리다이렉션을 위해 플랜 정보 저장
      sessionStorage.setItem(
        SESSION_STORAGE_KEY,
        JSON.stringify({ planId, billingCycle })
      );

      // PortOne 빌링키 발급 창 호출
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
        redirectUrl: `${window.location.origin}/console/account/subscription/callback`,
      });

      // 결과 처리 (PC IFRAME 방식)
      if (response?.code) {
        throw new Error(response.message || '빌링키 발급에 실패했습니다');
      }

      if (!response?.billingKey) {
        throw new Error('빌링키를 받지 못했습니다');
      }

      // 빌링키 저장 및 구독 시작
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

      // 성공 시 sessionStorage 정리 후 구독 페이지로 이동
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
      router.push('/console/account/subscription');
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다');
    } finally {
      setIsProcessing(false);
      setProcessingPlanId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  // 비교 테이블용 데이터
  const comparisonRows = [
    { label: '챗봇', key: 'maxChatbots', suffix: '개' },
    { label: '데이터셋', key: 'maxDatasets', suffix: '개' },
    { label: '문서', key: 'maxDocuments', suffix: '개' },
    { label: '저장 용량', key: 'maxStorageBytes', isBytes: true },
    { label: '월간 대화', key: 'maxMonthlyConversations', suffix: '회' },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      {/* 헤더 */}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-foreground">플랜 선택</h2>
        <p className="mt-2 text-muted-foreground">비즈니스에 맞는 플랜을 선택하세요</p>
      </div>

      {/* 결제 주기 토글 */}
      <div className="flex justify-center">
        <ToggleGroup
          type="single"
          value={billingCycle}
          onValueChange={(value) => {
            if (value) setBillingCycle(value as 'monthly' | 'yearly');
          }}
          className="rounded-lg bg-muted p-1"
        >
          <ToggleGroupItem
            value="monthly"
            className="rounded-md px-6 py-2 data-[state=on]:bg-card data-[state=on]:shadow-sm"
          >
            월간 결제
          </ToggleGroupItem>
          <ToggleGroupItem
            value="yearly"
            className="gap-2 rounded-md px-6 py-2 data-[state=on]:bg-card data-[state=on]:shadow-sm"
          >
            연간 결제
            <Badge variant="success" className="text-[10px]">
              2개월 무료
            </Badge>
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      {/* 에러 메시지 */}
      {error && (
        <Alert variant="destructive" className="mx-auto max-w-lg">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* 플랜 카드 그리드 */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* 데스크탑: plans 순서대로, 모바일: sortedPlans (추천 우선) */}
        {plans.map((plan) => {
          const isRecommended = plan.id === RECOMMENDED_PLAN_ID;
          const isCurrentPlan = currentSubscription?.planId === plan.id;
          const isFree = plan.monthlyPrice === 0;
          const monthlyEquivalent = getMonthlyEquivalent(plan);
          const discount = calculateDiscount(plan);
          const isThisProcessing = processingPlanId === plan.id;

          return (
            <Card
              key={plan.id}
              size="lg"
              className={cn(
                'relative flex flex-col transition-all duration-200',
                isRecommended && 'ring-2 ring-primary shadow-lg md:scale-105',
                isCurrentPlan && 'border-primary/50 bg-primary/5',
                // 모바일에서 추천 플랜 순서 조정
                isRecommended && 'order-first md:order-none'
              )}
            >
              {/* 추천 배지 */}
              {isRecommended && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="gap-1 px-4 shadow-md">
                    <Crown className="h-3 w-3" />
                    추천
                  </Badge>
                </div>
              )}

              <CardHeader className="pb-2 text-center">
                <CardTitle className="text-xl">{plan.nameKo}</CardTitle>
                <CardDescription>{plan.description}</CardDescription>
              </CardHeader>

              <CardContent className="flex-1 text-center">
                {/* 가격 표시 */}
                <div className="mb-6">
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="text-4xl font-bold text-foreground">
                      {formatPrice(monthlyEquivalent)}
                    </span>
                    {!isFree && <span className="text-muted-foreground">/월</span>}
                  </div>

                  {billingCycle === 'yearly' && !isFree && plan.yearlyPrice > 0 && (
                    <div className="mt-2 space-y-1">
                      <p className="text-sm text-muted-foreground">
                        연 {formatPrice(plan.yearlyPrice)} 청구
                      </p>
                      {discount > 0 && (
                        <Badge variant="success" className="text-xs">
                          {discount}% 절감
                        </Badge>
                      )}
                    </div>
                  )}
                </div>

                {/* 기능 목록 */}
                <ul className="space-y-3 text-left">
                  {plan.features.map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
                      <span className="text-sm text-foreground">{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>

              <CardFooter className="pt-4">
                {isCurrentPlan ? (
                  <div className="w-full rounded-lg bg-primary/10 py-3 text-center text-sm font-medium text-primary">
                    현재 플랜
                  </div>
                ) : (
                  <Button
                    className="w-full"
                    variant={isRecommended ? 'default' : 'outline'}
                    size="lg"
                    onClick={() => handleSubscribe(plan.id)}
                    disabled={isProcessing}
                  >
                    {isThisProcessing ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        처리 중...
                      </>
                    ) : isFree ? (
                      '무료로 시작하기'
                    ) : (
                      <>
                        <Sparkles className="mr-2 h-4 w-4" />
                        구독하기
                      </>
                    )}
                  </Button>
                )}
              </CardFooter>
            </Card>
          );
        })}
      </div>

      {/* 플랜 상세 비교 테이블 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">플랜 상세 비교</CardTitle>
          <CardDescription>각 플랜의 세부 기능을 비교해보세요</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[180px]">기능</TableHead>
                {plans.map((plan) => (
                  <TableHead key={plan.id} className="text-center">
                    <div className="flex flex-col items-center gap-1">
                      <span>{plan.nameKo}</span>
                      {plan.id === RECOMMENDED_PLAN_ID && (
                        <Badge variant="default" className="text-[10px]">
                          추천
                        </Badge>
                      )}
                    </div>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {comparisonRows.map((row) => (
                <TableRow key={row.key}>
                  <TableCell className="font-medium">{row.label}</TableCell>
                  {plans.map((plan) => {
                    const value = plan.limits[row.key as keyof typeof plan.limits];
                    let displayValue = '';

                    if (row.isBytes) {
                      displayValue = formatBytes(value as number);
                    } else {
                      displayValue = (value as number).toLocaleString() + (row.suffix || '');
                    }

                    return (
                      <TableCell key={plan.id} className="text-center">
                        {displayValue}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* 안내 사항 */}
      <div className="rounded-lg bg-muted/50 p-4 text-center text-sm text-muted-foreground">
        <p>모든 유료 플랜은 언제든지 취소할 수 있습니다.</p>
        <p className="mt-1">결제 관련 문의: support@ffgg.works</p>
      </div>
    </div>
  );
}
