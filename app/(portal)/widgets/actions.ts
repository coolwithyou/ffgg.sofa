'use server';

/**
 * 위젯 관리 서버 액션
 */

import { eq, and, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { chatbots, chatbotDatasets } from '@/drizzle/schema';
import { validateSession } from '@/lib/auth/session';
import { nanoid } from 'nanoid';

/**
 * 위젯 상태를 포함한 챗봇 정보
 */
export interface ChatbotWithWidgetStatus {
  id: string;
  name: string;
  description: string | null;
  widgetEnabled: boolean;
  widgetApiKey: string | null;
  widgetConfig: Record<string, unknown>;
  datasetCount: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 위젯 상태를 포함한 챗봇 목록 조회
 */
export async function getChatbotsWithWidgetStatus(): Promise<ChatbotWithWidgetStatus[]> {
  const session = await validateSession();
  if (!session) {
    throw new Error('인증이 필요합니다');
  }

  const tenantId = session.tenantId;

  // 챗봇 목록 조회
  const chatbotList = await db
    .select({
      id: chatbots.id,
      name: chatbots.name,
      description: chatbots.description,
      widgetEnabled: chatbots.widgetEnabled,
      widgetApiKey: chatbots.widgetApiKey,
      widgetConfig: chatbots.widgetConfig,
      createdAt: chatbots.createdAt,
      updatedAt: chatbots.updatedAt,
    })
    .from(chatbots)
    .where(eq(chatbots.tenantId, tenantId))
    .orderBy(chatbots.createdAt);

  // 각 챗봇의 데이터셋 수 조회
  const result: ChatbotWithWidgetStatus[] = await Promise.all(
    chatbotList.map(async (chatbot) => {
      const [countResult] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(chatbotDatasets)
        .where(eq(chatbotDatasets.chatbotId, chatbot.id));

      return {
        id: chatbot.id,
        name: chatbot.name,
        description: chatbot.description,
        widgetEnabled: chatbot.widgetEnabled ?? false,
        widgetApiKey: chatbot.widgetApiKey,
        widgetConfig: (chatbot.widgetConfig as Record<string, unknown>) || {},
        datasetCount: countResult?.count || 0,
        createdAt: chatbot.createdAt ?? new Date(),
        updatedAt: chatbot.updatedAt ?? new Date(),
      };
    })
  );

  return result;
}

/**
 * 위젯 API 키 생성
 */
function generateWidgetApiKey(): string {
  return `wgt_${nanoid(32)}`;
}

/**
 * 위젯 활성화/비활성화 토글
 */
export async function toggleWidgetStatus(
  chatbotId: string,
  enabled: boolean
): Promise<{ success: boolean; error?: string; apiKey?: string }> {
  const session = await validateSession();
  if (!session) {
    return { success: false, error: '인증이 필요합니다' };
  }

  const tenantId = session.tenantId;

  try {
    // 챗봇 존재 및 소유권 확인
    const [chatbot] = await db
      .select({
        id: chatbots.id,
        widgetApiKey: chatbots.widgetApiKey,
      })
      .from(chatbots)
      .where(and(eq(chatbots.id, chatbotId), eq(chatbots.tenantId, tenantId)));

    if (!chatbot) {
      return { success: false, error: '챗봇을 찾을 수 없습니다' };
    }

    // 활성화 시 데이터셋 연결 확인
    if (enabled) {
      const [countResult] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(chatbotDatasets)
        .where(eq(chatbotDatasets.chatbotId, chatbotId));

      if (!countResult || countResult.count === 0) {
        return {
          success: false,
          error: '위젯을 활성화하려면 최소 1개의 데이터셋이 연결되어야 합니다',
        };
      }
    }

    // API 키 생성 (없는 경우)
    let apiKey = chatbot.widgetApiKey;
    if (enabled && !apiKey) {
      apiKey = generateWidgetApiKey();
    }

    // 업데이트
    await db
      .update(chatbots)
      .set({
        widgetEnabled: enabled,
        widgetApiKey: apiKey,
        updatedAt: new Date(),
      })
      .where(eq(chatbots.id, chatbotId));

    revalidatePath('/widgets');
    revalidatePath(`/chatbots/${chatbotId}`);

    return { success: true, apiKey: apiKey ?? undefined };
  } catch (error) {
    console.error('[toggleWidgetStatus] Error:', error);
    return { success: false, error: '위젯 상태 변경에 실패했습니다' };
  }
}

/**
 * 위젯 API 키 재생성
 */
export async function regenerateWidgetApiKey(
  chatbotId: string
): Promise<{ success: boolean; error?: string; apiKey?: string }> {
  const session = await validateSession();
  if (!session) {
    return { success: false, error: '인증이 필요합니다' };
  }

  const tenantId = session.tenantId;

  try {
    // 챗봇 존재 및 소유권 확인
    const [chatbot] = await db
      .select({ id: chatbots.id })
      .from(chatbots)
      .where(and(eq(chatbots.id, chatbotId), eq(chatbots.tenantId, tenantId)));

    if (!chatbot) {
      return { success: false, error: '챗봇을 찾을 수 없습니다' };
    }

    // 새 API 키 생성
    const newApiKey = generateWidgetApiKey();

    await db
      .update(chatbots)
      .set({
        widgetApiKey: newApiKey,
        updatedAt: new Date(),
      })
      .where(eq(chatbots.id, chatbotId));

    revalidatePath('/widgets');
    revalidatePath(`/chatbots/${chatbotId}`);

    return { success: true, apiKey: newApiKey };
  } catch (error) {
    console.error('[regenerateWidgetApiKey] Error:', error);
    return { success: false, error: 'API 키 재생성에 실패했습니다' };
  }
}
