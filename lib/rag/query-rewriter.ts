/**
 * Query Rewriting 모듈
 *
 * 대화 맥락을 고려하여 후속 질문을 독립적인 완전한 질문으로 재작성합니다.
 * 이를 통해 RAG 검색 품질을 향상시킵니다.
 */

import { ChatMessage } from '@/lib/chat/types';
import { generateWithFallback, type TrackingContext } from './generator';
import { logger } from '@/lib/logger';

export interface QueryRewriteOptions {
  /** 사용할 최대 히스토리 메시지 수 (기본: 4) */
  maxHistoryMessages?: number;
  /** LLM temperature (기본: 0.3, 일관성 우선) */
  temperature?: number;
  /** 최대 출력 토큰 수 (기본: 150) */
  maxTokens?: number;
  /** 토큰 사용량 추적을 위한 컨텍스트 */
  trackingContext?: TrackingContext;
  /** 페르소나의 포함 주제 (키워드 확장에 사용) */
  includedTopics?: string[];
  /** 전문 분야 (도메인 맥락용) */
  expertiseArea?: string;
  /** 도메인 용어 사전 (동음이의어 해소용) */
  domainGlossary?: Record<string, string>;
}

/**
 * 쿼리에서 포함 주제와 관련된 키워드를 찾아 확장합니다.
 * 예: "문희가 다니는 회사" + includedTopics["성문희"] → "문희 성문희가 다니는 회사"
 *
 * @param query - 원본 쿼리
 * @param includedTopics - 페르소나의 포함 주제 목록
 * @returns 키워드가 확장된 쿼리
 */
