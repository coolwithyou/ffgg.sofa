'use server';

/**
 * 위젯 서버 액션
 * [Week 7] 위젯 접근 검증 및 채팅 처리
 */

import { db, tenants } from '@/lib/db';
import { chatbots, chatbotConfigVersions } from '@/drizzle/schema';
import { eq, and } from 'drizzle-orm';
import { processChat } from '@/lib/chat';
import { logger } from '@/lib/logger';
import { validatePointsForResponse, usePoints } from '@/lib/points';
import type { WidgetConfig, WidgetChatResponse } from '@/lib/widget/types';

/**
 * 위젯 채팅 에러 타입
 */
export interface WidgetChatError {
  error: string;
  code?: 'INSUFFICIENT_POINTS' | 'RATE_LIMIT' | 'VALIDATION_ERROR';
  details?: {
    currentBalance?: number;
    requiredPoints?: number;
    message?: string;
  };
}

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

    // API 키로 챗봇 조회 - published 버전에서 설정 읽기
    const [result] = await db
      .select({
        id: chatbots.id,
        widgetEnabled: chatbots.widgetEnabled,
        // chatbots 테이블 값 (폴백용)
        chatbotWidgetConfig: chatbots.widgetConfig,
        // published 버전 값 (우선)
        publishedWidgetConfig: chatbotConfigVersions.widgetConfig,
      })
      .from(chatbots)
      .leftJoin(
        chatbotConfigVersions,
        and(
          eq(chatbotConfigVersions.chatbotId, chatbots.id),
          eq(chatbotConfigVersions.versionType, 'published')
        )
      )
      .where(
        and(
          eq(chatbots.tenantId, tenantId),
          eq(chatbots.widgetApiKey, apiKey)
        )
      );

    if (!result) {
      return { valid: false, error: '유효하지 않은 API 키입니다.' };
    }

    if (!result.widgetEnabled) {
      return { valid: false, error: '위젯이 비활성화되어 있습니다.' };
    }

    // 위젯 설정 로드 (published 버전 우선, 없으면 chatbots 테이블로 폴백)
    const effectiveConfig = result.publishedWidgetConfig ?? result.chatbotWidgetConfig;
    const widgetConfig = (effectiveConfig as Partial<WidgetConfig>) || {};

    return {
      valid: true,
      config: {
        ...widgetConfig,
        tenantId,
      },
      chatbotId: result.id,
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
  sessionId?: string,
  chatbotId?: string
): Promise<WidgetChatResponse> {
  // 메시지 길이 검증
  if (!message || message.length > MAX_MESSAGE_LENGTH) {
    const error: WidgetChatError = {
      error: '메시지는 1자 이상 4000자 이하여야 합니다.',
      code: 'VALIDATION_ERROR',
    };
    throw new Error(JSON.stringify(error));
  }

  try {
    // 포인트 검증
    const pointValidation = await validatePointsForResponse(tenantId);
    if (!pointValidation.canProceed) {
      const error: WidgetChatError = {
        error: '포인트가 부족합니다',
        code: 'INSUFFICIENT_POINTS',
        details: {
          currentBalance: pointValidation.currentBalance,
          requiredPoints: pointValidation.requiredPoints,
          message: '운영자의 포인트가 부족합니다. 잠시 후 다시 시도해주세요.',
        },
      };
      throw new Error(JSON.stringify(error));
    }

    const response = await processChat(tenantId, {
      message: message.trim(),
      sessionId,
      chatbotId,
      channel: 'web',
    });

    // 포인트 차감
    const { newBalance } = await usePoints({
      tenantId,
      metadata: {
        chatbotId,
        conversationId: response.sessionId,
        channel: 'widget',
      },
    });

    return {
      message: response.message,
      sessionId: response.sessionId,
      sources: response.sources,
      pointsBalance: newBalance,
    };
  } catch (error) {
    // 이미 구조화된 에러면 그대로 전달
    if (error instanceof Error && error.message.startsWith('{')) {
      throw error;
    }
    logger.error('Widget chat failed', error as Error, { tenantId });
    const chatError: WidgetChatError = {
      error: '메시지 처리 중 오류가 발생했습니다.',
    };
    throw new Error(JSON.stringify(chatError));
  }
}
