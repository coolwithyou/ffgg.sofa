/**
 * 채팅 서비스
 * Intent-Aware RAG 기반 대화 처리
 */

import { logger } from '@/lib/logger';
import { hybridSearch, hybridSearchMultiDataset, type SearchResult } from '@/lib/rag/retrieval';
import { generateResponse, type GenerateOptions } from '@/lib/rag/generator';
import { rewriteQuery } from '@/lib/rag/query-rewriter';
import {
  getOrCreateConversation,
  addMessageToConversation,
  getConversationHistory,
  updateUsageLog,
  incrementConversationCount,
} from './conversation';
import { findCachedResponse, cacheResponse } from './cache';
import { getChatbotDatasetIds, getDefaultChatbot, getChatbot } from './chatbot';
import { classifyIntent, DEFAULT_PERSONA } from './intent-classifier';
import { routeQuery } from './query-router';
import { trackResponseTime, trackCacheHitResponseTime } from '@/lib/performance/response-tracker';
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
  const timings: Record<string, number> = {};
  let stepStart = Date.now();

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
    stepStart = Date.now();
    let chatbotId = request.chatbotId;
    let chatbot = chatbotId
      ? await getChatbot(chatbotId, tenantId)
      : await getDefaultChatbot(tenantId);
    timings['1_chatbot_lookup'] = Date.now() - stepStart;

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
    stepStart = Date.now();
    const conversation = await getOrCreateConversation(tenantId, request.sessionId, channel);
    const isNewConversation = conversation.messages.length === 0;
    timings['2_session_lookup'] = Date.now() - stepStart;

    // 3. 캐시 확인
    stepStart = Date.now();
    const cacheResult = await findCachedResponse(tenantId, request.message);
    timings['3_cache_lookup'] = Date.now() - stepStart;

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

      const cacheDuration = Date.now() - startTime;
      logger.info('Chat response from cache', {
        tenantId,
        sessionId: conversation.sessionId,
        duration: cacheDuration,
        timings,
      });

      // 캐시 히트 응답 시간 추적 (비동기, Fire-and-Forget)
      trackCacheHitResponseTime({
        tenantId,
        chatbotId: chatbotId ?? undefined,
        conversationId: conversation.id, // UUID 사용
        channel,
        totalDurationMs: cacheDuration,
        cacheLookupMs: timings['3_cache_lookup'] ?? 0,
      }).catch(() => {});

      return {
        message: cacheResult.response,
        sessionId: conversation.sessionId,
        cached: true,
      };
    }

    // 4. 대화 히스토리 조회
    stepStart = Date.now();
    let contextMessages: ChatMessage[] = [];
    if (includeHistory && conversation.messages.length > 0) {
      contextMessages = await getConversationHistory(tenantId, conversation.sessionId, historyLimit);
    }
    timings['4_history_lookup'] = Date.now() - stepStart;

    const isFirstTurn = contextMessages.length === 0;

    // 5. 병렬 실행: Intent Classification + (Query Rewriting + RAG Search)
    // Intent 분류와 RAG 파이프라인을 동시에 실행하여 지연 최소화
    stepStart = Date.now();

    // RAG 파이프라인 실행 함수
    const executeRAGPipeline = async (): Promise<{
      searchQuery: string;
      searchResults: SearchResult[];
    }> => {
      let searchQuery = request.message;

      // Query Rewriting (후속 질문인 경우 맥락 반영)
      if (!isFirstTurn) {
        try {
          searchQuery = await rewriteQuery(request.message, contextMessages, {
            maxHistoryMessages: historyLimit,
            temperature: 0.3,
            maxTokens: 150,
            trackingContext: {
              tenantId,
              chatbotId: chatbotId ?? undefined,
              conversationId: conversation.id,
              featureType: 'rewrite',
            },
          });

          if (searchQuery !== request.message) {
            logger.debug('Query rewritten for search', {
              tenantId,
              sessionId: conversation.sessionId,
              original: request.message,
              rewritten: searchQuery,
            });
          }
        } catch (error) {
          logger.warn('Query rewriting failed, using original', {
            error: error instanceof Error ? error.message : String(error),
            tenantId,
            sessionId: conversation.sessionId,
          });
          searchQuery = request.message;
        }
      }

      // Hybrid Search로 관련 청크 검색
      const embeddingTrackingContext = { tenantId, chatbotId: chatbotId ?? undefined };
      let searchResults: SearchResult[];

      if (chatbotId) {
        const datasetIds = await getChatbotDatasetIds(chatbotId);
        if (datasetIds.length > 0) {
          searchResults = await hybridSearchMultiDataset(tenantId, datasetIds, searchQuery, maxChunks, embeddingTrackingContext);
        } else {
          logger.warn('Chatbot has no linked datasets, falling back to tenant search', { chatbotId });
          searchResults = await hybridSearch(tenantId, searchQuery, maxChunks, embeddingTrackingContext);
        }
      } else {
        searchResults = await hybridSearch(tenantId, searchQuery, maxChunks, embeddingTrackingContext);
      }

      return { searchQuery, searchResults };
    };

    // 병렬 실행
    const [intentResult, ragPipelineResult] = await Promise.all([
      classifyIntent(request.message, contextMessages, DEFAULT_PERSONA),
      executeRAGPipeline(),
    ]);
    const { searchResults } = ragPipelineResult;
    timings['5_parallel_intent_rag'] = Date.now() - stepStart;

    logger.debug('Intent classification result', {
      tenantId,
      sessionId: conversation.sessionId,
      message: request.message.slice(0, 50),
      intent: intentResult.intent,
      confidence: intentResult.confidence,
      rulesMatch: intentResult.rulesMatch,
    });

    // 6. Query Router - Intent와 RAG 결과를 기반으로 응답 전략 결정
    stepStart = Date.now();
    const routerResult = await routeQuery(request.message, intentResult, searchResults, DEFAULT_PERSONA);
    timings['6_query_routing'] = Date.now() - stepStart;

    // 7. 응답 생성 (Intent 기반 또는 RAG 기반)
    stepStart = Date.now();
    let responseText: string;

    if (!routerResult.shouldUseRAG && routerResult.response) {
      // Intent 기반 응답 (CHITCHAT 또는 OUT_OF_SCOPE)
      responseText = routerResult.response;
      logger.info('Response generated by intent router', {
        tenantId,
        sessionId: conversation.sessionId,
        intent: routerResult.intent,
        reasoning: routerResult.reasoning,
      });
    } else {
      // RAG 기반 응답 생성 (DOMAIN_QUERY)
      // 히스토리 컨텍스트를 LLM 프롬프트에 포함 (원본 메시지 사용)
      let queryWithContext = request.message;
      if (contextMessages.length > 0) {
        const historyContext = contextMessages
          .map((m) => `${m.role === 'user' ? '사용자' : '어시스턴트'}: ${m.content}`)
          .join('\n');
        queryWithContext = `[이전 대화]\n${historyContext}\n\n[현재 질문]\n${request.message}`;
      }

      const generateOptions: GenerateOptions = {
        temperature,
        maxTokens: maxTokens || (channel === 'kakao' ? 300 : 1024),
        channel,
        isFirstTurn,
        trackingContext: {
          tenantId,
          chatbotId: chatbotId ?? undefined,
          conversationId: conversation.id,
          featureType: 'chat',
        },
      };

      responseText = await generateResponse(queryWithContext, searchResults, generateOptions);
    }
    timings['7_response_generation'] = Date.now() - stepStart;

    // 8. 메시지 저장
    stepStart = Date.now();
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
    timings['8_message_save'] = Date.now() - stepStart;

    // 9. 사용량 기록 (토큰 추정)
    stepStart = Date.now();
    const estimatedTokens = Math.ceil(responseText.length / 4);
    await updateUsageLog(tenantId, estimatedTokens);

    if (isNewConversation) {
      await incrementConversationCount(tenantId);
    }
    timings['9_usage_log'] = Date.now() - stepStart;

    // 10. 응답 캐싱 (DOMAIN_QUERY이고 RAG 품질이 좋은 경우만)
    stepStart = Date.now();
    if (routerResult.shouldUseRAG && searchResults.length > 0 && searchResults[0].score > 0.7) {
      await cacheResponse(tenantId, request.message, responseText);
    }
    timings['10_cache_save'] = Date.now() - stepStart;

    const duration = Date.now() - startTime;
    logger.info('Chat response generated', {
      tenantId,
      sessionId: conversation.sessionId,
      channel,
      intent: routerResult.intent,
      usedRAG: routerResult.shouldUseRAG,
      chunksUsed: searchResults.length,
      estimatedTokens,
      duration,
      timings,
    });

    // 응답 시간 추적 (비동기, Fire-and-Forget)
    trackResponseTime({
      tenantId,
      chatbotId: chatbotId ?? undefined,
      conversationId: conversation.id, // UUID 사용
      channel,
      totalDurationMs: duration,
      timings,
      cacheHit: false,
      chunksUsed: searchResults.length,
      estimatedTokens,
    }).catch(() => {});

    return {
      message: responseText,
      sessionId: conversation.sessionId,
      sources: routerResult.shouldUseRAG
        ? searchResults.map((r) => ({
            documentId: r.documentId,
            chunkId: r.chunkId,
            content: r.content.slice(0, 200) + (r.content.length > 200 ? '...' : ''),
            score: r.score,
          }))
        : undefined,
      cached: false,
      intent: routerResult.intent,
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
