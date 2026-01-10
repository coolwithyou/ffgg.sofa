'use server';

/**
 * 챗봇 현황 모니터링 서버 액션
 */

import { validateSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { chatbots, conversations, tenants, tokenUsageLogs } from '@/drizzle/schema';
import { eq, sql, and, gte, desc, count } from 'drizzle-orm';

export interface ChatbotStats {
  id: string;
  name: string;
  description: string | null;
  tenantId: string;
  tenantName: string;
  widgetEnabled: boolean;
  kakaoEnabled: boolean;
  totalConversations: number;
  todayConversations: number;
  weeklyConversations: number;
  totalTokens: number;
  totalCostUsd: number;
  lastActivityAt: Date | null;
  createdAt: Date;
}

export interface ChatbotOverview {
  totalChatbots: number;
  activeChatbots: number;
  totalConversations: number;
  todayConversations: number;
  totalTokens: number;
  totalCostUsd: number;
}

export interface ChatbotDashboardData {
  overview: ChatbotOverview;
  chatbots: ChatbotStats[];
  recentActivity: Array<{
    chatbotId: string;
    chatbotName: string;
    tenantName: string;
    conversationCount: number;
    lastActivityAt: Date;
  }>;
}

/**
 * 챗봇 대시보드 데이터 조회
 */
export async function getChatbotDashboardData(): Promise<ChatbotDashboardData | null> {
  const session = await validateSession();
  if (!session || (session.role !== 'internal_operator' && session.role !== 'admin')) {
    return null;
  }

  try {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // 전체 챗봇 목록 조회 (테넌트 정보 포함)
    const allChatbots = await db
      .select({
        id: chatbots.id,
        name: chatbots.name,
        description: chatbots.description,
        tenantId: chatbots.tenantId,
        tenantName: tenants.name,
        widgetEnabled: chatbots.widgetEnabled,
        kakaoEnabled: chatbots.kakaoEnabled,
        createdAt: chatbots.createdAt,
      })
      .from(chatbots)
      .innerJoin(tenants, eq(chatbots.tenantId, tenants.id));

    // 챗봇별 대화 수 집계
    // Note: Drizzle sql 템플릿에서 Date 객체는 ISO 문자열로 변환 필요
    const todayStartISO = todayStart.toISOString();
    const weekStartISO = weekStart.toISOString();

    const conversationCounts = await db
      .select({
        chatbotId: conversations.chatbotId,
        total: count(),
        today: sql<number>`COUNT(*) FILTER (WHERE ${conversations.createdAt} >= ${todayStartISO}::timestamptz)`,
        weekly: sql<number>`COUNT(*) FILTER (WHERE ${conversations.createdAt} >= ${weekStartISO}::timestamptz)`,
        lastActivityAt: sql<Date>`MAX(${conversations.updatedAt})`,
      })
      .from(conversations)
      .where(sql`${conversations.chatbotId} IS NOT NULL`)
      .groupBy(conversations.chatbotId);

    const conversationMap = new Map(
      conversationCounts.map((c) => [
        c.chatbotId,
        {
          total: Number(c.total),
          today: Number(c.today),
          weekly: Number(c.weekly),
          lastActivityAt: c.lastActivityAt,
        },
      ])
    );

    // 챗봇별 토큰 사용량 집계
    const tokenCounts = await db
      .select({
        chatbotId: tokenUsageLogs.chatbotId,
        totalTokens: sql<number>`COALESCE(SUM(${tokenUsageLogs.totalTokens}), 0)`,
        totalCostUsd: sql<number>`COALESCE(SUM(${tokenUsageLogs.totalCostUsd}), 0)`,
      })
      .from(tokenUsageLogs)
      .where(sql`${tokenUsageLogs.chatbotId} IS NOT NULL`)
      .groupBy(tokenUsageLogs.chatbotId);

    const tokenMap = new Map(
      tokenCounts.map((t) => [
        t.chatbotId,
        {
          totalTokens: Number(t.totalTokens),
          totalCostUsd: Number(t.totalCostUsd),
        },
      ])
    );

    // 챗봇 통계 조합
    const chatbotStats: ChatbotStats[] = allChatbots.map((bot) => {
      const convStats = conversationMap.get(bot.id) || {
        total: 0,
        today: 0,
        weekly: 0,
        lastActivityAt: null,
      };
      const tokenStats = tokenMap.get(bot.id) || { totalTokens: 0, totalCostUsd: 0 };

      return {
        id: bot.id,
        name: bot.name,
        description: bot.description,
        tenantId: bot.tenantId,
        tenantName: bot.tenantName,
        widgetEnabled: bot.widgetEnabled ?? false,
        kakaoEnabled: bot.kakaoEnabled ?? false,
        totalConversations: convStats.total,
        todayConversations: convStats.today,
        weeklyConversations: convStats.weekly,
        totalTokens: tokenStats.totalTokens,
        totalCostUsd: tokenStats.totalCostUsd,
        lastActivityAt: convStats.lastActivityAt,
        createdAt: bot.createdAt!,
      };
    });

    // 활성 챗봇 (최근 7일 내 대화가 있는 챗봇)
    const activeChatbots = chatbotStats.filter((bot) => bot.weeklyConversations > 0);

    // 전체 통계
    const overview: ChatbotOverview = {
      totalChatbots: chatbotStats.length,
      activeChatbots: activeChatbots.length,
      totalConversations: chatbotStats.reduce((sum, bot) => sum + bot.totalConversations, 0),
      todayConversations: chatbotStats.reduce((sum, bot) => sum + bot.todayConversations, 0),
      totalTokens: chatbotStats.reduce((sum, bot) => sum + bot.totalTokens, 0),
      totalCostUsd: chatbotStats.reduce((sum, bot) => sum + bot.totalCostUsd, 0),
    };

    // 최근 활동 (대화가 있는 챗봇만, 최근 활동순 정렬)
    const recentActivity = chatbotStats
      .filter((bot) => bot.lastActivityAt !== null)
      .sort(
        (a, b) =>
          new Date(b.lastActivityAt!).getTime() - new Date(a.lastActivityAt!).getTime()
      )
      .slice(0, 10)
      .map((bot) => ({
        chatbotId: bot.id,
        chatbotName: bot.name,
        tenantName: bot.tenantName,
        conversationCount: bot.totalConversations,
        lastActivityAt: bot.lastActivityAt!,
      }));

    return {
      overview,
      chatbots: chatbotStats.sort((a, b) => b.totalConversations - a.totalConversations),
      recentActivity,
    };
  } catch (error) {
    console.error('Failed to get chatbot dashboard data:', error);
    return null;
  }
}

/**
 * 특정 챗봇 상세 정보 조회
 */
export async function getChatbotDetail(chatbotId: string) {
  const session = await validateSession();
  if (!session || (session.role !== 'internal_operator' && session.role !== 'admin')) {
    return null;
  }

  try {
    const [chatbot] = await db
      .select({
        id: chatbots.id,
        name: chatbots.name,
        description: chatbots.description,
        tenantId: chatbots.tenantId,
        tenantName: tenants.name,
        widgetEnabled: chatbots.widgetEnabled,
        kakaoEnabled: chatbots.kakaoEnabled,
        llmConfig: chatbots.llmConfig,
        searchConfig: chatbots.searchConfig,
        createdAt: chatbots.createdAt,
      })
      .from(chatbots)
      .innerJoin(tenants, eq(chatbots.tenantId, tenants.id))
      .where(eq(chatbots.id, chatbotId))
      .limit(1);

    if (!chatbot) {
      return null;
    }

    // 대화 통계
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // Note: Drizzle sql 템플릿에서 Date 객체는 ISO 문자열로 변환 필요
    const todayStartISO = todayStart.toISOString();
    const weekStartISO = weekStart.toISOString();
    const monthStartISO = monthStart.toISOString();

    const [conversationStats] = await db
      .select({
        total: count(),
        today: sql<number>`COUNT(*) FILTER (WHERE ${conversations.createdAt} >= ${todayStartISO}::timestamptz)`,
        weekly: sql<number>`COUNT(*) FILTER (WHERE ${conversations.createdAt} >= ${weekStartISO}::timestamptz)`,
        monthly: sql<number>`COUNT(*) FILTER (WHERE ${conversations.createdAt} >= ${monthStartISO}::timestamptz)`,
      })
      .from(conversations)
      .where(eq(conversations.chatbotId, chatbotId));

    // 토큰 사용량 통계
    const [tokenStats] = await db
      .select({
        totalTokens: sql<number>`COALESCE(SUM(${tokenUsageLogs.totalTokens}), 0)`,
        totalCostUsd: sql<number>`COALESCE(SUM(${tokenUsageLogs.totalCostUsd}), 0)`,
        monthlyTokens: sql<number>`COALESCE(SUM(${tokenUsageLogs.totalTokens}) FILTER (WHERE ${tokenUsageLogs.createdAt} >= ${monthStartISO}::timestamptz), 0)`,
        monthlyCostUsd: sql<number>`COALESCE(SUM(${tokenUsageLogs.totalCostUsd}) FILTER (WHERE ${tokenUsageLogs.createdAt} >= ${monthStartISO}::timestamptz), 0)`,
      })
      .from(tokenUsageLogs)
      .where(eq(tokenUsageLogs.chatbotId, chatbotId));

    // 메시지 수 통계 (평균 계산용) - messages는 JSONB 배열
    const [messageStats] = await db
      .select({
        totalMessages: sql<number>`COALESCE(SUM(jsonb_array_length(${conversations.messages})), 0)`,
      })
      .from(conversations)
      .where(eq(conversations.chatbotId, chatbotId));

    const totalConversations = Number(conversationStats?.total ?? 0);
    const totalMessages = Number(messageStats?.totalMessages ?? 0);
    const avgMessagesPerConversation =
      totalConversations > 0 ? totalMessages / totalConversations : 0;

    // 채널별 대화 수
    const channelStats = await db
      .select({
        channel: conversations.channel,
        count: count(),
      })
      .from(conversations)
      .where(eq(conversations.chatbotId, chatbotId))
      .groupBy(conversations.channel);

    const channelMap = new Map(channelStats.map((c) => [c.channel, Number(c.count)]));

    // 최근 7일 대화 추이
    const conversationTrend = await db
      .select({
        date: sql<Date>`DATE(${conversations.createdAt})`,
        conversationCount: count(),
        messageCount: sql<number>`COALESCE(SUM(jsonb_array_length(${conversations.messages})), 0)`,
      })
      .from(conversations)
      .where(and(eq(conversations.chatbotId, chatbotId), gte(conversations.createdAt, weekStart)))
      .groupBy(sql`DATE(${conversations.createdAt})`)
      .orderBy(sql`DATE(${conversations.createdAt})`);

    // 일별 비용 조회
    const dailyCosts = await db
      .select({
        date: sql<Date>`DATE(${tokenUsageLogs.createdAt})`,
        costUsd: sql<number>`COALESCE(SUM(${tokenUsageLogs.totalCostUsd}), 0)`,
      })
      .from(tokenUsageLogs)
      .where(and(eq(tokenUsageLogs.chatbotId, chatbotId), gte(tokenUsageLogs.createdAt, weekStart)))
      .groupBy(sql`DATE(${tokenUsageLogs.createdAt})`);

    const costMap = new Map(
      dailyCosts.map((c) => [new Date(c.date).toDateString(), Number(c.costUsd)])
    );

    // 추이 데이터에 비용 추가
    const trendWithCost = conversationTrend.map((day) => ({
      date: day.date,
      conversationCount: Number(day.conversationCount),
      messageCount: Number(day.messageCount),
      costUsd: costMap.get(new Date(day.date).toDateString()) ?? 0,
    }));

    // 최근 대화 목록
    const recentConversations = await db
      .select({
        id: conversations.id,
        sessionId: conversations.sessionId,
        channel: conversations.channel,
        messageCount: sql<number>`jsonb_array_length(${conversations.messages})`,
        createdAt: conversations.createdAt,
        updatedAt: conversations.updatedAt,
      })
      .from(conversations)
      .where(eq(conversations.chatbotId, chatbotId))
      .orderBy(desc(conversations.updatedAt))
      .limit(10);

    return {
      chatbot: {
        id: chatbot.id,
        name: chatbot.name,
        description: chatbot.description,
        tenantId: chatbot.tenantId,
        tenantName: chatbot.tenantName,
        widgetEnabled: chatbot.widgetEnabled ?? false,
        kakaoEnabled: chatbot.kakaoEnabled ?? false,
        llmConfig: chatbot.llmConfig,
        searchConfig: chatbot.searchConfig,
        createdAt: chatbot.createdAt,
      },
      stats: {
        totalConversations,
        todayConversations: Number(conversationStats?.today ?? 0),
        weeklyConversations: Number(conversationStats?.weekly ?? 0),
        monthlyConversations: Number(conversationStats?.monthly ?? 0),
        totalTokens: Number(tokenStats?.totalTokens ?? 0),
        totalCostUsd: Number(tokenStats?.totalCostUsd ?? 0),
        monthlyTokens: Number(tokenStats?.monthlyTokens ?? 0),
        monthlyCostUsd: Number(tokenStats?.monthlyCostUsd ?? 0),
        avgMessagesPerConversation,
      },
      channelStats: {
        widget: channelMap.get('widget') ?? 0,
        kakao: channelMap.get('kakao') ?? 0,
      },
      conversationTrend: trendWithCost,
      recentConversations: recentConversations.map((conv) => ({
        id: conv.id,
        channel: (conv.channel ?? 'widget') as 'widget' | 'kakao',
        messageCount: conv.messageCount ?? 0,
        createdAt: conv.createdAt!,
        lastMessageAt: conv.updatedAt!,
      })),
    };
  } catch (error) {
    console.error('Failed to get chatbot detail:', error);
    return null;
  }
}
