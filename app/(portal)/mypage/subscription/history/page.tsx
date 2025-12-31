'use client';

/**
 * 결제 내역 페이지
 * [Billing System] 과거 결제 내역 조회
 */

import { useState, useEffect } from 'react';
import Link from 'next/link';

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

const statusLabels: Record<string, { label: string; className: string }> = {
  PENDING: { label: '대기 중', className: 'bg-yellow-500/10 text-yellow-500' },
  PAID: { label: '결제 완료', className: 'bg-green-500/10 text-green-500' },
  FAILED: { label: '실패', className: 'bg-destructive/10 text-destructive' },
  CANCELLED: { label: '취소됨', className: 'bg-muted text-muted-foreground' },
  REFUNDED: { label: '환불됨', className: 'bg-purple-500/10 text-purple-500' },
  PARTIAL_REFUNDED: { label: '부분 환불', className: 'bg-purple-500/10 text-purple-500' },
};

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

  const getStatusInfo = (status: string) => {
    return statusLabels[status] || { label: status, className: 'bg-muted text-muted-foreground' };
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
        <div>
          <h2 className="text-xl font-bold text-foreground">결제 내역</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            지난 결제 내역을 확인할 수 있습니다
          </p>
        </div>
        <Link
          href="/mypage/subscription"
          className="text-sm text-primary hover:underline"
        >
          ← 구독 관리로 돌아가기
        </Link>
      </div>

      {/* 에러 메시지 */}
      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive">
          {error}
        </div>
      )}

      {/* 결제 내역 테이블 */}
      {data && data.payments.length > 0 ? (
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="min-w-full divide-y divide-border">
            <thead className="bg-muted">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">
                  결제일
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">
                  결제 수단
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">
                  금액
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">
                  상태
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-muted-foreground">
                  영수증
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-card">
              {data.payments.map((payment) => {
                const statusInfo = getStatusInfo(payment.status);
                return (
                  <tr key={payment.id} className="hover:bg-muted/50">
                    <td className="whitespace-nowrap px-4 py-4 text-sm text-foreground">
                      {formatDate(payment.paidAt || payment.createdAt)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-sm text-foreground">
                      {payment.cardInfo?.issuer && (
                        <span>
                          {payment.cardInfo.issuer}
                          {payment.cardInfo.number && (
                            <span className="ml-1 text-muted-foreground">
                              ({payment.cardInfo.number})
                            </span>
                          )}
                        </span>
                      )}
                      {!payment.cardInfo?.issuer && (
                        <span className="text-muted-foreground">
                          {payment.payMethod || '-'}
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-sm font-medium text-foreground">
                      {formatPrice(payment.amount, payment.currency)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-4">
                      <span
                        className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${statusInfo.className}`}
                      >
                        {statusInfo.label}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-sm">
                      {payment.receiptUrl ? (
                        <a
                          href={payment.receiptUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline"
                        >
                          보기
                        </a>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-card p-8 text-center">
          <p className="text-muted-foreground">결제 내역이 없습니다</p>
        </div>
      )}

      {/* 페이지네이션 */}
      {data && data.pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="rounded-lg border border-border px-3 py-2 text-sm text-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
          >
            이전
          </button>
          <span className="px-3 py-2 text-sm text-muted-foreground">
            {page} / {data.pagination.totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(data.pagination.totalPages, p + 1))}
            disabled={page === data.pagination.totalPages}
            className="rounded-lg border border-border px-3 py-2 text-sm text-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
          >
            다음
          </button>
        </div>
      )}
    </div>
  );
}
