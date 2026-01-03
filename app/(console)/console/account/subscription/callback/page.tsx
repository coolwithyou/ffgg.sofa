'use client';

/**
 * Console PortOne 빌링키 발급 콜백 페이지
 * 모바일 리다이렉션 방식에서 빌링키 발급 결과 처리
 */

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { Check, X } from 'lucide-react';

// Console용 SessionStorage 키
const SESSION_STORAGE_KEY = 'console_pendingSubscription';

function CallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [message, setMessage] = useState('결제 정보를 처리하고 있습니다...');

  useEffect(() => {
    handleCallback();
  }, []);

  const handleCallback = async () => {
    try {
      // PortOne에서 리다이렉션으로 전달된 파라미터 확인
      const code = searchParams.get('code');
      const billingKey = searchParams.get('billingKey');
      const errorMessage = searchParams.get('message');

      // 에러 응답 처리
      if (code && code !== 'RESULT_SUCCESS') {
        throw new Error(errorMessage || '빌링키 발급에 실패했습니다');
      }

      if (!billingKey) {
        throw new Error('빌링키를 받지 못했습니다');
      }

      // sessionStorage에서 선택한 플랜 정보 가져오기
      const pendingSubscription = sessionStorage.getItem(SESSION_STORAGE_KEY);
      if (!pendingSubscription) {
        throw new Error('구독 정보를 찾을 수 없습니다. 다시 시도해주세요.');
      }

      const { planId, billingCycle } = JSON.parse(pendingSubscription);
      sessionStorage.removeItem(SESSION_STORAGE_KEY);

      // 빌링키 저장 및 구독 시작
      const res = await fetch('/api/billing/billing-key/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          billingKey,
          planId,
          billingCycle,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || '구독 시작에 실패했습니다');
      }

      setStatus('success');
      setMessage('구독이 시작되었습니다! 잠시 후 구독 관리 페이지로 이동합니다.');

      // 성공 시 구독 페이지로 이동
      setTimeout(() => {
        router.push('/console/account/subscription');
      }, 2000);
    } catch (err) {
      setStatus('error');
      setMessage(err instanceof Error ? err.message : '오류가 발생했습니다');
    }
  };

  return (
    <div className="mx-auto max-w-md space-y-6 py-12">
      <div className="rounded-lg border border-border bg-card p-8 text-center">
        {status === 'processing' && (
          <>
            <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <p className="text-foreground">{message}</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-500/10">
              <Check className="h-6 w-6 text-green-500" />
            </div>
            <p className="font-medium text-foreground">{message}</p>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
              <X className="h-6 w-6 text-destructive" />
            </div>
            <p className="mb-4 text-destructive">{message}</p>
            <button
              onClick={() => router.push('/console/account/subscription/plans')}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              다시 시도하기
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function CallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      }
    >
      <CallbackContent />
    </Suspense>
  );
}
