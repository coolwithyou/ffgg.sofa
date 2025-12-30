'use server';

/**
 * 챗봇 테스트 서버 액션
 * [Week 9] 테넌트용 챗봇 테스트
 */

import { validateSession } from '@/lib/auth';
import { processChat } from '@/lib/chat';
import { logger } from '@/lib/logger';
import { db, chatbots } from '@/lib/db';
import { eq, desc, sql } from 'drizzle-orm';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: Array<{
    documentId: string;
    chunkId: string;
    content: string;
    score: number;
  }>;
  createdAt: string;
}

export interface TestableChatbot {
  id: string;
  name: string;
  isDefault: boolean;
  datasetCount: number;
}

/**
 * 테스트 가능한 챗봇 목록 조회
 */
export async function getTestableChatbots(): Promise<{
  success: boolean;
  chatbots?: TestableChatbot[];
  error?: string;
}> {
  const session = await validateSession();

  if (!session) {
    return { success: false, error: '인증이 필요합니다.' };
  }

  try {
    const result = await db
      .select({
        id: chatbots.id,
        name: chatbots.name,
        isDefault: chatbots.isDefault,
        datasetCount: sql<number>`(
          SELECT COUNT(*)::int FROM chatbot_datasets
          WHERE chatbot_datasets.chatbot_id = chatbots.id
        )`,
      })
      .from(chatbots)
      .where(eq(chatbots.tenantId, session.tenantId))
      .orderBy(desc(chatbots.isDefault), desc(chatbots.createdAt));

    return {
      success: true,
      chatbots: result.map((c) => ({
        id: c.id,
        name: c.name,
        isDefault: c.isDefault || false,
        datasetCount: c.datasetCount || 0,
      })),
    };
  } catch (error) {
    logger.error('Failed to get testable chatbots', error as Error, {
      tenantId: session.tenantId,
    });

    return {
      success: false,
      error: '챗봇 목록을 불러오는데 실패했습니다.',
    };
  }
}

/**
 * 테스트 메시지 전송
 */
export async function sendTestMessage(
  message: string,
  sessionId: string,
  chatbotId: string
): Promise<{
  success: boolean;
  message?: ChatMessage;
  error?: string;
}> {
  const session = await validateSession();

  if (!session) {
    return { success: false, error: '인증이 필요합니다.' };
  }

  if (!message.trim()) {
    return { success: false, error: '메시지를 입력해주세요.' };
  }

  if (!chatbotId) {
    return { success: false, error: '테스트할 챗봇을 선택해주세요.' };
  }

  try {
    const response = await processChat(session.tenantId, {
      message: message.trim(),
      sessionId: `portal-test-${chatbotId}-${sessionId}`,
      channel: 'web',
      chatbotId,
    });

    const chatMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: response.message,
      sources: response.sources,
      createdAt: new Date().toISOString(),
    };

    logger.info('Portal chat test', {
      tenantId: session.tenantId,
      chatbotId,
      messageLength: message.length,
      responseLength: response.message.length,
      sourcesCount: response.sources?.length || 0,
    });

    return { success: true, message: chatMessage };
  } catch (error) {
    logger.error('Portal chat test failed', error as Error, {
      tenantId: session.tenantId,
    });

    return {
      success: false,
      error: '응답 생성에 실패했습니다. 잠시 후 다시 시도해주세요.',
    };
  }
}
