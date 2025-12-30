/**
 * 개별 챗봇 상세 페이지
 * 특정 챗봇의 상세 정보와 성과 지표를 표시합니다.
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getChatbotDetail } from '../actions';
import { ChatbotDetailCards } from './components/chatbot-detail-cards';
import { ConversationTrend } from './components/conversation-trend';
import { ChannelStatus } from './components/channel-status';
import { RecentConversations } from './components/recent-conversations';

interface ChatbotDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function ChatbotDetailPage({ params }: ChatbotDetailPageProps) {
  const { id } = await params;
  const data = await getChatbotDetail(id);

  if (!data) {
    notFound();
  }

  return (
    <div className="space-y-6">
      {/* 페이지 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/admin/chatbots"
            className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <BackIcon className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-semibold text-foreground">{data.chatbot.name}</h1>
            <p className="text-muted-foreground">{data.chatbot.tenantName}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ChannelBadge
            widgetEnabled={data.chatbot.widgetEnabled}
            kakaoEnabled={data.chatbot.kakaoEnabled}
          />
        </div>
      </div>

      {/* 핵심 지표 카드 */}
      <ChatbotDetailCards stats={data.stats} />

      {/* 차트 및 상세 정보 */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* 대화 추이 */}
        <div className="lg:col-span-2">
          <ConversationTrend trend={data.conversationTrend} />
        </div>

        {/* 채널 상태 */}
        <div>
          <ChannelStatus
            widgetEnabled={data.chatbot.widgetEnabled}
            kakaoEnabled={data.chatbot.kakaoEnabled}
            widgetConversations={data.channelStats.widget}
            kakaoConversations={data.channelStats.kakao}
          />
        </div>
      </div>

      {/* 최근 대화 목록 */}
      <RecentConversations conversations={data.recentConversations} chatbotId={id} />
    </div>
  );
}

function BackIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M10 19l-7-7m0 0l7-7m-7 7h18"
      />
    </svg>
  );
}

function ChannelBadge({
  widgetEnabled,
  kakaoEnabled,
}: {
  widgetEnabled: boolean;
  kakaoEnabled: boolean;
}) {
  return (
    <div className="flex gap-2">
      <span
        className={`rounded-full px-3 py-1 text-sm font-medium ${
          widgetEnabled
            ? 'bg-green-500/10 text-green-500'
            : 'bg-muted text-muted-foreground'
        }`}
      >
        웹 위젯 {widgetEnabled ? '활성' : '비활성'}
      </span>
      <span
        className={`rounded-full px-3 py-1 text-sm font-medium ${
          kakaoEnabled
            ? 'bg-yellow-500/10 text-yellow-500'
            : 'bg-muted text-muted-foreground'
        }`}
      >
        카카오 {kakaoEnabled ? '활성' : '비활성'}
      </span>
    </div>
  );
}
