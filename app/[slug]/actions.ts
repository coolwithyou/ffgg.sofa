'use server';

/**
 * 공개 페이지 서버 액션
 *
 * 공개 페이지에서의 채팅 메시지 처리를 담당합니다.
 * - IP 기반 Rate Limiting 적용 (Phase 4에서 구현)
 * - 채널: 'public_page'로 구분
 */

import { processChat } from '@/lib/chat';
import { logger } from '@/lib/logger';

// 메시지 최대 길이 제한
const MAX_MESSAGE_LENGTH = 4000;

export interface PublicPageChatResponse {
  message: string;
  sessionId: string;
  sources?: Array<{
    title: string;
    content?: string;
  }>;
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

  try {
    // TODO: Phase 4에서 Rate Limiting 추가
    // await checkRateLimit(request.ip);

    const response = await processChat(tenantId, {
      message: message.trim(),
      sessionId,
      chatbotId,
      channel: 'public_page',
    });

    // sources 형식 변환: ChatResponse → PublicPageChatResponse
    const mappedSources = response.sources?.map((source, index) => ({
      title: `출처 ${index + 1}`,
      content: source.content,
    }));

    return {
      message: response.message,
      sessionId: response.sessionId,
      sources: mappedSources,
    };
  } catch (error) {
    logger.error('Public page chat failed', error as Error, {
      chatbotId,
      tenantId,
    });

    // 사용자에게 친화적인 에러 메시지 반환
    throw new Error('메시지 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
  }
}
