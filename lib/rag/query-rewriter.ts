/**
 * Query Rewriting 모듈
 *
 * 대화 맥락을 고려하여 후속 질문을 독립적인 완전한 질문으로 재작성합니다.
 * 이를 통해 RAG 검색 품질을 향상시킵니다.
 */

import { ChatMessage } from '@/lib/chat/types';
import { generateWithFallback } from './generator';
import { logger } from '@/lib/logger';

export interface QueryRewriteOptions {
  /** 사용할 최대 히스토리 메시지 수 (기본: 4) */
  maxHistoryMessages?: number;
  /** LLM temperature (기본: 0.3, 일관성 우선) */
  temperature?: number;
  /** 최대 출력 토큰 수 (기본: 150) */
  maxTokens?: number;
}

const REWRITE_SYSTEM_PROMPT = `당신은 대화 맥락을 고려하여 후속 질문을 재작성하는 전문가입니다.

## 작업
사용자의 현재 질문을 이전 대화 맥락을 반영한 독립적인 질문으로 재작성하세요.

## 규칙
1. 대명사(그, 그녀, 그것, 이것, 거기 등)를 구체적 명사로 교체
2. 생략된 주어, 목적어, 맥락 정보를 명시적으로 포함
3. 질문의 원래 의도를 정확히 유지
4. 재작성된 질문만 출력 (설명, 인용부호, 추가 텍스트 없이)

## 예시
[이전 대화]
사용자: 홍길동이 누구야?
어시스턴트: 홍길동은 조선시대 의적으로 알려진 인물입니다.

[현재 질문]
아들 이름은?

[재작성된 질문]
홍길동의 아들 이름은 무엇인가요?`;

/**
 * 대화 맥락을 고려하여 쿼리를 재작성합니다.
 *
 * @param currentQuery - 현재 사용자 질문
 * @param conversationHistory - 이전 대화 히스토리
 * @param options - 재작성 옵션
 * @returns 재작성된 쿼리 (실패 시 원본 반환)
 */
export async function rewriteQuery(
  currentQuery: string,
  conversationHistory: ChatMessage[],
  options: QueryRewriteOptions = {}
): Promise<string> {
  // 히스토리가 없으면 원본 반환 (첫 질문)
  if (conversationHistory.length === 0) {
    return currentQuery;
  }

  const { maxHistoryMessages = 4, temperature = 0.3, maxTokens = 150 } = options;

  try {
    // 최근 N개 메시지만 사용
    const recentHistory = conversationHistory
      .slice(-maxHistoryMessages)
      .map((m) => `${m.role === 'user' ? '사용자' : '어시스턴트'}: ${m.content}`)
      .join('\n');

    const userPrompt = `[이전 대화]
${recentHistory}

[현재 질문]
${currentQuery}

[재작성된 질문]`;

    const rewritten = await generateWithFallback(REWRITE_SYSTEM_PROMPT, userPrompt, {
      temperature,
      maxTokens,
    });

    const result = rewritten.trim();

    // 빈 결과 또는 너무 긴 결과는 원본 반환
    if (!result || result.length > currentQuery.length * 5) {
      logger.warn('Query rewriting returned invalid result, using original', {
        originalLength: currentQuery.length,
        rewrittenLength: result?.length ?? 0,
      });
      return currentQuery;
    }

    logger.debug('Query rewritten successfully', {
      original: currentQuery,
      rewritten: result,
      historyLength: conversationHistory.length,
    });

    return result;
  } catch (error) {
    logger.error('Query rewriting failed', error as Error, {
      originalQuery: currentQuery,
      historyLength: conversationHistory.length,
    });
    // 실패 시 원본 반환 (Graceful degradation)
    return currentQuery;
  }
}
