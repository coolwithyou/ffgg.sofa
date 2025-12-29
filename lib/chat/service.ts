/**
 * 채팅 서비스
 * RAG 기반 대화 처리
 */

import { logger } from '@/lib/logger';
import { hybridSearch, hybridSearchMultiDataset } from '@/lib/rag/retrieval';
import { generateResponse, type GenerateOptions } from '@/lib/rag/generator';
import {
  getOrCreateConversation,
  addMessageToConversation,
  getConversationHistory,
  updateUsageLog,
  incrementConversationCount,
} from './conversation';
import { findCachedResponse, cacheResponse } from './cache';
import { getChatbotDatasetIds, getDefaultChatbot, getChatbot } from './chatbot';
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
    // 1. 챗봇 조회 (chatbotId가 없으면 기본 챗봇 사용)
    let chatbotId = request.chatbotId;
    let chatbot = chatbotId
      ? await getChatbot(chatbotId, tenantId)
      : await getDefaultChatbot(tenantId);

    if (!chatbot) {
      logger.warn('No chatbot found, using default settings', { tenantId, chatbotId });
    } else {
      chatbotId = chatbot.id;
      // 챗봇 설정에서 옵션 오버라이드
      if (chatbot.llmConfig?.temperature !== undefined) {
        options.temperature = options.temperature ?? chatbot.llmConfig.temperature;
      }
      if (chatbot.llmConfig?.maxTokens !== undefined) {
        options.maxTokens = options.maxTokens ?? chatbot.llmConfig.maxTokens;
      }
      if (chatbot.searchConfig?.maxChunks !== undefined) {
        options.maxChunks = options.maxChunks ?? chatbot.searchConfig.maxChunks;
      }
    }

    // 2. 대화 세션 조회/생성
    const conversation = await getOrCreateConversation(tenantId, request.sessionId, channel);
    const isNewConversation = conversation.messages.length === 0;

    // 3. 캐시 확인
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

    // 4. 대화 히스토리 조회
    let contextMessages: ChatMessage[] = [];
    if (includeHistory && conversation.messages.length > 0) {
      contextMessages = await getConversationHistory(tenantId, conversation.sessionId, historyLimit);
    }

    // 5. Hybrid Search로 관련 청크 검색
    // 챗봇이 있으면 연결된 데이터셋에서만 검색, 없으면 전체 검색
    let searchResults;
    if (chatbotId) {
      const datasetIds = await getChatbotDatasetIds(chatbotId);
      if (datasetIds.length > 0) {
        searchResults = await hybridSearchMultiDataset(tenantId, datasetIds, request.message, maxChunks);
      } else {
        logger.warn('Chatbot has no linked datasets, falling back to tenant search', { chatbotId });
        searchResults = await hybridSearch(tenantId, request.message, maxChunks);
      }
    } else {
      searchResults = await hybridSearch(tenantId, request.message, maxChunks);
    }

    // 6. 히스토리 컨텍스트를 쿼리에 포함
    let queryWithContext = request.message;
    if (contextMessages.length > 0) {
      const historyContext = contextMessages
        .map((m) => `${m.role === 'user' ? '사용자' : '어시스턴트'}: ${m.content}`)
        .join('\n');
      queryWithContext = `[이전 대화]\n${historyContext}\n\n[현재 질문]\n${request.message}`;
    }

    // 7. LLM 응답 생성
    const generateOptions: GenerateOptions = {
      temperature,
      maxTokens: maxTokens || (channel === 'kakao' ? 300 : 1024),
      channel,
    };

    const responseText = await generateResponse(queryWithContext, searchResults, generateOptions);

    // 8. 메시지 저장
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

    // 9. 사용량 기록 (토큰 추정)
    const estimatedTokens = Math.ceil(responseText.length / 4);
    await updateUsageLog(tenantId, estimatedTokens);

    if (isNewConversation) {
      await incrementConversationCount(tenantId);
    }

    // 10. 응답 캐싱 (좋은 품질의 응답만)
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
