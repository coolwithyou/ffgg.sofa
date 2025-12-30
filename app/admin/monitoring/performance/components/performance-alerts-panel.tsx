'use client';

/**
 * 성능 알림 패널 컴포넌트
 * 활성화된 응답 시간 관련 알림을 표시합니다.
 */

interface Alert {
  tenantId: string;
  tenantName: string;
  type: string;
  severity: string;
  message: string;
}

interface PerformanceAlertsPanelProps {
  alerts: Alert[];
}

export function PerformanceAlertsPanel({ alerts }: PerformanceAlertsPanelProps) {
  if (alerts.length === 0) return null;

  const getAlertIcon = (type: string) => {
    if (type === 'response_time_p95') {
      return (
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      );
    }
    return (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M13 10V3L4 14h7v7l9-11h-7z"
        />
      </svg>
    );
  };

  const getSeverityStyles = (severity: string) => {
    if (severity === 'critical') {
      return 'border-destructive/50 bg-destructive/10 text-destructive';
    }
    return 'border-yellow-500/50 bg-yellow-500/10 text-yellow-500';
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
        <svg className="h-5 w-5 text-destructive" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
        활성 알림 ({alerts.length}건)
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {alerts.slice(0, 6).map((alert, idx) => (
          <div
            key={idx}
            className={`flex items-start gap-3 rounded-lg border p-4 ${getSeverityStyles(alert.severity)}`}
          >
            <div className="flex-shrink-0">{getAlertIcon(alert.type)}</div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{alert.message}</p>
              <p className="mt-1 text-xs opacity-75">{alert.tenantName}</p>
            </div>
          </div>
        ))}
      </div>

      {alerts.length > 6 && (
        <p className="text-center text-sm text-muted-foreground">
          +{alerts.length - 6}개의 추가 알림이 있습니다
        </p>
      )}
    </div>
  );
}
