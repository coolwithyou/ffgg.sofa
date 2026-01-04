'use client';

/**
 * 포인트 충전 페이지
 * PortOne Browser SDK를 사용하여 일회성 결제 후 포인트 충전
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import PortOne from '@portone/browser-sdk/v2';
import {
  Coins,
  Check,
  AlertCircle,
  Loader2,
  ArrowLeft,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
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
import { toast } from 'sonner';

interface PointPackage {
  id: string;
  name: string;
  points: number;
  price: number;
  pricePerPoint: number;
  discount: number;
}

interface PointBalance {
  balance: number;
  freePointsGranted: boolean;
  monthlyPointsBase: number;
  lastRechargedAt: string | null;
  isLow: boolean;
}

export default function PointsPage() {
  const router = useRouter();
  const [packages, setPackages] = useState<PointPackage[]>([]);
  const [balance, setBalance] = useState<PointBalance | null>(null);
  const [selectedPackageId, setSelectedPackageId] = useState<string | null>(null);
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

      const [packagesRes, pointsRes] = await Promise.all([
        fetch('/api/points/packages'),
        fetch('/api/points'),
      ]);

      if (packagesRes.ok) {
        const packagesData = await packagesRes.json();
        setPackages(packagesData.packages || []);
      }

      if (pointsRes.ok) {
        const pointsData = await pointsRes.json();
        setBalance(pointsData.balance || null);
      }
    } catch {
      setError('데이터를 불러오는데 실패했습니다');
    } finally {
      setIsLoading(false);
    }
  };

  const formatPrice = (price: number): string => {
    return price.toLocaleString('ko-KR') + '원';
  };

  const formatNumber = (num: number): string => {
    return num.toLocaleString('ko-KR');
  };

  const handlePurchase = async () => {
    if (!selectedPackageId || isProcessing) return;

    const selectedPackage = packages.find((p) => p.id === selectedPackageId);
    if (!selectedPackage) return;

    try {
      setIsProcessing(true);
      setError(null);

      // 1. 결제 준비 (pending 레코드 생성)
      const prepareRes = await fetch('/api/points/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packageId: selectedPackageId }),
      });

      if (!prepareRes.ok) {
        const data = await prepareRes.json();
        throw new Error(data.error || '결제 준비에 실패했습니다');
      }

      const prepareData = await prepareRes.json();

      // 2. PortOne 결제창 호출
      const response = await PortOne.requestPayment({
        storeId: prepareData.storeId,
        channelKey: prepareData.channelKey,
        paymentId: prepareData.paymentId,
        orderName: prepareData.orderName,
        totalAmount: prepareData.totalAmount,
        currency: prepareData.currency,
        payMethod: 'CARD',
        customer: {
          customerId: prepareData.customerId,
          fullName: prepareData.customerName,
          email: prepareData.customerEmail,
        },
        windowType: {
          pc: 'IFRAME',
          mobile: 'REDIRECTION',
        },
        redirectUrl: `${window.location.origin}/console/account/subscription/points?paymentId=${prepareData.paymentId}`,
      });

      // 결과 처리 (PC IFRAME 방식)
      if (response?.code) {
        // 사용자 취소
        if (response.code === 'FAILURE_TYPE_PG' || response.message?.includes('취소')) {
          setIsProcessing(false);
          return;
        }
        throw new Error(response.message || '결제에 실패했습니다');
      }

      if (!response?.paymentId) {
        throw new Error('결제 정보를 받지 못했습니다');
      }

      // 3. 결제 완료 처리
      await completePayment(response.paymentId);
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다');
    } finally {
      setIsProcessing(false);
    }
  };

  const completePayment = async (paymentId: string) => {
    try {
      const completeRes = await fetch('/api/points/purchase', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentId }),
      });

      if (!completeRes.ok) {
        const data = await completeRes.json();
        throw new Error(data.error || '포인트 충전에 실패했습니다');
      }

      const result = await completeRes.json();

      toast.success(`${formatNumber(result.chargedPoints)}P가 충전되었습니다!`);

      // 잔액 새로고침
      await fetchData();
      setSelectedPackageId(null);

      // 구독 페이지로 이동
      router.push('/console/account/subscription');
    } catch (err) {
      throw err;
    }
  };

  // URL 파라미터에서 결제 완료 처리 (모바일 리다이렉션)
  useEffect(() => {
    const url = new URL(window.location.href);
    const paymentId = url.searchParams.get('paymentId');

    if (paymentId) {
      // URL 정리
      url.searchParams.delete('paymentId');
      window.history.replaceState({}, '', url.pathname);

      // 결제 완료 처리
      setIsProcessing(true);
      completePayment(paymentId)
        .catch((err) => {
          setError(err instanceof Error ? err.message : '포인트 충전에 실패했습니다');
        })
        .finally(() => {
          setIsProcessing(false);
        });
    }
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* 뒤로 가기 */}
      <Button variant="ghost" size="sm" asChild className="-ml-2">
        <Link href="/console/account/subscription">
          <ArrowLeft className="mr-2 h-4 w-4" />
          구독 관리로 돌아가기
        </Link>
      </Button>

      {/* 헤더 */}
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
          <Coins className="h-8 w-8 text-primary" />
        </div>
        <h2 className="text-2xl font-bold text-foreground">포인트 충전</h2>
        <p className="mt-2 text-muted-foreground">
          AI 응답에 사용되는 포인트를 충전하세요
        </p>
      </div>

      {/* 현재 포인트 잔액 */}
      {balance && (
        <Card>
          <CardContent className="py-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">현재 잔액</p>
                <p
                  className={cn(
                    'text-3xl font-bold',
                    balance.isLow ? 'text-destructive' : 'text-foreground'
                  )}
                >
                  {formatNumber(balance.balance)}
                  <span className="ml-1 text-lg font-normal text-muted-foreground">P</span>
                </p>
              </div>
              {balance.isLow && (
                <Badge variant="destructive" className="gap-1">
                  <AlertCircle className="h-3 w-3" />
                  잔액 부족
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      )}

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

      {/* 포인트 패키지 선택 */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-foreground">충전 패키지 선택</h3>

        <div className="grid gap-4 sm:grid-cols-2">
          {packages.map((pkg) => {
            const isSelected = selectedPackageId === pkg.id;
            const hasDiscount = pkg.discount > 0;

            return (
              <Card
                key={pkg.id}
                className={cn(
                  'relative cursor-pointer transition-all duration-200 hover:border-primary/50',
                  isSelected && 'border-primary ring-2 ring-primary/20'
                )}
                onClick={() => setSelectedPackageId(pkg.id)}
              >
                {/* 할인 배지 */}
                {hasDiscount && (
                  <div className="absolute -right-2 -top-2">
                    <Badge variant="success" className="shadow-md">
                      {pkg.discount}% 할인
                    </Badge>
                  </div>
                )}

                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Sparkles className="h-5 w-5 text-primary" />
                      {pkg.name}
                    </CardTitle>
                    {isSelected && (
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary">
                        <Check className="h-4 w-4 text-primary-foreground" />
                      </div>
                    )}
                  </div>
                </CardHeader>

                <CardContent className="space-y-3">
                  {/* 포인트 수량 */}
                  <div className="text-center">
                    <span className="text-3xl font-bold text-foreground">
                      {formatNumber(pkg.points)}
                    </span>
                    <span className="ml-1 text-lg text-muted-foreground">P</span>
                  </div>

                  {/* 가격 */}
                  <div className="text-center">
                    <span className="text-xl font-semibold text-foreground">
                      {formatPrice(pkg.price)}
                    </span>
                  </div>

                  {/* 단가 */}
                  <div className="flex items-center justify-center gap-1 text-sm text-muted-foreground">
                    <TrendingUp className="h-4 w-4" />
                    <span>포인트당 {pkg.pricePerPoint}원</span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* 구매 버튼 */}
      <Card>
        <CardContent className="py-6">
          {selectedPackageId ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-lg bg-muted/50 p-4">
                <span className="text-muted-foreground">결제 금액</span>
                <span className="text-xl font-bold text-foreground">
                  {formatPrice(packages.find((p) => p.id === selectedPackageId)?.price || 0)}
                </span>
              </div>

              <Button
                className="w-full"
                size="lg"
                onClick={handlePurchase}
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    결제 처리 중...
                  </>
                ) : (
                  <>
                    <Coins className="mr-2 h-4 w-4" />
                    포인트 충전하기
                  </>
                )}
              </Button>
            </div>
          ) : (
            <div className="text-center text-muted-foreground">
              위에서 충전할 패키지를 선택해주세요
            </div>
          )}
        </CardContent>
      </Card>

      {/* 안내 사항 */}
      <div className="space-y-2 rounded-lg bg-muted/50 p-4 text-sm text-muted-foreground">
        <p className="font-medium text-foreground">포인트 안내</p>
        <ul className="list-inside list-disc space-y-1">
          <li>1 포인트 = 약 1회 AI 응답</li>
          <li>충전된 포인트는 유효기간이 없습니다</li>
          <li>포인트 환불은 고객센터로 문의해주세요</li>
        </ul>
        <p className="mt-3">결제 관련 문의: support@ffgg.works</p>
      </div>
    </div>
  );
}
