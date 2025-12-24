/**
 * 채팅 서비스
 * RAG 기반 대화 처리
 */

import { logger } from '@/lib/logger';
import { hybridSearch } from '@/lib/rag/retrieval';
import { generateResponse, type GenerateOptions } from '@/lib/rag/generator';
import {
  getOrCreateConversation,
  addMessageToConversation,
  getConversationHistory,
  updateUsageLog,
  incrementConversationCount,
} from './conversation';
import { findCachedResponse, cacheResponse } from './cache';
import type { ChatMessage, ChatRequest, ChatResponse, ChatOptions } from './types';

/**
 * 채팅 메시지 처리
 */
export async function processChat(
  tenantId: string,
  request: ChatRequest,
  options: ChatOptions = {}
): Promise<ChatResponse> {
  const startTime = Date.now();
  const {
    maxChunks = 3,
    temperature = 0.7,
    maxTokens,
    includeHistory = true,
    historyLimit = 4,
  } = options;

  const channel = request.channel || 'web';

  try {
    // 1. 대화 세션 조회/생성
    const conversation = await getOrCreateConversation(tenantId, request.sessionId, channel);
    const isNewConversation = conversation.messages.length === 0;

    // 2. 캐시 확인
    const cacheResult = await findCachedResponse(tenantId, request.message);

    if (cacheResult.hit && cacheResult.response) {
      // 캐시된 응답 사용
      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: cacheResult.response,
        timestamp: new Date().toISOString(),
        metadata: { cached: true },
      };

      // 사용자 메시지와 응답 저장
      await addMessageToConversation(tenantId, conversation.sessionId, {
        role: 'user',
        content: request.message,
        timestamp: new Date().toISOString(),
      });
      await addMessageToConversation(tenantId, conversation.sessionId, assistantMessage);

      if (isNewConversation) {
        await incrementConversationCount(tenantId);
      }

      logger.info('Chat response from cache', {
        tenantId,
        sessionId: conversation.sessionId,
        duration: Date.now() - startTime,
      });

      return {
        message: cacheResult.response,
        sessionId: conversation.sessionId,
        cached: true,
      };
    }

    // 3. 대화 히스토리 조회
    let contextMessages: ChatMessage[] = [];
    if (includeHistory && conversation.messages.length > 0) {
      contextMessages = await getConversationHistory(tenantId, conversation.sessionId, historyLimit);
    }

    // 4. Hybrid Search로 관련 청크 검색
    const searchResults = await hybridSearch(tenantId, request.message, maxChunks);

    // 5. 히스토리 컨텍스트를 쿼리에 포함
    let queryWithContext = request.message;
    if (contextMessages.length > 0) {
      const historyContext = contextMessages
        .map((m) => `${m.role === 'user' ? '사용자' : '어시스턴트'}: ${m.content}`)
        .join('\n');
      queryWithContext = `[이전 대화]\n${historyContext}\n\n[현재 질문]\n${request.message}`;
    }

    // 6. LLM 응답 생성
    const generateOptions: GenerateOptions = {
      temperature,
      maxTokens: maxTokens || (channel === 'kakao' ? 300 : 1024),
      channel,
    };

    const responseText = await generateResponse(queryWithContext, searchResults, generateOptions);

    // 7. 메시지 저장
    const userMessage: ChatMessage = {
      role: 'user',
      content: request.message,
      timestamp: new Date().toISOString(),
    };

    const assistantMessage: ChatMessage = {
      role: 'assistant',
      content: responseText,
      timestamp: new Date().toISOString(),
      metadata: {
        sources: searchResults.map((r) => r.documentId),
      },
    };

    await addMessageToConversation(tenantId, conversation.sessionId, userMessage);
    await addMessageToConversation(tenantId, conversation.sessionId, assistantMessage);

    // 8. 사용량 기록 (토큰 추정)
    const estimatedTokens = Math.ceil(responseText.length / 4);
    await updateUsageLog(tenantId, estimatedTokens);

    if (isNewConversation) {
      await incrementConversationCount(tenantId);
    }

    // 9. 응답 캐싱 (좋은 품질의 응답만)
    if (searchResults.length > 0 && searchResults[0].score > 0.7) {
      await cacheResponse(tenantId, request.message, responseText);
    }

    const duration = Date.now() - startTime;
    logger.info('Chat response generated', {
      tenantId,
      sessionId: conversation.sessionId,
      channel,
      chunksUsed: searchResults.length,
      estimatedTokens,
      duration,
    });

    return {
      message: responseText,
      sessionId: conversation.sessionId,
      sources: searchResults.map((r) => ({
        documentId: r.documentId,
        chunkId: r.chunkId,
        content: r.content.slice(0, 200) + (r.content.length > 200 ? '...' : ''),
        score: r.score,
      })),
      cached: false,
    };
  } catch (error) {
    logger.error('Chat processing failed', error as Error, {
      tenantId,
      channel,
    });
    throw error;
  }
}

/**
 * 스트리밍 채팅 (향후 구현)
 */
export async function* processChatStream(
  tenantId: string,
  request: ChatRequest,
  options: ChatOptions = {}
): AsyncGenerator<string, void, unknown> {
  // TODO: 스트리밍 응답 구현
  // Vercel AI SDK의 streamText 활용
  const response = await processChat(tenantId, request, options);
  yield response.message;
}
