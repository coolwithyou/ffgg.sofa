/**
 * Query Router 모듈
 * Intent 분류 결과에 따라 적절한 응답 전략을 결정
 */

import { generateText } from 'ai';
import { google } from '@ai-sdk/google';
import { openai } from '@ai-sdk/openai';
import { logger } from '@/lib/logger';
import type { IntentResult, IntentType, PersonaConfig } from './intent-classifier';
import type { SearchResult } from '@/lib/rag/retrieval';

// ============================================================================
// 타입 정의
// ============================================================================

export interface RouterResult {
  /** RAG 결과를 사용해야 하는지 */
  shouldUseRAG: boolean;
  /** RAG 불필요 시 직접 응답 */
  response?: string;
  /** 최종 결정된 Intent */
  intent: IntentType;
  /** Intent 신뢰도 */
  confidence: number;
  /** 라우팅 결정 이유 */
  reasoning?: string;
}

export interface RouterConfig {
  /** CHITCHAT으로 처리할 최소 confidence (기본: 0.85) */
  chitchatThreshold: number;
  /** OUT_OF_SCOPE로 처리할 최소 confidence (기본: 0.85) */
  outOfScopeThreshold: number;
  /** RAG 결과로 재검증할 최소 Dense score (기본: 0.5) */
  ragReverifyThreshold: number;
  /** RAG 결과가 낮으면 거절할 Dense score 기준 (기본: 0.3) */
  ragDeclineThreshold: number;
}

const DEFAULT_ROUTER_CONFIG: RouterConfig = {
  chitchatThreshold: 0.85,
  outOfScopeThreshold: 0.85,
  ragReverifyThreshold: 0.5,  // Dense 점수 0.5 이상이면 OUT_OF_SCOPE → DOMAIN_QUERY로 재분류
  ragDeclineThreshold: 0.3,   // Dense 점수 0.3 미만이면 "정보 없음" 응답
};

// ============================================================================
// 응답 생성 함수
// ============================================================================

/**
 * CHITCHAT 응답 생성용 템플릿
 */
const CHITCHAT_TEMPLATES: Record<string, string[]> = {
  greeting: [
    '안녕하세요! 무엇이 궁금하신가요?',
    '반가워요! 도움이 필요하시면 말씀해주세요.',
    '안녕하세요! 어떻게 도와드릴까요?',
  ],
  thanks: ['천만에요! 더 궁금한 게 있으시면 말씀해주세요.', '도움이 되었다니 기뻐요!', '네, 필요하시면 언제든 물어봐주세요!'],
  acknowledgment: ['네, 알겠습니다!', '좋아요!', '네!'],
  farewell: ['안녕히 가세요! 좋은 하루 되세요.', '다음에 또 찾아주세요!', '감사합니다, 좋은 하루 보내세요!'],
};

/**
 * 메시지 패턴에 따라 적절한 템플릿 카테고리 선택
 */
function selectTemplateCategory(message: string): keyof typeof CHITCHAT_TEMPLATES {
  const lower = message.toLowerCase();

  if (/안녕|하이|헬로|반가워|hi|hello/.test(lower)) return 'greeting';
  if (/감사|고마워|땡큐|thank/.test(lower)) return 'thanks';
  if (/네|응|알겠|오케이|ok|좋아/.test(lower)) return 'acknowledgment';
  if (/안녕히|잘\s*가|바이|bye|수고/.test(lower)) return 'farewell';

  return 'greeting'; // 기본값
}

/**
 * 간단한 CHITCHAT은 템플릿으로 응답 (LLM 호출 없이)
 */
function generateTemplateResponse(message: string): string {
  const category = selectTemplateCategory(message);
  const templates = CHITCHAT_TEMPLATES[category];
  const randomIndex = Math.floor(Math.random() * templates.length);
  return templates[randomIndex];
}

/**
 * CHITCHAT 응답 생성 (LLM 사용)
 */
async function generateChitchatResponse(message: string, persona: PersonaConfig): Promise<string> {
  const toneMap = {
    professional: '전문적이고 정중한',
    friendly: '친근하고 따뜻한',
    casual: '편안하고 캐주얼한',
  };

  const systemPrompt = `당신은 ${persona.name}입니다. ${toneMap[persona.tone]} 어조로 대화합니다.

사용자와 자연스럽게 대화하세요:
- 친근하고 간결하게 응답 (1-2문장)
- 전문 지식 질문으로 유도할 필요 없음
- 자연스러운 대화체 사용`;

  try {
    const model = process.env.GOOGLE_GENERATIVE_AI_API_KEY
      ? google('gemini-2.5-flash-lite')
      : openai('gpt-4o-mini');

    const result = await generateText({
      model,
      system: systemPrompt,
      prompt: message,
      maxOutputTokens: 100,
      temperature: 0.7,
    });

    return result.text.trim();
  } catch (error) {
    logger.warn('CHITCHAT LLM generation failed, using template', { error });
    return generateTemplateResponse(message);
  }
}

