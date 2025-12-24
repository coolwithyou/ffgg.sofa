'use server';

/**
 * 챗봇 테스트 서버 액션
 * [Week 9] 테넌트용 챗봇 테스트
 */

import { validateSession } from '@/lib/auth';
import { processChat } from '@/lib/chat';
import { logger } from '@/lib/logger';

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

/**
 * 테스트 메시지 전송
 */
export async function sendTestMessage(
  message: string,
  sessionId: string
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

  try {
    const response = await processChat(session.tenantId, {
      message: message.trim(),
      sessionId: `portal-test-${sessionId}`,
      channel: 'web',
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
