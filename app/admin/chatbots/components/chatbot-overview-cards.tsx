'use client';

/**
 * 챗봇 현황 개요 카드
 * 전체 챗봇 현황의 핵심 지표를 표시합니다.
 */

import type { ChatbotOverview } from '../actions';

interface ChatbotOverviewCardsProps {
  overview: ChatbotOverview;
}

export function ChatbotOverviewCards({ overview }: ChatbotOverviewCardsProps) {
  const activeRate =
    overview.totalChatbots > 0
      ? ((overview.activeChatbots / overview.totalChatbots) * 100).toFixed(1)
      : '0';

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {/* 전체 챗봇 */}
      <div className="rounded-lg border border-border bg-card p-6">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-muted-foreground">전체 챗봇</p>
          <ChatbotIcon className="h-5 w-5 text-muted-foreground" />
        </div>
        <p className="mt-2 text-3xl font-bold text-foreground">{overview.totalChatbots}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          활성 {overview.activeChatbots}개 ({activeRate}%)
        </p>
      </div>

      {/* 오늘 대화 */}
      <div className="rounded-lg border border-border bg-card p-6">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-muted-foreground">오늘 대화</p>
          <MessageIcon className="h-5 w-5 text-muted-foreground" />
        </div>
        <p className="mt-2 text-3xl font-bold text-foreground">
          {overview.todayConversations.toLocaleString()}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          전체 {overview.totalConversations.toLocaleString()}건
        </p>
      </div>

      {/* 총 토큰 사용량 */}
      <div className="rounded-lg border border-border bg-card p-6">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-muted-foreground">총 토큰</p>
          <TokenIcon className="h-5 w-5 text-muted-foreground" />
        </div>
        <p className="mt-2 text-3xl font-bold text-foreground">
          {formatTokens(overview.totalTokens)}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">누적 사용량</p>
      </div>

      {/* 총 비용 */}
      <div className="rounded-lg border border-border bg-card p-6">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-muted-foreground">총 비용</p>
          <CostIcon className="h-5 w-5 text-muted-foreground" />
        </div>
        <p className="mt-2 text-3xl font-bold text-foreground">
          ${overview.totalCostUsd.toFixed(2)}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">누적 비용</p>
      </div>
    </div>
  );
}

function formatTokens(tokens: number): string {
  if (tokens >= 1000000) {
    return `${(tokens / 1000000).toFixed(1)}M`;
  }
  if (tokens >= 1000) {
    return `${(tokens / 1000).toFixed(1)}K`;
  }
  return tokens.toLocaleString();
}

function ChatbotIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
      />
    </svg>
  );
}

function MessageIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z"
      />
    </svg>
  );
}

function TokenIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z"
      />
    </svg>
  );
}

function CostIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}
