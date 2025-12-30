'use client';

/**
 * 이상치 알림 배너
 * 전일 대비 급증한 테넌트를 경고합니다.
 */

interface Anomaly {
  tenantId: string;
  tenantName: string;
  todayCost: number;
  yesterdayCost: number;
  increaseRatio: number;
}

interface AnomalyAlertProps {
  anomalies: Anomaly[];
}

export function AnomalyAlert({ anomalies }: AnomalyAlertProps) {
  if (anomalies.length === 0) {
    return null;
  }

  return (
    <div className="rounded-lg border border-yellow-500/50 bg-yellow-500/10 p-4">
      <div className="flex items-start gap-3">
        {/* 경고 아이콘 */}
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-yellow-500/20">
          <svg
            className="h-5 w-5 text-yellow-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>

        <div className="flex-1">
          <h3 className="font-semibold text-yellow-500">
            사용량 이상 감지 ({anomalies.length}건)
          </h3>
          <p className="mt-1 text-sm text-yellow-500/80">
            다음 테넌트에서 전일 대비 비정상적인 사용량 증가가 감지되었습니다.
          </p>

          {/* 이상치 목록 */}
          <div className="mt-3 space-y-2">
            {anomalies.slice(0, 5).map((anomaly) => (
              <div
                key={anomaly.tenantId}
                className="flex items-center justify-between rounded bg-background/50 px-3 py-2"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-foreground">
                    {anomaly.tenantName}
                  </span>
                  <span className="font-mono text-xs text-muted-foreground">
                    {truncateTenantId(anomaly.tenantId)}
                  </span>
                  <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
                    {formatRatio(anomaly.increaseRatio)}
                  </span>
                </div>
                <div className="text-right text-sm">
                  <div className="text-foreground">
                    ${anomaly.yesterdayCost.toFixed(4)} → ${anomaly.todayCost.toFixed(4)}
                  </div>
                  <div className="text-xs text-muted-foreground">어제 → 오늘</div>
                </div>
              </div>
            ))}
          </div>

          {anomalies.length > 5 && (
            <div className="mt-2 text-sm text-yellow-500/80">
              외 {anomalies.length - 5}건의 이상치가 더 있습니다.
            </div>
          )}

          {/* 액션 버튼 */}
          <div className="mt-4 flex gap-2">
            <button className="rounded bg-yellow-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-yellow-600">
              상세 분석
            </button>
            <button className="rounded border border-yellow-500/50 px-3 py-1.5 text-sm font-medium text-yellow-500 hover:bg-yellow-500/10">
              알림 설정
            </button>
          </div>
        </div>

        {/* 닫기 버튼 */}
        <button className="shrink-0 text-yellow-500/60 hover:text-yellow-500">
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}

function truncateTenantId(id: string): string {
  if (id.length <= 12) return id;
  return `${id.slice(0, 8)}...${id.slice(-4)}`;
}

function formatRatio(ratio: number): string {
  return `${ratio.toFixed(1)}x`;
}
