/**
 * 챗봇 현황 모니터링 대시보드
 * 전체 시스템의 챗봇 현황을 모니터링합니다.
 */

import { getChatbotDashboardData } from './actions';
import { ChatbotOverviewCards } from './components/chatbot-overview-cards';
import { ChatbotGrid } from './components/chatbot-grid';
import { RecentActivityList } from './components/recent-activity-list';

export default async function ChatbotDashboardPage() {
  const data = await getChatbotDashboardData();

  if (!data) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">데이터를 불러올 수 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 페이지 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">챗봇 현황</h1>
          <p className="text-muted-foreground">전체 챗봇의 현황과 성과를 모니터링하세요.</p>
        </div>
        <div className="text-right text-sm text-muted-foreground">
          총 {data.overview.totalChatbots}개 챗봇
        </div>
      </div>

      {/* 핵심 지표 카드 */}
      <ChatbotOverviewCards overview={data.overview} />

      {/* 챗봇 그리드 + 최근 활동 */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* 챗봇 목록 */}
        <div className="lg:col-span-2">
          <ChatbotGrid chatbots={data.chatbots} />
        </div>

        {/* 최근 활동 */}
        <div>
          <RecentActivityList activities={data.recentActivity} />
        </div>
      </div>
    </div>
  );
}
