'use server';

/**
 * 위젯 서버 액션
 * [Week 7] 위젯 접근 검증 및 채팅 처리
 */

import { db, tenants } from '@/lib/db';
import { chatbots } from '@/drizzle/schema';
import { eq, and } from 'drizzle-orm';
import { processChat } from '@/lib/chat';
import { logger } from '@/lib/logger';
import type { WidgetConfig, WidgetChatResponse } from '@/lib/widget/types';

interface ValidationResult {
  valid: boolean;
  error?: string;
  config?: Partial<WidgetConfig>;
  chatbotId?: string;
}

/**
 * 위젯 접근 검증
 * API 키로 챗봇을 찾고, 해당 테넌트가 활성 상태인지 확인
 */
export async function validateWidgetAccess(
  tenantId: string,
  apiKey: string
): Promise<ValidationResult> {
  try {
    // 테넌트 조회
    const tenant = await db.query.tenants.findFirst({
      where: eq(tenants.id, tenantId),
      columns: {
        id: true,
        status: true,
      },
    });

    if (!tenant) {
      return { valid: false, error: '테넌트를 찾을 수 없습니다.' };
    }

    if (tenant.status !== 'active') {
      return { valid: false, error: '비활성화된 테넌트입니다.' };
    }

    // API 키로 챗봇 조회
    const [chatbot] = await db
      .select({
        id: chatbots.id,
        widgetEnabled: chatbots.widgetEnabled,
        widgetConfig: chatbots.widgetConfig,
      })
      .from(chatbots)
      .where(
        and(
          eq(chatbots.tenantId, tenantId),
          eq(chatbots.widgetApiKey, apiKey)
        )
      );

    if (!chatbot) {
      return { valid: false, error: '유효하지 않은 API 키입니다.' };
    }

    if (!chatbot.widgetEnabled) {
      return { valid: false, error: '위젯이 비활성화되어 있습니다.' };
    }

    // 위젯 설정 로드
    const widgetConfig = (chatbot.widgetConfig as Partial<WidgetConfig>) || {};

    return {
      valid: true,
      config: {
        ...widgetConfig,
        tenantId,
      },
      chatbotId: chatbot.id,
    };
  } catch (error) {
    logger.error('Widget access validation failed', error as Error, { tenantId });
    return { valid: false, error: '검증 중 오류가 발생했습니다.' };
  }
}

// 메시지 최대 길이 제한
const MAX_MESSAGE_LENGTH = 4000;

/**
 * 위젯 채팅 메시지 처리
 */
export async function sendWidgetMessage(
  tenantId: string,
  message: string,
  sessionId?: string
): Promise<WidgetChatResponse> {
  // 메시지 길이 검증
  if (!message || message.length > MAX_MESSAGE_LENGTH) {
    throw new Error('메시지는 1자 이상 4000자 이하여야 합니다.');
  }

  try {
    const response = await processChat(tenantId, {
      message: message.trim(),
      sessionId,
      channel: 'web',
    });

    return {
      message: response.message,
      sessionId: response.sessionId,
      sources: response.sources,
    };
  } catch (error) {
    logger.error('Widget chat failed', error as Error, { tenantId });
    throw new Error('메시지 처리 중 오류가 발생했습니다.');
  }
}
