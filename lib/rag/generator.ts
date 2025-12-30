/**
 * LLM 응답 생성 모듈
 * Gemini 2.5 Flash-Lite (메인) + GPT-4o-mini (폴백)
 */

import { generateText } from 'ai';
import { google } from '@ai-sdk/google';
import { openai } from '@ai-sdk/openai';
import { logger } from '@/lib/logger';
import { trackTokenUsage } from '@/lib/usage/token-tracker';
import { SearchResult } from './retrieval';
import type { ModelProvider, ModelId, FeatureType } from '@/lib/usage/types';

export interface GenerateOptions {
  maxTokens?: number;
  temperature?: number;
  channel?: 'web' | 'kakao';
  /** 첫 번째 턴 여부 (기본: true). false면 간결한 응답 생성 */
  isFirstTurn?: boolean;
  /** 토큰 추적용 컨텍스트 */
  trackingContext?: {
    tenantId: string;
    chatbotId?: string;
    conversationId?: string;
    featureType?: FeatureType;
  };
}

interface LLMProviderResult {
  text: string;
  inputTokens: number;
  outputTokens: number;
}

interface LLMProvider {
  name: ModelProvider;
  model: ModelId;
  priority: number;
  isAvailable: () => Promise<boolean>;
  generate: (
    systemPrompt: string,
    userPrompt: string,
    options: GenerateOptions
  ) => Promise<LLMProviderResult>;
}

// LLM 프로바이더 설정
const LLM_PROVIDERS: LLMProvider[] = [
  {
    name: 'google',
    model: 'gemini-2.5-flash-lite',
    priority: 1,
    isAvailable: async () => !!process.env.GOOGLE_GENERATIVE_AI_API_KEY,
    generate: async (systemPrompt, userPrompt, options) => {
      const result = await generateText({
        model: google('gemini-2.5-flash-lite'),
        system: systemPrompt,
        prompt: userPrompt,
        maxOutputTokens: options.maxTokens || 1024,
        temperature: options.temperature || 0.7,
      });
      return {
        text: result.text,
        inputTokens: result.usage?.inputTokens ?? 0,
        outputTokens: result.usage?.outputTokens ?? 0,
      };
    },
  },
  {
    name: 'openai',
    model: 'gpt-4o-mini',
    priority: 2,
    isAvailable: async () => !!process.env.OPENAI_API_KEY,
    generate: async (systemPrompt, userPrompt, options) => {
      const result = await generateText({
        model: openai('gpt-4o-mini'),
        system: systemPrompt,
        prompt: userPrompt,
        maxOutputTokens: options.maxTokens || 1024,
        temperature: options.temperature || 0.7,
      });
      return {
        text: result.text,
        inputTokens: result.usage?.inputTokens ?? 0,
        outputTokens: result.usage?.outputTokens ?? 0,
      };
    },
  },
];

// 시스템 프롬프트 - 대화형 스타일로 개선
const WEB_SYSTEM_PROMPT_BASE = `당신은 기업 문서 기반 AI 어시스턴트입니다.

## 답변 원칙
1. 제공된 컨텍스트에 있는 정보만으로 정확하게 답변
2. 컨텍스트에 정보가 없으면: "제공된 문서에서 관련 정보를 찾을 수 없습니다"
3. 자연스럽고 간결한 대화체 사용
4. 핵심을 먼저 전달하고 필요시 부연 설명

## 금지 표현 (절대 사용하지 마세요)
- 형식적 인사: "안녕하세요!", "안녕하세요~"
- 불필요한 서론: "문서에 따르면", "제공된 정보를 바탕으로", "문서 [1]에 의하면"
- 과도한 공손함: "도움이 되었으면 합니다", "더 궁금하신 점이 있으시면"
- 반복 설명: 이미 언급한 내용을 다시 설명`;

const WEB_FIRST_TURN_SUFFIX = `

## 첫 질문 응답 가이드
- 충분히 상세하게 답변
- 필요시 불렛 포인트나 번호 목록 사용
- 관련 맥락 정보 함께 제공`;

const WEB_FOLLOWUP_TURN_SUFFIX = `

## 후속 질문 응답 가이드
- 핵심만 2-3문장 이내로 간결하게
- 이미 설명한 내용은 반복하지 않음
- 직접적으로 답변 시작 (서론 없이)`;

const KAKAO_SYSTEM_PROMPT = `당신은 카카오톡에서 고객 질문에 답변하는 AI 어시스턴트입니다.

규칙:
1. 제공된 컨텍스트에 기반하여 정확하게 답변하세요.
2. 답변은 짧고 간결하게 (최대 300자) 작성하세요.
3. 친근하면서도 전문적인 어조를 유지하세요.
4. 컨텍스트에 없는 정보는 "관련 정보를 찾지 못했어요. 다른 질문이 있으신가요?"라고 답변하세요.
5. "안녕하세요"로 시작하지 마세요. 바로 답변하세요.`;

