'use server';

/**
 * 공개 페이지 서버 액션
 *
 * 공개 페이지에서의 채팅 메시지 처리를 담당합니다.
 * - IP 기반 Rate Limiting 적용
 * - 포인트 검증 및 차감
 * - 채널: 'public_page'로 구분
 */

import { headers } from 'next/headers';
import { processChat } from '@/lib/chat';
import { logger } from '@/lib/logger';
import { checkPublicPageRateLimit } from '@/lib/middleware/rate-limit';
import { validatePointsForResponse, usePoints } from '@/lib/points';

// 메시지 최대 길이 제한
const MAX_MESSAGE_LENGTH = 4000;

export interface PublicPageChatResponse {
  message: string;
  sessionId: string;
  sources?: Array<{
    title: string;
    content?: string;
    relevance?: number;
    documentId?: string;
    chunkId?: string;
  }>;
  pointsWarning?: {
    code: 'POINTS_LOW_WARNING';
    remainingBalance: number;
    message: string;
  };
}

export interface PublicPageChatError {
  error: string;
  code?: 'INSUFFICIENT_POINTS' | 'RATE_LIMIT' | 'VALIDATION_ERROR';
  details?: {
    currentBalance?: number;
    requiredPoints?: number;
    message?: string;
  };
}

/**
 * 공개 페이지 채팅 메시지 전송
 *
 * @param chatbotId - 챗봇 ID
 * @param tenantId - 테넌트 ID
 * @param message - 사용자 메시지
 * @param sessionId - 세션 ID (선택)
 */
export async function sendPublicPageMessage(
  chatbotId: string,
  tenantId: string,
  message: string,
  sessionId?: string
): Promise<PublicPageChatResponse> {
  // 메시지 유효성 검사
  if (!message || message.trim().length === 0) {
    throw new Error('메시지를 입력해주세요.');
  }

  if (message.length > MAX_MESSAGE_LENGTH) {
    throw new Error(`메시지는 ${MAX_MESSAGE_LENGTH}자 이하여야 합니다.`);
  }

  // IP 기반 Rate Limiting
  const headersList = await headers();
  const ip =
    headersList.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    headersList.get('x-real-ip') ||
    'unknown';

  const rateLimitResult = await checkPublicPageRateLimit(ip);

  if (!rateLimitResult.allowed) {
    const error: PublicPageChatError = {
      error:
        rateLimitResult.reason === 'daily'
          ? '일일 메시지 한도에 도달했습니다. 내일 다시 시도해주세요.'
          : '잠시 후 다시 시도해주세요. (요청이 너무 많습니다)',
      code: 'RATE_LIMIT',
    };
    throw new Error(JSON.stringify(error));
  }

  // 포인트 검증
  const pointValidation = await validatePointsForResponse(tenantId);

  if (!pointValidation.canProceed) {
    const error: PublicPageChatError = {
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

  try {
    const response = await processChat(tenantId, {
      message: message.trim(),
      sessionId,
      chatbotId,
      channel: 'public_page',
    });

    // 포인트 차감 (AI 응답 성공 후)
    await usePoints({
      tenantId,
      metadata: {
        chatbotId,
        conversationId: response.sessionId,
        channel: 'public_page',
      },
    });

    // sources 형식 변환: ChatResponse → PublicPageChatResponse
    const mappedSources = response.sources?.map((source, index) => ({
      title: `출처 ${index + 1}`,
      content: source.content,
      relevance: source.score,
      documentId: source.documentId,
      chunkId: source.chunkId,
    }));

    // 포인트 부족 경고가 있으면 응답에 포함
    const result: PublicPageChatResponse = {
      message: response.message,
      sessionId: response.sessionId,
      sources: mappedSources,
    };

    if (pointValidation.errorCode === 'POINTS_LOW_WARNING') {
      result.pointsWarning = {
        code: 'POINTS_LOW_WARNING',
        remainingBalance: pointValidation.currentBalance - pointValidation.requiredPoints,
        message: pointValidation.message || '포인트가 부족해지고 있습니다.',
      };
    }

    return result;
  } catch (error) {
    logger.error('Public page chat failed', error as Error, {
      chatbotId,
      tenantId,
    });

    // 사용자에게 친화적인 에러 메시지 반환
    const errorResponse: PublicPageChatError = {
      error: '메시지 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
    };
    throw new Error(JSON.stringify(errorResponse));
  }
}
