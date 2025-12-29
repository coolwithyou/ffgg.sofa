/**
 * 챗봇 헬퍼 함수
 * 채팅 서비스에서 사용하는 챗봇 관련 유틸리티
 */

import { db } from '@/lib/db';
import { chatbots, chatbotDatasets } from '@/drizzle/schema';
import { eq, and } from 'drizzle-orm';
import { logger } from '@/lib/logger';

export interface ChatbotInfo {
  id: string;
  name: string;
  tenantId: string;
  llmConfig: {
    temperature?: number;
    maxTokens?: number;
    systemPrompt?: string | null;
  };
  searchConfig: {
    maxChunks?: number;
    minScore?: number;
  };
}

/**
 * 챗봇의 연결된 데이터셋 ID 목록 조회
 */
export async function getChatbotDatasetIds(chatbotId: string): Promise<string[]> {
  try {
    const links = await db
      .select({ datasetId: chatbotDatasets.datasetId })
      .from(chatbotDatasets)
      .where(eq(chatbotDatasets.chatbotId, chatbotId));

    return links.map((link) => link.datasetId);
  } catch (error) {
    logger.error('Failed to get chatbot dataset IDs', error as Error, { chatbotId });
    return [];
  }
}

/**
 * 테넌트의 기본 챗봇 조회
 */
export async function getDefaultChatbot(tenantId: string): Promise<ChatbotInfo | null> {
  try {
    const [chatbot] = await db
      .select({
        id: chatbots.id,
        name: chatbots.name,
        tenantId: chatbots.tenantId,
        llmConfig: chatbots.llmConfig,
        searchConfig: chatbots.searchConfig,
      })
      .from(chatbots)
      .where(and(eq(chatbots.tenantId, tenantId), eq(chatbots.isDefault, true)));

    if (!chatbot) {
      return null;
    }

    return {
      id: chatbot.id,
      name: chatbot.name,
      tenantId: chatbot.tenantId,
      llmConfig: (chatbot.llmConfig as ChatbotInfo['llmConfig']) || {},
      searchConfig: (chatbot.searchConfig as ChatbotInfo['searchConfig']) || {},
    };
  } catch (error) {
    logger.error('Failed to get default chatbot', error as Error, { tenantId });
    return null;
  }
}

/**
 * 챗봇 정보 조회
 */
export async function getChatbot(chatbotId: string, tenantId: string): Promise<ChatbotInfo | null> {
  try {
    const [chatbot] = await db
      .select({
        id: chatbots.id,
        name: chatbots.name,
        tenantId: chatbots.tenantId,
        llmConfig: chatbots.llmConfig,
        searchConfig: chatbots.searchConfig,
      })
      .from(chatbots)
      .where(and(eq(chatbots.id, chatbotId), eq(chatbots.tenantId, tenantId)));

    if (!chatbot) {
      return null;
    }

    return {
      id: chatbot.id,
      name: chatbot.name,
      tenantId: chatbot.tenantId,
      llmConfig: (chatbot.llmConfig as ChatbotInfo['llmConfig']) || {},
      searchConfig: (chatbot.searchConfig as ChatbotInfo['searchConfig']) || {},
    };
  } catch (error) {
    logger.error('Failed to get chatbot', error as Error, { chatbotId, tenantId });
    return null;
  }
}

/**
 * 위젯 API 키로 챗봇 조회
 */
export async function getChatbotByWidgetApiKey(apiKey: string): Promise<ChatbotInfo | null> {
  try {
    const [chatbot] = await db
      .select({
        id: chatbots.id,
        name: chatbots.name,
        tenantId: chatbots.tenantId,
        llmConfig: chatbots.llmConfig,
        searchConfig: chatbots.searchConfig,
      })
      .from(chatbots)
      .where(and(eq(chatbots.widgetApiKey, apiKey), eq(chatbots.widgetEnabled, true)));

    if (!chatbot) {
      return null;
    }

    return {
      id: chatbot.id,
      name: chatbot.name,
      tenantId: chatbot.tenantId,
      llmConfig: (chatbot.llmConfig as ChatbotInfo['llmConfig']) || {},
      searchConfig: (chatbot.searchConfig as ChatbotInfo['searchConfig']) || {},
    };
  } catch (error) {
    logger.error('Failed to get chatbot by widget API key', error as Error);
    return null;
  }
}

/**
 * 카카오 봇 ID로 챗봇 조회
 */
export async function getChatbotByKakaoBotId(kakaoBotId: string): Promise<ChatbotInfo | null> {
  try {
    const [chatbot] = await db
      .select({
        id: chatbots.id,
        name: chatbots.name,
        tenantId: chatbots.tenantId,
        llmConfig: chatbots.llmConfig,
        searchConfig: chatbots.searchConfig,
      })
      .from(chatbots)
      .where(and(eq(chatbots.kakaoBotId, kakaoBotId), eq(chatbots.kakaoEnabled, true)));

    if (!chatbot) {
      return null;
    }

    return {
      id: chatbot.id,
      name: chatbot.name,
      tenantId: chatbot.tenantId,
      llmConfig: (chatbot.llmConfig as ChatbotInfo['llmConfig']) || {},
      searchConfig: (chatbot.searchConfig as ChatbotInfo['searchConfig']) || {},
    };
  } catch (error) {
    logger.error('Failed to get chatbot by Kakao bot ID', error as Error, { kakaoBotId });
    return null;
  }
}