/**
 * 채널과 턴 정보에 따라 적절한 시스템 프롬프트를 생성합니다.
 */
function buildSystemPrompt(channel: 'web' | 'kakao', isFirstTurn: boolean): string {
  if (channel === 'kakao') {
    return KAKAO_SYSTEM_PROMPT;
  }

  return WEB_SYSTEM_PROMPT_BASE + (isFirstTurn ? WEB_FIRST_TURN_SUFFIX : WEB_FOLLOWUP_TURN_SUFFIX);
}

/**
 * RAG 기반 응답 생성
 */
export async function generateResponse(
  query: string,
  chunks: SearchResult[],
  options: GenerateOptions = {}
): Promise<string> {
  const { channel = 'web', isFirstTurn = true } = options;

  // 컨텍스트 구성
  const context = chunks
    .map((chunk, index) => `[${index + 1}] ${chunk.content}`)
    .join('\n\n---\n\n');

  // 동적 시스템 프롬프트 생성
  const systemPrompt = buildSystemPrompt(channel, isFirstTurn);

  // 사용자 프롬프트 구성
  const userPrompt = `## 관련 문서 내용:
${context}

## 질문:
${query}

## 답변:`;

  // 응답 생성
  return generateWithFallback(systemPrompt, userPrompt, options);
}

/**
 * 폴백 전략을 적용한 LLM 응답 생성
 */
export async function generateWithFallback(
  systemPrompt: string,
  userPrompt: string,
  options: GenerateOptions = {}
): Promise<string> {
  const startTime = Date.now();
  const errors: Array<{ provider: string; error: string }> = [];
  const { trackingContext } = options;

  // 우선순위 순으로 프로바이더 시도
  for (const provider of LLM_PROVIDERS) {
    try {
      const isAvailable = await provider.isAvailable();
      if (!isAvailable) {
        logger.debug(`Provider ${provider.name} is not available`);
        continue;
      }

      const result = await provider.generate(systemPrompt, userPrompt, options);

      const duration = Date.now() - startTime;
      logger.info('LLM response generated', {
        provider: provider.name,
        model: provider.model,
        duration,
        responseLength: result.text.length,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
      });

      // 토큰 사용량 추적 (비동기, 실패해도 응답 반환)
      if (trackingContext?.tenantId) {
        trackTokenUsage({
          tenantId: trackingContext.tenantId,
          chatbotId: trackingContext.chatbotId,
          conversationId: trackingContext.conversationId,
          modelProvider: provider.name,
          modelId: provider.model,
          featureType: trackingContext.featureType ?? 'chat',
          inputTokens: result.inputTokens,
          outputTokens: result.outputTokens,
        }).catch((err) => {
          logger.warn('Failed to track token usage', { error: err });
        });
      }

      return result.text;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      errors.push({ provider: provider.name, error: errorMessage });

      logger.warn(`Provider ${provider.name} failed, trying next...`, {
        error: errorMessage,
      });
    }
  }

  // 모든 프로바이더 실패
  logger.error('All LLM providers failed', undefined, { errors });
  throw new Error('모든 LLM 서비스가 응답하지 않습니다. 잠시 후 다시 시도해 주세요.');
}

/**
 * 스트리밍 응답 생성 (웹 채팅용)
 */
export async function generateStreamingResponse(
  query: string,
  chunks: SearchResult[],
  options: GenerateOptions = {}
): Promise<ReadableStream<Uint8Array>> {
  const { channel = 'web', isFirstTurn = true } = options;

  // 컨텍스트 구성
  const context = chunks
    .map((chunk, index) => `[${index + 1}] ${chunk.content}`)
    .join('\n\n---\n\n');

  // 동적 시스템 프롬프트 생성
  const systemPrompt = buildSystemPrompt(channel, isFirstTurn);

  const userPrompt = `## 관련 문서 내용:
${context}

## 질문:
${query}

## 답변:`;

  // Gemini 스트리밍 (메인)
  if (process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    const { textStream } = await import('ai').then((ai) =>
      ai.streamText({
        model: google('gemini-2.5-flash-lite'),
        system: systemPrompt,
        prompt: userPrompt,
        maxOutputTokens: options.maxTokens || 1024,
        temperature: options.temperature || 0.7,
      })
    );

    return textStream as unknown as ReadableStream<Uint8Array>;
  }

  // OpenAI 폴백
  if (process.env.OPENAI_API_KEY) {
    const { textStream } = await import('ai').then((ai) =>
      ai.streamText({
        model: openai('gpt-4o-mini'),
        system: systemPrompt,
        prompt: userPrompt,
        maxOutputTokens: options.maxTokens || 1024,
        temperature: options.temperature || 0.7,
      })
    );

    return textStream as unknown as ReadableStream<Uint8Array>;
  }

  throw new Error('사용 가능한 LLM 서비스가 없습니다.');
}
