'use client';

/**
 * Console 결제 내역 페이지
 * 과거 결제 내역 조회
 * shadcn/ui 컴포넌트 통일 적용
 */

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, ExternalLink, Receipt, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { paymentStatusBadge } from '@/lib/constants/status-badges';

interface Payment {
  id: string;
  paymentId: string;
  amount: number;
  currency: string;
  status: string;
  payMethod: string | null;
  cardInfo: {
    issuer?: string;
    number?: string;
    type?: string;
  } | null;
  receiptUrl: string | null;
  paidAt: string | null;
  createdAt: string;
}

interface PaymentsResponse {
  payments: Payment[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export default function PaymentHistoryPage() {
  const [data, setData] = useState<PaymentsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  useEffect(() => {
    fetchPayments();
  }, [page]);

  const fetchPayments = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await fetch(`/api/billing/payments?page=${page}&limit=10`);

      if (!res.ok) {
        throw new Error('결제 내역을 불러올 수 없습니다');
      }

      const json = await res.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다');
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateStr: string | null): string => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatPrice = (amount: number, currency: string): string => {
    return amount.toLocaleString('ko-KR') + (currency === 'KRW' ? '원' : ` ${currency}`);
  };

  const getStatusBadge = (status: string) => {
    const config = paymentStatusBadge[status];
    if (config) {
      return <Badge variant={config.variant}>{config.label}</Badge>;
    }
    return <Badge variant="secondary">{status}</Badge>;
  };

  if (isLoading && !data) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Receipt className="h-6 w-6 text-muted-foreground" />
          <div>
            <h2 className="text-xl font-bold text-foreground">결제 내역</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              지난 결제 내역을 확인할 수 있습니다
            </p>
          </div>
        </div>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/console/account/subscription">
            <ArrowLeft className="mr-1 h-4 w-4" />
            구독 관리
          </Link>
        </Button>
      </div>

      {/* 에러 메시지 */}
      {error && (
        <Alert variant="destructive">
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

      {/* 결제 내역 카드 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">전체 결제 내역</CardTitle>
          <CardDescription>
            {data?.pagination.total
              ? `총 ${data.pagination.total}건의 결제 내역`
              : '결제 내역을 조회합니다'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data && data.payments.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>결제일</TableHead>
                  <TableHead>결제 수단</TableHead>
                  <TableHead className="text-right">금액</TableHead>
                  <TableHead>상태</TableHead>
                  <TableHead className="text-center">영수증</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.payments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell className="whitespace-nowrap">
                      {formatDate(payment.paidAt || payment.createdAt)}
                    </TableCell>
                    <TableCell>
                      {payment.cardInfo?.issuer ? (
                        <span>
                          {payment.cardInfo.issuer}
                          {payment.cardInfo.number && (
                            <span className="ml-1 text-muted-foreground">
                              ({payment.cardInfo.number})
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">
                          {payment.payMethod || '-'}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatPrice(payment.amount, payment.currency)}
                    </TableCell>
                    <TableCell>{getStatusBadge(payment.status)}</TableCell>
                    <TableCell className="text-center">
                      {payment.receiptUrl ? (
                        <Button variant="ghost" size="sm" asChild>
                          <a
                            href={payment.receiptUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            보기
                            <ExternalLink className="ml-1 h-3 w-3" />
                          </a>
                        </Button>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="py-12 text-center">
              <Receipt className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <p className="mt-4 text-muted-foreground">결제 내역이 없습니다</p>
            </div>
          )}

          {/* 페이지네이션 */}
          {data && data.pagination.totalPages > 1 && (
            <div className="mt-6 flex items-center justify-center gap-2 border-t border-border pt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                <ChevronLeft className="mr-1 h-4 w-4" />
                이전
              </Button>
              <span className="px-4 text-sm text-muted-foreground">
                {page} / {data.pagination.totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(data.pagination.totalPages, p + 1))}
                disabled={page === data.pagination.totalPages}
              >
                다음
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