/**
 * OUT_OF_SCOPE 거절 응답 생성
 */
async function generateOutOfScopeResponse(message: string, persona: PersonaConfig): Promise<string> {
  const systemPrompt = `당신은 ${persona.name}입니다.
전문 분야: ${persona.expertiseArea}

사용자의 질문이 전문 분야 외입니다. 정중하게 거절하세요:
- "그 부분은 제 전문 분야가 아니에요." 식으로 부드럽게
- 전문 분야 관련 질문 예시 1개 제안
- 친근하지만 명확한 어조
- 2-3문장 이내로 간결하게`;

  try {
    const model = process.env.GOOGLE_GENERATIVE_AI_API_KEY
      ? google('gemini-2.5-flash-lite')
      : openai('gpt-4o-mini');

    const result = await generateText({
      model,
      system: systemPrompt,
      prompt: `사용자 질문: ${message}\n\n거절 응답:`,
      maxOutputTokens: 150,
      temperature: 0.5,
    });

    return result.text.trim();
  } catch (error) {
    logger.warn('OUT_OF_SCOPE LLM generation failed, using default', { error });
    return `그 부분은 제 전문 분야가 아니에요. ${persona.expertiseArea}에 대해 궁금하신 게 있으시면 물어봐주세요!`;
  }
}

/**
 * RAG 결과가 없거나 낮을 때 응답
 */
function generateNoResultResponse(persona: PersonaConfig): string {
  return `죄송해요, 관련 정보를 찾지 못했어요. ${persona.expertiseArea}에 대한 다른 질문이 있으시면 말씀해주세요!`;
}

// ============================================================================
// 메인 라우팅 함수
// ============================================================================

/**
 * Intent 분류 결과와 RAG 검색 결과를 바탕으로 응답 전략을 결정합니다.
 *
 * @param message - 사용자 메시지
 * @param intentResult - Intent 분류 결과
 * @param ragResults - RAG 검색 결과 (병렬 실행됨)
 * @param persona - 챗봇 페르소나
 * @param config - 라우터 설정
 * @returns 라우팅 결과 (shouldUseRAG=false면 response 포함)
 *
 * @example
 * ```typescript
 * // CHITCHAT 케이스
 * const result = await routeQuery("안녕", chitchatIntent, [], persona);
 * // { shouldUseRAG: false, response: "안녕하세요! 무엇이 궁금하신가요?", intent: 'CHITCHAT' }
 *
 * // DOMAIN_QUERY 케이스
 * const result = await routeQuery("반품 정책", domainIntent, ragResults, persona);
 * // { shouldUseRAG: true, intent: 'DOMAIN_QUERY' }
 * ```
 */
