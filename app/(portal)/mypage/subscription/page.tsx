'use client';

/**
 * 구독 탭
 * 현재 티어 및 사용량 표시
 */

import { useState, useEffect } from 'react';

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

const tierLabels: Record<string, { name: string; color: string }> = {
  basic: { name: 'Basic', color: 'bg-muted text-muted-foreground' },
  standard: { name: 'Standard', color: 'bg-primary/10 text-primary' },
  premium: { name: 'Premium', color: 'bg-purple-500/10 text-purple-500' },
};

export default function SubscriptionPage() {
  const [data, setData] = useState<UsageData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchUsage();
  }, []);

  const fetchUsage = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await fetch('/api/user/usage');
      if (!res.ok) {
        throw new Error('사용량을 불러올 수 없습니다');
      }
      const json = await res.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다');
    } finally {
      setIsLoading(false);
    }
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

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive">
        {error}
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const tierInfo = tierLabels[data.tier] || tierLabels.basic;

  const usageItems = [
    {
      label: '챗봇',
      ...data.usage.chatbots,
      format: (v: number) => formatNumber(v) + '개',
    },
    {
      label: '데이터셋',
      ...data.usage.datasets,
      format: (v: number) => formatNumber(v) + '개',
    },
    {
      label: '문서',
      ...data.usage.documents,
      format: (v: number) => formatNumber(v) + '개',
    },
    {
      label: '저장 용량',
      ...data.usage.storage,
      format: (v: number) => formatBytes(v),
    },
    {
      label: '월간 대화',
      ...data.usage.conversations,
      format: (v: number) => formatNumber(v) + '회',
    },
  ];

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* 현재 플랜 */}
      <div className="rounded-lg border border-border bg-card p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">현재 플랜</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              현재 사용 중인 구독 플랜입니다
            </p>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-sm font-medium ${tierInfo.color}`}
          >
            {tierInfo.name}
          </span>
        </div>

        <div className="mt-4 rounded-lg bg-muted/50 p-4">
          <p className="text-sm text-muted-foreground">
            플랜 업그레이드 기능은 곧 제공될 예정입니다.
          </p>
        </div>
      </div>

      {/* 사용량 현황 */}
      <div className="rounded-lg border border-border bg-card p-6">
        <h2 className="mb-6 text-lg font-semibold text-foreground">
          사용량 현황
        </h2>

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
                    사용 한도에 도달했습니다
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 결제 내역 */}
      <div className="rounded-lg border border-border bg-card p-6">
        <h2 className="mb-4 text-lg font-semibold text-foreground">
          결제 내역
        </h2>
        <p className="text-sm text-muted-foreground">
          결제 내역 조회 기능은 곧 제공될 예정입니다.
        </p>
      </div>
    </div>
  );
}
