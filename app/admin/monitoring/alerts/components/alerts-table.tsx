'use client';

/**
 * 알림 목록 테이블
 * 알림 이력을 표시하고 확인 처리를 지원합니다.
 */

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { AlertRecord } from '../actions';
import { acknowledgeAlert, acknowledgeAlerts } from '../actions';
import type { AlertType, AlertSeverity } from '@/lib/alerts/types';
import { ALERT_CONFIG } from '@/lib/alerts/types';

interface AlertsTableProps {
  alerts: AlertRecord[];
  total: number;
  page: number;
  limit: number;
}

export function AlertsTable({ alerts, total, page, limit }: AlertsTableProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const totalPages = Math.ceil(total / limit);

  const handleAcknowledge = async (alertId: string) => {
    const result = await acknowledgeAlert(alertId);
    if (result) {
      startTransition(() => {
        router.refresh();
      });
    }
  };

  const handleBulkAcknowledge = async () => {
    if (selectedIds.size === 0) return;
    const result = await acknowledgeAlerts(Array.from(selectedIds));
    if (result) {
      setSelectedIds(new Set());
      startTransition(() => {
        router.refresh();
      });
    }
  };

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === alerts.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(alerts.map((a) => a.id)));
    }
  };

  if (alerts.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-12 text-center">
        <BellOffIcon className="mx-auto h-12 w-12 text-muted-foreground" />
        <h3 className="mt-4 text-lg font-medium text-foreground">알림이 없습니다</h3>
        <p className="mt-2 text-muted-foreground">아직 발생한 알림이 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card">
      {/* 테이블 헤더 */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-4">
          <span className="text-sm text-muted-foreground">
            총 {total}건 중 {(page - 1) * limit + 1}-{Math.min(page * limit, total)}
          </span>
          {selectedIds.size > 0 && (
            <button
              onClick={handleBulkAcknowledge}
              disabled={isPending}
              className="rounded-md bg-primary px-3 py-1 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              선택 확인 처리 ({selectedIds.size})
            </button>
          )}
        </div>
      </div>

      {/* 테이블 */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-border">
          <thead className="bg-muted">
            <tr>
              <th className="w-12 px-4 py-3">
                <input
                  type="checkbox"
                  checked={selectedIds.size === alerts.length && alerts.length > 0}
                  onChange={toggleSelectAll}
                  className="rounded border-border"
                />
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                유형
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                테넌트
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                메시지
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                채널
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                발생 시간
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                상태
              </th>
              <th className="w-20 px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border bg-card">
            {alerts.map((alert) => (
              <tr
                key={alert.id}
                className={`hover:bg-muted ${!alert.acknowledged ? 'bg-destructive/5' : ''}`}
              >
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(alert.id)}
                    onChange={() => toggleSelect(alert.id)}
                    className="rounded border-border"
                  />
                </td>
                <td className="px-4 py-3">
                  <AlertTypeBadge type={alert.alertType} />
                </td>
                <td className="px-4 py-3">
                  <span className="font-medium text-foreground">{alert.tenantName}</span>
                </td>
                <td className="max-w-xs px-4 py-3">
                  <p className="truncate text-sm text-muted-foreground" title={alert.message}>
                    {alert.message}
                  </p>
                </td>
                <td className="px-4 py-3">
                  <ChannelBadges channel={alert.alertChannel} />
                </td>
                <td className="px-4 py-3 text-sm text-muted-foreground">
                  {formatDateTime(alert.sentAt)}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge acknowledged={alert.acknowledged} />
                </td>
                <td className="px-4 py-3">
                  {!alert.acknowledged && (
                    <button
                      onClick={() => handleAcknowledge(alert.id)}
                      disabled={isPending}
                      className="rounded-md px-2 py-1 text-sm text-primary hover:bg-primary/10 disabled:opacity-50"
                    >
                      확인
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 페이지네이션 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 border-t border-border px-4 py-3">
          <button
            onClick={() => router.push(`/admin/monitoring/alerts?page=${page - 1}`)}
            disabled={page <= 1}
            className="rounded-md px-3 py-1 text-sm text-muted-foreground hover:bg-muted disabled:opacity-50"
          >
            이전
          </button>
          <span className="text-sm text-muted-foreground">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => router.push(`/admin/monitoring/alerts?page=${page + 1}`)}
            disabled={page >= totalPages}
            className="rounded-md px-3 py-1 text-sm text-muted-foreground hover:bg-muted disabled:opacity-50"
          >
            다음
          </button>
        </div>
      )}
    </div>
  );
}

function AlertTypeBadge({ type }: { type: AlertType }) {
  const config = ALERT_CONFIG[type];
  const severityStyles: Record<AlertSeverity, string> = {
    info: 'bg-primary/10 text-primary',
    warning: 'bg-yellow-500/10 text-yellow-500',
    critical: 'bg-destructive/10 text-destructive',
  };

  return (
    <span className={`rounded-full px-2 py-1 text-xs font-medium ${severityStyles[config.severity]}`}>
      {config.label}
    </span>
  );
}

function ChannelBadges({ channel }: { channel: string }) {
  const channels = channel.split(',').filter(Boolean);

  if (channels.length === 0 || channel === 'none') {
    return <span className="text-sm text-muted-foreground">-</span>;
  }

  return (
    <div className="flex gap-1">
      {channels.includes('email') && (
        <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
          이메일
        </span>
      )}
      {channels.includes('slack') && (
        <span className="rounded bg-purple-500/10 px-1.5 py-0.5 text-xs text-purple-500">
          Slack
        </span>
      )}
    </div>
  );
}

function StatusBadge({ acknowledged }: { acknowledged: boolean }) {
  if (acknowledged) {
    return (
      <span className="rounded-full bg-green-500/10 px-2 py-1 text-xs font-medium text-green-500">
        확인됨
      </span>
    );
  }
  return (
    <span className="rounded-full bg-destructive/10 px-2 py-1 text-xs font-medium text-destructive">
      미확인
    </span>
  );
}

function formatDateTime(date: Date): string {
  const d = new Date(date);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return '방금 전';
  if (diffMins < 60) return `${diffMins}분 전`;
  if (diffHours < 24) return `${diffHours}시간 전`;
  if (diffDays < 7) return `${diffDays}일 전`;

  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}

function BellOffIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
      />
    </svg>
  );
}
