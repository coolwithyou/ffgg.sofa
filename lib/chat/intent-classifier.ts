/**
 * Intent Classification 모듈
 * 사용자 메시지의 의도를 분류하여 적절한 응답 전략 결정
 */

import { generateText } from 'ai';
import { google } from '@ai-sdk/google';
import { openai } from '@ai-sdk/openai';
import { logger } from '@/lib/logger';
import type { ChatMessage } from './types';

// ============================================================================
// 타입 정의
// ============================================================================

export type IntentType = 'CHITCHAT' | 'DOMAIN_QUERY' | 'OUT_OF_SCOPE';

export interface IntentResult {
  intent: IntentType;
  confidence: number;
  reasoning?: string;
  /** 규칙 기반 분류 여부 (LLM 호출 없이 분류됨) */
  rulesMatch?: boolean;
}

export interface PersonaConfig {
  name: string;
  expertiseArea: string;
  tone: 'professional' | 'friendly' | 'casual';
}

/** 기본 페르소나 설정 (추후 DB로 마이그레이션) */
export const DEFAULT_PERSONA: PersonaConfig = {
  name: 'AI 어시스턴트',
  expertiseArea: '기업 문서 및 FAQ',
  tone: 'friendly',
};

// ============================================================================
// 규칙 기반 패턴 (LLM 호출 없이 빠른 분류)
// ============================================================================

/** CHITCHAT으로 분류되는 패턴 */
const CHITCHAT_PATTERNS: RegExp[] = [
  // 인사
  /^(안녕|하이|헬로|반가워|좋은\s*(아침|저녁|하루)|hi|hello)\s*[~!?.ㅋㅎ]*$/i,
  // 감사/긍정
  /^(감사|고마워|땡큐|thank|넵|네|응|알겠어|오케이|ok|좋아요?|그래)\s*[~!?.ㅋㅎ]*$/i,
  // 이모티콘만
  /^[ㅋㅎㅠㅜ~!?.]+$/,
  // 작별
  /^(안녕히|잘\s*가|바이|bye|수고)\s*[~!?.ㅋㅎ]*$/i,
];

/** OUT_OF_SCOPE로 분류되는 패턴 (일반 상식/기술 질문) */
const OUT_OF_SCOPE_PATTERNS: RegExp[] = [
  // 프로그래밍
  /\b(코딩|프로그래밍|개발|javascript|python|java|react|typescript|html|css|node|api|함수|클래스|변수)\b/i,
  // 금융
  /\b(주식|비트코인|코인|투자|재테크|펀드|etf|금리)\b/i,
  // 일반 상식
  /\b(날씨|오늘\s*날씨|뉴스|영화|드라마|맛집|여행)\b/i,
  // 수학/과학
  /\b(수학|물리|화학|생물|공식|정리|증명)\b/i,
];

/**
 * 규칙 기반 빠른 분류 (LLM 호출 없이)
 * @returns 매칭되면 IntentResult, 아니면 null
 */
function classifyByRules(message: string): IntentResult | null {
  const trimmed = message.trim();

  // CHITCHAT 패턴 체크
  for (const pattern of CHITCHAT_PATTERNS) {
    if (pattern.test(trimmed)) {
      return {
        intent: 'CHITCHAT',
        confidence: 0.95,
        reasoning: `규칙 매칭: ${pattern.source}`,
        rulesMatch: true,
      };
    }
  }

  // OUT_OF_SCOPE 패턴 체크
  for (const pattern of OUT_OF_SCOPE_PATTERNS) {
    if (pattern.test(trimmed)) {
      return {
        intent: 'OUT_OF_SCOPE',
        confidence: 0.85,
        reasoning: `규칙 매칭: ${pattern.source}`,
        rulesMatch: true,
      };
    }
  }

  return null;
}

// ============================================================================
// LLM 기반 분류
// ============================================================================

/**
 * Intent 분류용 시스템 프롬프트
 */
function buildClassificationPrompt(persona: PersonaConfig): string {
  return `당신은 사용자 메시지의 의도를 분류하는 전문가입니다.

## 챗봇 정보
- 이름: ${persona.name}
- 전문 분야: ${persona.expertiseArea}

## 분류 기준

### CHITCHAT (일상 대화)
인사, 안부, 감사, 간단한 일상 대화. 정보 요청이 아닌 경우.
예시: "안녕하세요", "고마워요", "잘 지내세요?", "ㅋㅋㅋ", "네 알겠어요"

### DOMAIN_QUERY (전문 분야 질문)
"${persona.expertiseArea}" 관련 질문. RAG 검색이 필요한 질문.
예시: 문서에 있을 법한 정보 요청, 정책/절차 질문, 제품/서비스 관련 질문

### OUT_OF_SCOPE (범위 외 질문)
전문 분야와 무관한 일반 지식 질문. 프로그래밍, 과학, 금융, 날씨, 뉴스 등.
예시: "JavaScript 함수 만드는 법", "오늘 날씨 어때?", "비트코인 전망은?"

## 규칙
1. 복합 의도 (예: "안녕, 반품 정책 알려줘")는 실질적 의도(DOMAIN_QUERY)로 분류
2. 불확실하면 DOMAIN_QUERY로 분류 (RAG 검색 후 판단 가능)
3. 이전 대화 맥락을 고려하여 분류

## 응답 형식 (JSON만 출력)
{"intent": "CHITCHAT|DOMAIN_QUERY|OUT_OF_SCOPE", "confidence": 0.0-1.0, "reasoning": "분류 이유"}`;
}

