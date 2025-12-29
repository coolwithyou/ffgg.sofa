/**
 * 대시보드 페이지
 * [Week 9] 테넌트 현황 요약
 */

import Link from 'next/link';
import { getDashboardData } from './actions';

export default async function DashboardPage() {
  const data = await getDashboardData();

  if (!data) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">데이터를 불러올 수 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 페이지 타이틀 */}
      <div>
        <h1 className="text-2xl font-semibold text-foreground">대시보드</h1>
        <p className="text-muted-foreground">서비스 현황을 한눈에 확인하세요.</p>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="전체 문서"
          value={data.stats.totalDocuments}
          icon={DocumentIcon}
          href="/documents"
        />
        <StatCard
          title="승인된 청크"
          value={data.stats.approvedChunks}
          icon={CheckIcon}
          color="green"
        />
        <StatCard
          title="검토 대기 청크"
          value={data.stats.pendingChunks}
          icon={ClockIcon}
          color="yellow"
        />
        <StatCard
          title="최근 7일 상담"
          value={data.stats.recentConversations}
          subValue={`전체 ${data.stats.totalConversations}건`}
          icon={ChatIcon}
          color="blue"
        />
      </div>

      {/* 최근 활동 */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* 최근 문서 */}
        <div className="rounded-lg border border-border bg-card p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">최근 문서</h2>
            <Link
              href="/documents"
              className="text-sm text-primary hover:text-primary/80"
            >
              전체 보기
            </Link>
          </div>
          {data.recentDocuments.length === 0 ? (
            <p className="text-sm text-muted-foreground">아직 업로드된 문서가 없습니다.</p>
          ) : (
            <ul className="space-y-3">
              {data.recentDocuments.map((doc) => (
                <li
                  key={doc.id}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="truncate font-medium text-foreground">
                    {doc.title}
                  </span>
                  <StatusBadge status={doc.status} />
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* 최근 상담 */}
        <div className="rounded-lg border border-border bg-card p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">최근 상담</h2>
            <Link
              href="/chatbot"
              className="text-sm text-primary hover:text-primary/80"
            >
              테스트하기
            </Link>
          </div>
          {data.recentConversations.length === 0 ? (
            <p className="text-sm text-muted-foreground">아직 상담 기록이 없습니다.</p>
          ) : (
            <ul className="space-y-3">
              {data.recentConversations.map((conv) => (
                <li key={conv.id} className="text-sm">
                  <div className="flex items-center gap-2">
                    <ChannelBadge channel={conv.channel} />
                    <span className="truncate text-foreground">세션: {conv.sessionId}</span>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {formatDate(conv.createdAt)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* 빠른 시작 */}
      <div className="rounded-lg border border-border bg-card p-6">
        <h2 className="mb-4 text-lg font-semibold text-foreground">빠른 시작</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <QuickAction
            href="/documents"
            icon={UploadIcon}
            title="문서 업로드"
            description="PDF, TXT 파일을 업로드하세요"
          />
          <QuickAction
            href="/chatbot"
            icon={ChatIcon}
            title="챗봇 테스트"
            description="챗봇 응답을 테스트하세요"
          />
          <QuickAction
            href="/settings"
            icon={SettingsIcon}
            title="설정 관리"
            description="카카오 연동, 위젯 설정"
          />
        </div>
      </div>
    </div>
  );
}

// 통계 카드 컴포넌트
interface StatCardProps {
  title: string;
  value: number;
  subValue?: string;
  icon: React.ComponentType<{ className?: string }>;
  color?: 'default' | 'green' | 'yellow' | 'blue';
  href?: string;
}

function StatCard({ title, value, subValue, icon: Icon, href }: StatCardProps) {
  const content = (
    <div className="rounded-lg border border-border bg-card p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="mt-2 text-3xl font-semibold text-foreground">{value.toLocaleString()}</p>
          {subValue && <p className="mt-1 text-sm text-muted-foreground">{subValue}</p>}
        </div>
        <div className="rounded-md bg-muted p-3">
          <Icon className="h-5 w-5 text-muted-foreground" />
        </div>
      </div>
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block transition-colors hover:border-primary/50">
        {content}
      </Link>
    );
  }

  return content;
}

// 상태 배지 컴포넌트
function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; className: string }> = {
    uploaded: { label: '업로드됨', className: 'text-muted-foreground' },
    processing: { label: '처리중', className: 'text-primary' },
    chunked: { label: '청킹완료', className: 'text-primary' },
    reviewing: { label: '검토중', className: 'text-muted-foreground' },
    approved: { label: '승인됨', className: 'text-foreground' },
    failed: { label: '실패', className: 'text-destructive' },
  };

  const { label, className } = config[status] || { label: status, className: 'text-muted-foreground' };

  return (
    <span className={`text-sm ${className}`}>
      {label}
    </span>
  );
}

// 채널 배지 컴포넌트
function ChannelBadge({ channel }: { channel: string }) {
  const config: Record<string, { label: string; className: string }> = {
    web: { label: '웹', className: 'bg-muted text-muted-foreground' },
    kakao: { label: '카카오', className: 'bg-muted text-muted-foreground' },
    api: { label: 'API', className: 'bg-muted text-muted-foreground' },
  };

  const { label, className } = config[channel] || { label: channel, className: 'bg-muted text-muted-foreground' };

  return (
    <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium ${className}`}>
      {label}
    </span>
  );
}

// 빠른 시작 액션 컴포넌트
interface QuickActionProps {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}

function QuickAction({ href, icon: Icon, title, description }: QuickActionProps) {
  return (
    <Link
      href={href}
      className="flex items-start gap-4 rounded-lg border border-border p-4 transition-colors hover:bg-muted"
    >
      <div className="rounded-md bg-muted p-2">
        <Icon className="h-5 w-5 text-muted-foreground" />
      </div>
      <div>
        <h3 className="font-medium text-foreground">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </Link>
  );
}

// 날짜 포맷팅
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return '방금 전';
  if (diffMins < 60) return `${diffMins}분 전`;
  if (diffHours < 24) return `${diffHours}시간 전`;
  if (diffDays < 7) return `${diffDays}일 전`;

  return date.toLocaleDateString('ko-KR', {
    month: 'short',
    day: 'numeric',
  });
}

// 아이콘 컴포넌트들
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

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  );
}

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
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

function UploadIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
      />
    </svg>
  );
}

function SettingsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
      />
    </svg>
  );
}
