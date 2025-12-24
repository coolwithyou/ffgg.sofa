/**
 * 카카오 응답 생성 유틸리티
 * [Week 8] 카카오톡 연동
 */

import type {
  KakaoSkillResponse,
  KakaoSimpleText,
  KakaoTextCard,
  KakaoButton,
  KakaoQuickReply,
} from './types';

// 카카오 응답 최대 길이
const MAX_TEXT_LENGTH = 1000; // simpleText 최대 길이
const MAX_CARD_DESCRIPTION_LENGTH = 400; // textCard description 최대 길이

/**
 * 텍스트를 최대 길이로 자르고 말줄임표 추가
 */
function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

/**
 * 간단 텍스트 응답 생성
 */
export function createSimpleTextResponse(
  text: string,
  options?: {
    quickReplies?: KakaoQuickReply[];
  }
): KakaoSkillResponse {
  const truncatedText = truncateText(text, MAX_TEXT_LENGTH);

  return {
    version: '2.0',
    template: {
      outputs: [
        {
          simpleText: {
            text: truncatedText,
          },
        },
      ],
      ...(options?.quickReplies && { quickReplies: options.quickReplies }),
    },
  };
}

/**
 * 텍스트 카드 응답 생성
 */
export function createTextCardResponse(
  title: string,
  description: string,
  options?: {
    buttons?: KakaoButton[];
    quickReplies?: KakaoQuickReply[];
  }
): KakaoSkillResponse {
  const truncatedDescription = truncateText(description, MAX_CARD_DESCRIPTION_LENGTH);

  return {
    version: '2.0',
    template: {
      outputs: [
        {
          textCard: {
            title,
            description: truncatedDescription,
            ...(options?.buttons && { buttons: options.buttons }),
          },
        },
      ],
      ...(options?.quickReplies && { quickReplies: options.quickReplies }),
    },
  };
}

/**
 * 에러 응답 생성
 */
export function createErrorResponse(
  errorType: 'timeout' | 'not_found' | 'invalid_request' | 'internal_error'
): KakaoSkillResponse {
  const messages: Record<typeof errorType, string> = {
    timeout: '잠시 후 다시 시도해 주세요. 답변을 준비 중입니다.',
    not_found: '설정된 챗봇을 찾을 수 없습니다. 관리자에게 문의해 주세요.',
    invalid_request: '올바르지 않은 요청입니다.',
    internal_error: '죄송합니다. 일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.',
  };

  return createSimpleTextResponse(messages[errorType]);
}

/**
 * 환영 메시지 응답 생성
 */
export function createWelcomeResponse(
  welcomeMessage?: string,
  quickReplies?: KakaoQuickReply[]
): KakaoSkillResponse {
  const defaultMessage = '안녕하세요! 무엇을 도와드릴까요?';

  return createSimpleTextResponse(welcomeMessage || defaultMessage, { quickReplies });
}

/**
 * 소스 정보를 포함한 응답 생성
 */
export function createResponseWithSources(
  answer: string,
  sources: Array<{ title: string; url?: string }>,
  options?: {
    maxLength?: number;
    quickReplies?: KakaoQuickReply[];
  }
): KakaoSkillResponse {
  const maxLength = options?.maxLength || 300;

  // 답변 잘라내기
  let truncatedAnswer = answer;
  if (answer.length > maxLength) {
    truncatedAnswer = answer.slice(0, maxLength - 3) + '...';
  }

  // 소스가 있으면 출처 표시
  if (sources.length > 0) {
    const sourceList = sources
      .slice(0, 3) // 최대 3개
      .map((s) => `📄 ${s.title}`)
      .join('\n');

    const fullText = `${truncatedAnswer}\n\n[출처]\n${sourceList}`;

    // 전체 텍스트가 최대 길이를 넘으면 답변을 더 자름
    if (fullText.length > MAX_TEXT_LENGTH) {
      const sourceSection = `\n\n[출처]\n${sourceList}`;
      const availableForAnswer = MAX_TEXT_LENGTH - sourceSection.length - 3;
      truncatedAnswer = answer.slice(0, availableForAnswer) + '...';
      return createSimpleTextResponse(truncatedAnswer + sourceSection, {
        quickReplies: options?.quickReplies,
      });
    }

    return createSimpleTextResponse(fullText, {
      quickReplies: options?.quickReplies,
    });
  }

  return createSimpleTextResponse(truncatedAnswer, {
    quickReplies: options?.quickReplies,
  });
}

/**
 * 스트리밍 응답 대기 메시지 생성
 */
export function createStreamingWaitResponse(): KakaoSkillResponse {
  return createSimpleTextResponse(
    '답변을 생성 중입니다. 잠시만 기다려 주세요...',
    {
      quickReplies: [
        {
          label: '다시 물어보기',
          action: 'message',
          messageText: '다시 물어볼게요',
        },
      ],
    }
  );
}
