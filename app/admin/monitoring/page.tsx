/**
 * 모니터링 페이지
 * [Week 10] 시스템 상태 및 사용량 모니터링
 */

import { getSystemHealth, getUsageMetrics, getRecentActivities } from './actions';
import { MonitoringRefresh } from './monitoring-refresh';

export default async function MonitoringPage() {
  const [health, metrics, activities] = await Promise.all([
    getSystemHealth(),
    getUsageMetrics(),
    getRecentActivities(),
  ]);

  return (
    <div className="space-y-6">
      {/* 페이지 타이틀 + 새로고침 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">시스템 모니터링</h1>
          <p className="text-gray-600">실시간 시스템 상태를 확인하세요.</p>
        </div>
        <MonitoringRefresh />
      </div>

      {/* 시스템 상태 */}
      <div className="grid gap-4 sm:grid-cols-3">
        <HealthCard
          title="데이터베이스"
          status={health?.database.status || 'down'}
          metrics={[
            { label: '지연시간', value: `${health?.database.latency || 0}ms` },
            { label: '연결 수', value: `${health?.database.connections || 0}` },
          ]}
        />
        <HealthCard
          title="API 서버"
          status={health?.api.status || 'down'}
          metrics={[
            { label: '분당 요청', value: `${health?.api.requestsPerMinute || 0}` },
            { label: '에러율', value: `${health?.api.errorRate || 0}%` },
          ]}
        />
        <HealthCard
          title="스토리지"
          status={health?.storage.status || 'down'}
          metrics={[
            {
              label: '사용량',
              value: formatBytes(health?.storage.usedBytes || 0),
            },
            {
              label: '총 용량',
              value: formatBytes(health?.storage.totalBytes || 0),
            },
          ]}
        />
      </div>

      {/* 사용량 차트 */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* 일별 통계 */}
        <div className="rounded-lg border bg-white p-6">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">일별 사용량 (최근 7일)</h2>
          {metrics?.daily && metrics.daily.length > 0 ? (
            <div className="space-y-3">
              {metrics.daily.slice().reverse().map((day) => (
                <div key={day.date} className="flex items-center gap-4">
                  <span className="w-24 text-sm text-gray-600">{formatDateShort(day.date)}</span>
                  <div className="flex-1">
                    <div className="flex gap-1">
                      <div
                        className="h-6 rounded bg-orange-500"
                        style={{
                          width: `${Math.min((day.conversations / 100) * 100, 100)}%`,
                          minWidth: day.conversations > 0 ? '8px' : '0',
                        }}
                        title={`상담 ${day.conversations}건`}
                      />
                      <div
                        className="h-6 rounded bg-blue-500"
                        style={{
                          width: `${Math.min((day.documents / 20) * 100, 100)}%`,
                          minWidth: day.documents > 0 ? '8px' : '0',
                        }}
                        title={`문서 ${day.documents}건`}
                      />
                    </div>
                  </div>
                  <span className="w-20 text-right text-sm text-gray-600">
                    {day.conversations}건
                  </span>
                </div>
              ))}
              <div className="mt-4 flex gap-4 text-xs text-gray-500">
                <span className="flex items-center gap-1">
                  <div className="h-3 w-3 rounded bg-orange-500" />
                  상담
                </span>
                <span className="flex items-center gap-1">
                  <div className="h-3 w-3 rounded bg-blue-500" />
                  문서
                </span>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-500">데이터가 없습니다.</p>
          )}
        </div>

        {/* 최근 활동 */}
        <div className="rounded-lg border bg-white p-6">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">최근 활동</h2>
          {activities.length === 0 ? (
            <p className="text-sm text-gray-500">최근 활동이 없습니다.</p>
          ) : (
            <div className="space-y-3">
              {activities.slice(0, 10).map((activity, idx) => (
                <div key={idx} className="flex items-start gap-3">
                  <ActivityIcon type={activity.type} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-900 truncate">{activity.description}</p>
                    <p className="text-xs text-gray-500">
                      {activity.tenantName} • {formatTimeAgo(activity.createdAt)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// 상태 카드
interface HealthCardProps {
  title: string;
  status: 'healthy' | 'degraded' | 'down';
  metrics: Array<{ label: string; value: string }>;
}

function HealthCard({ title, status, metrics }: HealthCardProps) {
  const statusConfig = {
    healthy: { color: 'bg-green-500', label: '정상', bgColor: 'bg-green-50' },
    degraded: { color: 'bg-yellow-500', label: '저하', bgColor: 'bg-yellow-50' },
    down: { color: 'bg-red-500', label: '장애', bgColor: 'bg-red-50' },
  };

  const config = statusConfig[status];

  return (
    <div className={`rounded-lg border p-6 ${config.bgColor}`}>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-semibold text-gray-900">{title}</h3>
        <div className="flex items-center gap-2">
          <div className={`h-3 w-3 rounded-full ${config.color}`} />
          <span className="text-sm font-medium text-gray-700">{config.label}</span>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        {metrics.map((metric) => (
          <div key={metric.label}>
            <p className="text-xs text-gray-500">{metric.label}</p>
            <p className="text-lg font-semibold text-gray-900">{metric.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// 활동 아이콘
function ActivityIcon({ type }: { type: 'document' | 'conversation' | 'chunk' }) {
  const config = {
    document: { bg: 'bg-blue-100', color: 'text-blue-600' },
    conversation: { bg: 'bg-orange-100', color: 'text-orange-600' },
    chunk: { bg: 'bg-purple-100', color: 'text-purple-600' },
  };

  const { bg, color } = config[type];

  return (
    <div className={`flex h-8 w-8 items-center justify-center rounded-full ${bg}`}>
      {type === 'document' && <DocumentIcon className={`h-4 w-4 ${color}`} />}
      {type === 'conversation' && <ChatIcon className={`h-4 w-4 ${color}`} />}
      {type === 'chunk' && <ChunkIcon className={`h-4 w-4 ${color}`} />}
    </div>
  );
}

// 유틸리티
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function formatDateShort(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
}

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

  if (diffMins < 1) return '방금 전';
  if (diffMins < 60) return `${diffMins}분 전`;
  if (diffHours < 24) return `${diffHours}시간 전`;
  return `${Math.floor(diffHours / 24)}일 전`;
}

// 아이콘
function DocumentIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
      />
    </svg>
  );
}

function ChatIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
      />
    </svg>
  );
}

function ChunkIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 6h16M4 12h16M4 18h7"
      />
    </svg>
  );
}