function expandQueryWithKeywords(query: string, includedTopics: string[]): string {
  // INFO 레벨로 항상 로깅하여 프로덕션에서 확인 가능
  logger.info('[KeywordExpansion] Starting', {
    query,
    queryLength: query.length,
    includedTopicsCount: includedTopics?.length ?? 0,
    includedTopics: includedTopics?.slice(0, 10), // 처음 10개 로깅
  });

  if (!includedTopics || includedTopics.length === 0) {
    logger.info('[KeywordExpansion] No includedTopics, returning original query');
    return query;
  }

  const expansions: string[] = [];
  const queryLower = query.toLowerCase();

  for (const topic of includedTopics) {
    const topicLower = topic.toLowerCase();

    // 쿼리에 이미 전체 키워드가 포함되어 있으면 스킵
    if (queryLower.includes(topicLower)) {
      logger.debug(`[KeywordExpansion] Topic "${topic}" already in query, skipping`);
      continue;
    }

    // 키워드의 일부가 쿼리에 포함되어 있는지 확인 (2글자 이상)
    // 예: "문희" in "성문희", "대한항공" in "대한항공"
    let matched = false;
    for (let len = Math.min(topic.length - 1, query.length); len >= 2; len--) {
      // 키워드의 뒷부분이 쿼리에 있는지 (예: "문희" in "성문희")
      const suffix = topic.slice(-len);
      if (queryLower.includes(suffix.toLowerCase())) {
        logger.info(`[KeywordExpansion] Match found: suffix "${suffix}" of "${topic}" in query`);
        expansions.push(topic);
        matched = true;
        break;
      }
      // 키워드의 앞부분이 쿼리에 있는지 (예: "성문" in "성문희")
      const prefix = topic.slice(0, len);
      if (queryLower.includes(prefix.toLowerCase())) {
        logger.info(`[KeywordExpansion] Match found: prefix "${prefix}" of "${topic}" in query`);
        expansions.push(topic);
        matched = true;
        break;
      }
    }

    if (!matched && topic.length <= 3) {
      // 짧은 키워드(3글자 이하)는 별도 체크: 쿼리에 포함되어 있는지
      if (queryLower.includes(topicLower)) {
        logger.info(`[KeywordExpansion] Short topic "${topic}" found in query`);
        expansions.push(topic);
      }
    }
  }

  if (expansions.length === 0) {
    logger.info('[KeywordExpansion] No matches found, returning original query', {
      query,
      topicsChecked: includedTopics.length,
    });
    return query;
  }

  // 중복 제거 후 쿼리 앞에 키워드 추가
  const uniqueExpansions = [...new Set(expansions)];
  const expandedQuery = `${uniqueExpansions.join(' ')} ${query}`;

  logger.info('[KeywordExpansion] Query expanded', {
    original: query,
    expanded: expandedQuery,
    addedKeywords: uniqueExpansions,
    expansionCount: uniqueExpansions.length,
  });

  return expandedQuery;
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
 * 도메인 컨텍스트를 반영한 시스템 프롬프트 생성
 * 도메인 정보가 없으면 기존 프롬프트 반환
 */
function buildDomainAwarePrompt(options: QueryRewriteOptions): string {
  const { expertiseArea, includedTopics, domainGlossary } = options;

  // 도메인 정보가 없으면 기존 프롬프트 사용
  if (!expertiseArea && !includedTopics?.length && !domainGlossary) {
    return REWRITE_SYSTEM_PROMPT;
  }

  const glossarySection =
    domainGlossary && Object.keys(domainGlossary).length > 0
      ? `\n## 도메인 용어 사전\n${Object.entries(domainGlossary)
          .map(([term, def]) => `- ${term}: ${def}`)
          .join('\n')}`
      : '';

  return `당신은 대화 맥락을 고려하여 질문을 재작성하는 전문가입니다.

## 도메인 정보
- 전문 분야: ${expertiseArea || '일반'}
- 관련 주제: ${includedTopics?.join(', ') || '없음'}${glossarySection}

## 동음이의어 처리 규칙
- 질문에 도메인 주제와 관련된 단어가 있다면, 반드시 도메인 맥락에서 해석하세요.
- 도메인 용어 사전에 있는 용어는 해당 정의에 따라 재작성하세요.
- 예시: "포수"가 옻칠 관련 챗봇이면 "옻칠 포수(布水) 기법"으로 재작성

## 규칙
1. 대명사를 구체적 명사로 교체
2. 생략된 맥락 정보를 명시적으로 포함
3. 도메인 컨텍스트를 반영하여 재작성
4. 재작성된 질문만 출력 (설명, 인용부호 없이)`;
}

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
  const {
    maxHistoryMessages = 4,
    temperature = 0.3,
    maxTokens = 150,
    trackingContext,
    includedTopics,
    expertiseArea,
    domainGlossary,
  } = options;

  // 도메인 컨텍스트 존재 여부 확인
  const hasDomainContext = !!(
    expertiseArea ||
    (domainGlossary && Object.keys(domainGlossary).length > 0)
  );

  // 로깅: includedTopics 및 도메인 컨텍스트 확인
  logger.debug('Query rewrite started', {
    query: currentQuery,
    includedTopicsCount: includedTopics?.length ?? 0,
    includedTopics: includedTopics?.slice(0, 5), // 처음 5개만 로깅
    hasHistory: conversationHistory.length > 0,
    hasDomainContext,
    expertiseArea,
  });

  // 1. 키워드 확장 (히스토리와 무관하게 항상 적용)
  const expandedQuery = expandQueryWithKeywords(currentQuery, includedTopics || []);

  // 2. 히스토리가 없고 도메인 컨텍스트도 없으면 확장된 쿼리 반환
  if (conversationHistory.length === 0 && !hasDomainContext) {
    return expandedQuery;
  }

  try {
    // 도메인 인지 프롬프트 생성
    const systemPrompt = buildDomainAwarePrompt(options);

    // 히스토리가 없는 경우 (도메인 컨텍스트만 있는 경우)
    let userPrompt: string;
    if (conversationHistory.length === 0) {
      userPrompt = `다음 질문을 도메인 맥락에 맞게 재작성하세요:

[질문]
${expandedQuery}

[재작성된 질문]`;
    } else {
      // 최근 N개 메시지만 사용
      const recentHistory = conversationHistory
        .slice(-maxHistoryMessages)
        .map((m) => `${m.role === 'user' ? '사용자' : '어시스턴트'}: ${m.content}`)
        .join('\n');

      userPrompt = `[이전 대화]
${recentHistory}

[현재 질문]
${expandedQuery}

[재작성된 질문]`;
    }

    const rewritten = await generateWithFallback(systemPrompt, userPrompt, {
      temperature,
      maxTokens,
      trackingContext: trackingContext
        ? { ...trackingContext, featureType: 'rewrite' }
        : undefined,
    });

    const result = rewritten.trim();

    // 빈 결과 또는 너무 긴 결과는 확장된 쿼리 반환
    if (!result || result.length > expandedQuery.length * 5) {
      logger.warn('Query rewriting returned invalid result, using expanded query', {
        originalLength: currentQuery.length,
        expandedLength: expandedQuery.length,
        rewrittenLength: result?.length ?? 0,
      });
      return expandedQuery;
    }

    logger.debug('Query rewritten successfully', {
      original: currentQuery,
      rewritten: result,
      historyLength: conversationHistory.length,
      hasDomainContext,
    });

    return result;
  } catch (error) {
    logger.error('Query rewriting failed', error as Error, {
      originalQuery: currentQuery,
      expandedQuery,
      historyLength: conversationHistory.length,
      hasDomainContext,
    });
    // 실패 시 확장된 쿼리 반환 (Graceful degradation)
    return expandedQuery;
  }
}