/**
 * 대화 히스토리를 프롬프트용 문자열로 변환
 */
function formatHistory(messages: ChatMessage[], limit: number = 4): string {
  if (messages.length === 0) return '(첫 대화)';

  const recent = messages.slice(-limit);
  return recent.map((m) => `${m.role === 'user' ? '사용자' : '어시스턴트'}: ${m.content}`).join('\n');
}

/**
 * LLM을 사용한 Intent 분류
 */
async function classifyWithLLM(
  message: string,
  conversationHistory: ChatMessage[],
  persona: PersonaConfig
): Promise<IntentResult> {
  const systemPrompt = buildClassificationPrompt(persona);
  const historyContext = formatHistory(conversationHistory);

  const userPrompt = `## 이전 대화
${historyContext}

## 현재 메시지
${message}

## 분류 결과 (JSON):`;

  try {
    // Gemini Flash-Lite 우선 (빠르고 저렴)
    if (process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
      const result = await generateText({
        model: google('gemini-2.5-flash-lite'),
        system: systemPrompt,
        prompt: userPrompt,
        maxOutputTokens: 150,
        temperature: 0, // 결정론적 출력
      });

      return parseIntentResult(result.text);
    }

    // OpenAI 폴백
    if (process.env.OPENAI_API_KEY) {
      const result = await generateText({
        model: openai('gpt-4o-mini'),
        system: systemPrompt,
        prompt: userPrompt,
        maxOutputTokens: 150,
        temperature: 0,
      });

      return parseIntentResult(result.text);
    }

    // LLM 없으면 기본값
    logger.warn('No LLM provider available for intent classification');
    return {
      intent: 'DOMAIN_QUERY',
      confidence: 0.5,
      reasoning: 'LLM 미사용 - 기본값',
    };
  } catch (error) {
    logger.error('Intent classification failed', error as Error, { message });
    // 실패 시 DOMAIN_QUERY로 폴백 (RAG 실행)
    return {
      intent: 'DOMAIN_QUERY',
      confidence: 0.5,
      reasoning: `분류 실패: ${error instanceof Error ? error.message : 'Unknown'}`,
    };
  }
}

/**
 * LLM 응답을 IntentResult로 파싱
 */
function parseIntentResult(text: string): IntentResult {
  try {
    // JSON 부분 추출 (앞뒤 텍스트 무시)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('JSON not found in response');
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // 유효성 검사
    const validIntents: IntentType[] = ['CHITCHAT', 'DOMAIN_QUERY', 'OUT_OF_SCOPE'];
    const intent = validIntents.includes(parsed.intent) ? parsed.intent : 'DOMAIN_QUERY';
    const confidence = typeof parsed.confidence === 'number' ? Math.min(1, Math.max(0, parsed.confidence)) : 0.7;

    return {
      intent,
      confidence,
      reasoning: parsed.reasoning || undefined,
      rulesMatch: false,
    };
  } catch (error) {
    logger.warn('Failed to parse intent result', { text, error });
    return {
      intent: 'DOMAIN_QUERY',
      confidence: 0.6,
      reasoning: `파싱 실패: ${text.slice(0, 100)}`,
      rulesMatch: false,
    };
  }
}

// ============================================================================
// 메인 함수
// ============================================================================

/**
 * 사용자 메시지의 Intent를 분류합니다.
 *
 * @param message - 사용자 메시지
 * @param conversationHistory - 이전 대화 히스토리 (맥락 파악용)
 * @param persona - 챗봇 페르소나 설정
 * @returns Intent 분류 결과
 *
 * @example
 * ```typescript
 * const result = await classifyIntent("안녕하세요", [], DEFAULT_PERSONA);
 * // { intent: 'CHITCHAT', confidence: 0.95, rulesMatch: true }
 *
 * const result = await classifyIntent("반품 정책 알려주세요", history, persona);
 * // { intent: 'DOMAIN_QUERY', confidence: 0.9 }
 * ```
 */
export async function classifyIntent(
  message: string,
  conversationHistory: ChatMessage[] = [],
  persona: PersonaConfig = DEFAULT_PERSONA
): Promise<IntentResult> {
  const startTime = Date.now();

  // 1. 규칙 기반 빠른 분류 시도
  const rulesResult = classifyByRules(message);
  if (rulesResult) {
    logger.debug('Intent classified by rules', {
      message: message.slice(0, 50),
      intent: rulesResult.intent,
      duration: Date.now() - startTime,
    });
    return rulesResult;
  }

  // 2. LLM 기반 분류
  const llmResult = await classifyWithLLM(message, conversationHistory, persona);

  logger.debug('Intent classified by LLM', {
    message: message.slice(0, 50),
    intent: llmResult.intent,
    confidence: llmResult.confidence,
    duration: Date.now() - startTime,
  });

  return llmResult;
}