export async function routeQuery(
  message: string,
  intentResult: IntentResult,
  ragResults: SearchResult[],
  persona: PersonaConfig,
  config: RouterConfig = DEFAULT_ROUTER_CONFIG
): Promise<RouterResult> {
  const startTime = Date.now();
  const topRrfScore = ragResults[0]?.score ?? 0;
  // 임계값 비교는 Dense 원본 점수 사용 (RRF 점수는 0.01~0.03 범위라 임계값 비교에 부적합)
  const topDenseScore = ragResults[0]?.denseScore ?? topRrfScore;

  // -------------------------------------------------------------------------
  // Case 1: CHITCHAT (높은 신뢰도)
  // -------------------------------------------------------------------------
  if (intentResult.intent === 'CHITCHAT' && intentResult.confidence >= config.chitchatThreshold) {
    // 규칙 매칭이면 템플릿, 아니면 LLM
    const response = intentResult.rulesMatch
      ? generateTemplateResponse(message)
      : await generateChitchatResponse(message, persona);

    logger.info('Query routed to CHITCHAT', {
      message: message.slice(0, 50),
      confidence: intentResult.confidence,
      duration: Date.now() - startTime,
    });

    return {
      shouldUseRAG: false,
      response,
      intent: 'CHITCHAT',
      confidence: intentResult.confidence,
      reasoning: 'CHITCHAT with high confidence',
    };
  }

  // -------------------------------------------------------------------------
  // Case 2: OUT_OF_SCOPE (높은 신뢰도)
  // -------------------------------------------------------------------------
  if (intentResult.intent === 'OUT_OF_SCOPE' && intentResult.confidence >= config.outOfScopeThreshold) {
    // RAG 결과로 재검증 - 혹시 관련 문서가 있는지 확인 (Dense 점수 기준)
    if (topDenseScore >= config.ragReverifyThreshold) {
      // RAG에서 좋은 결과 발견 → DOMAIN_QUERY로 재분류
      logger.info('OUT_OF_SCOPE reclassified to DOMAIN_QUERY by RAG', {
        message: message.slice(0, 50),
        denseScore: topDenseScore,
        rrfScore: topRrfScore,
        duration: Date.now() - startTime,
      });

      return {
        shouldUseRAG: true,
        intent: 'DOMAIN_QUERY',
        confidence: topDenseScore,
        reasoning: `OUT_OF_SCOPE but RAG found relevant content (denseScore: ${topDenseScore.toFixed(2)})`,
      };
    }

    // RAG 결과도 낮음 → 정중한 거절
    const response = await generateOutOfScopeResponse(message, persona);

    logger.info('Query routed to OUT_OF_SCOPE decline', {
      message: message.slice(0, 50),
      confidence: intentResult.confidence,
      denseScore: topDenseScore,
      rrfScore: topRrfScore,
      duration: Date.now() - startTime,
    });

    return {
      shouldUseRAG: false,
      response,
      intent: 'OUT_OF_SCOPE',
      confidence: intentResult.confidence,
      reasoning: `OUT_OF_SCOPE confirmed by low RAG score (denseScore: ${topDenseScore.toFixed(2)})`,
    };
  }

  // -------------------------------------------------------------------------
  // Case 3: DOMAIN_QUERY 또는 낮은 신뢰도
  // -------------------------------------------------------------------------

  // RAG 결과가 너무 낮으면 "정보 없음" 응답 (Dense 점수 기준)
  if (ragResults.length === 0 || topDenseScore < config.ragDeclineThreshold) {
    const response = generateNoResultResponse(persona);

    logger.info('Query routed to no-result response', {
      message: message.slice(0, 50),
      intent: intentResult.intent,
      denseScore: topDenseScore,
      rrfScore: topRrfScore,
      threshold: config.ragDeclineThreshold,
      duration: Date.now() - startTime,
    });

    return {
      shouldUseRAG: false,
      response,
      intent: intentResult.intent,
      confidence: intentResult.confidence,
      reasoning: `No relevant RAG results (denseScore: ${topDenseScore.toFixed(2)} < ${config.ragDeclineThreshold})`,
    };
  }

  // RAG 결과 사용
  logger.info('Query routed to RAG pipeline', {
    message: message.slice(0, 50),
    intent: intentResult.intent,
    denseScore: topDenseScore,
    rrfScore: topRrfScore,
    duration: Date.now() - startTime,
  });

  return {
    shouldUseRAG: true,
    intent: intentResult.intent,
    confidence: intentResult.confidence,
    reasoning: `DOMAIN_QUERY with RAG results (denseScore: ${topDenseScore.toFixed(2)})`,
  };
}

// ============================================================================
// 유틸리티 함수
// ============================================================================

/**
 * RAG 결과의 품질을 평가합니다.
 * Dense 점수 기준으로 평가 (RRF 점수가 아닌 코사인 유사도 기준)
 */
export function evaluateRagQuality(ragResults: SearchResult[]): {
  hasResults: boolean;
  topScore: number;
  topDenseScore: number;
  avgScore: number;
  quality: 'high' | 'medium' | 'low' | 'none';
} {
  if (ragResults.length === 0) {
    return { hasResults: false, topScore: 0, topDenseScore: 0, avgScore: 0, quality: 'none' };
  }

  const topScore = ragResults[0].score; // RRF 점수
  const topDenseScore = ragResults[0].denseScore ?? topScore; // Dense 원본 점수
  const avgScore = ragResults.reduce((sum, r) => sum + r.score, 0) / ragResults.length;

  // 품질 평가는 Dense 점수 기준
  let quality: 'high' | 'medium' | 'low' | 'none';
  if (topDenseScore >= 0.8) quality = 'high';
  else if (topDenseScore >= 0.6) quality = 'medium';
  else quality = 'low';

  return { hasResults: true, topScore, topDenseScore, avgScore, quality };
}
