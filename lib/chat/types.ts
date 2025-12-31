/**
 * 채팅 관련 타입 정의
 */

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  metadata?: {
    sources?: string[];
    tokenUsage?: number;
    cached?: boolean;
  };
}

export interface ChatRequest {
  message: string;
  sessionId?: string;
  channel?: 'web' | 'kakao';
  chatbotId?: string;
}

export interface ChatResponse {
  message: string;
  sessionId: string;
  sources?: Array<{
    documentId: string;
    chunkId: string;
    content: string;
    score: number;
  }>;
  cached?: boolean;
  /** Intent 분류 결과 (새로운 Intent-Aware RAG 시스템) */
  intent?: 'CHITCHAT' | 'DOMAIN_QUERY' | 'OUT_OF_SCOPE';
}

export interface ConversationContext {
  id: string; // UUID - DB 기본 키 (토큰 추적용)
  tenantId: string;
  sessionId: string;
  channel: 'web' | 'kakao';
  chatbotId?: string;
  messages: ChatMessage[];
}

export interface ChatOptions {
  maxChunks?: number;
  temperature?: number;
  maxTokens?: number;
  includeHistory?: boolean;
  historyLimit?: number;
}
