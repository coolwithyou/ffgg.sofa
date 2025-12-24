/**
 * LLM 응답 생성 모듈
 * Gemini 2.5 Flash-Lite (메인) + GPT-4o-mini (폴백)
 */

import { generateText } from 'ai';
import { google } from '@ai-sdk/google';
import { openai } from '@ai-sdk/openai';
import { logger } from '@/lib/logger';
import { SearchResult } from './retrieval';

export interface GenerateOptions {
  maxTokens?: number;
  temperature?: number;
  channel?: 'web' | 'kakao';
}

interface LLMProvider {
  name: string;
  model: string;
  priority: number;
  isAvailable: () => Promise<boolean>;
  generate: (systemPrompt: string, userPrompt: string, options: GenerateOptions) => Promise<string>;
}

// LLM 프로바이더 설정
const LLM_PROVIDERS: LLMProvider[] = [
  {
    name: 'gemini',
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
      return result.text;
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
      return result.text;
    },
  },
];

// 시스템 프롬프트
const WEB_SYSTEM_PROMPT = `당신은 기업 고객의 문서를 기반으로 질문에 답변하는 AI 어시스턴트입니다.

규칙:
1. 제공된 컨텍스트에 기반하여 정확하게 답변하세요.
2. 컨텍스트에 없는 정보는 "제공된 문서에서 관련 정보를 찾을 수 없습니다"라고 답변하세요.
3. 친절하고 전문적인 어조를 유지하세요.
4. 답변은 명확하고 구조적으로 작성하세요.
5. 필요한 경우 불렛 포인트나 번호 목록을 사용하세요.`;

const KAKAO_SYSTEM_PROMPT = `당신은 카카오톡에서 고객 질문에 답변하는 AI 어시스턴트입니다.

규칙:
1. 제공된 컨텍스트에 기반하여 정확하게 답변하세요.
2. 답변은 짧고 간결하게 (최대 300자) 작성하세요.
3. 친근하면서도 전문적인 어조를 유지하세요.
4. 컨텍스트에 없는 정보는 "관련 정보를 찾지 못했어요. 다른 질문이 있으신가요?"라고 답변하세요.`;

/**
 * RAG 기반 응답 생성
 */
export async function generateResponse(
  query: string,
  chunks: SearchResult[],
  options: GenerateOptions = {}
): Promise<string> {
  const { channel = 'web' } = options;

  // 컨텍스트 구성
  const context = chunks
    .map((chunk, index) => `[${index + 1}] ${chunk.content}`)
    .join('\n\n---\n\n');

  // 시스템 프롬프트 선택
  const systemPrompt = channel === 'kakao' ? KAKAO_SYSTEM_PROMPT : WEB_SYSTEM_PROMPT;

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

  // 우선순위 순으로 프로바이더 시도
  for (const provider of LLM_PROVIDERS) {
    try {
      const isAvailable = await provider.isAvailable();
      if (!isAvailable) {
        logger.debug(`Provider ${provider.name} is not available`);
        continue;
      }

      const response = await provider.generate(systemPrompt, userPrompt, options);

      const duration = Date.now() - startTime;
      logger.info('LLM response generated', {
        provider: provider.name,
        model: provider.model,
        duration,
        responseLength: response.length,
      });

      return response;
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
  const { channel = 'web' } = options;

  // 컨텍스트 구성
  const context = chunks
    .map((chunk, index) => `[${index + 1}] ${chunk.content}`)
    .join('\n\n---\n\n');

  const systemPrompt = channel === 'kakao' ? KAKAO_SYSTEM_PROMPT : WEB_SYSTEM_PROMPT;

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
