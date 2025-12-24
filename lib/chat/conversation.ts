/**
 * 대화 관리 서비스
 * 세션 기반 대화 컨텍스트 관리
 */

import { db, conversations, usageLogs } from '@/lib/db';
import { eq, and, sql } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '@/lib/logger';
import type { ChatMessage, ConversationContext } from './types';

/**
 * 대화 세션 조회 또는 생성
 */
export async function getOrCreateConversation(
  tenantId: string,
  sessionId: string | undefined,
  channel: 'web' | 'kakao' = 'web'
): Promise<ConversationContext> {
  // 세션 ID가 없으면 새로 생성
  const sid = sessionId || uuidv4();

  // 기존 대화 조회
  const existing = await db
    .select()
    .from(conversations)
    .where(and(eq(conversations.tenantId, tenantId), eq(conversations.sessionId, sid)))
    .limit(1);

  if (existing.length > 0) {
    const conv = existing[0];
    return {
      tenantId,
      sessionId: sid,
      channel: conv.channel as 'web' | 'kakao',
      messages: (conv.messages as ChatMessage[]) || [],
    };
  }

  // 새 대화 생성
  await db.insert(conversations).values({
    tenantId,
    sessionId: sid,
    channel,
    messages: [],
    metadata: {
      createdVia: channel,
      userAgent: null, // API에서 설정
    },
  });

  logger.info('New conversation created', {
    tenantId,
    sessionId: sid,
    channel,
  });

  return {
    tenantId,
    sessionId: sid,
    channel,
    messages: [],
  };
}

/**
 * 대화에 메시지 추가
 */
export async function addMessageToConversation(
  tenantId: string,
  sessionId: string,
  message: ChatMessage
): Promise<void> {
  await db
    .update(conversations)
    .set({
      messages: sql`${conversations.messages} || ${JSON.stringify([message])}::jsonb`,
      updatedAt: new Date(),
    })
    .where(and(eq(conversations.tenantId, tenantId), eq(conversations.sessionId, sessionId)));
}

/**
 * 대화 히스토리 조회
 */
export async function getConversationHistory(
  tenantId: string,
  sessionId: string,
  limit: number = 10
): Promise<ChatMessage[]> {
  const result = await db
    .select({ messages: conversations.messages })
    .from(conversations)
    .where(and(eq(conversations.tenantId, tenantId), eq(conversations.sessionId, sessionId)))
    .limit(1);

  if (result.length === 0) {
    return [];
  }

  const messages = (result[0].messages as ChatMessage[]) || [];
  // 최근 N개 메시지만 반환
  return messages.slice(-limit);
}

/**
 * 대화 삭제
 */
export async function deleteConversation(tenantId: string, sessionId: string): Promise<boolean> {
  const result = await db
    .delete(conversations)
    .where(and(eq(conversations.tenantId, tenantId), eq(conversations.sessionId, sessionId)));

  return (result.rowCount ?? 0) > 0;
}

/**
 * 사용량 로그 업데이트
 */
export async function updateUsageLog(
  tenantId: string,
  tokenUsage: number
): Promise<void> {
  const today = new Date().toISOString().split('T')[0];

  // Upsert 사용량 로그
  await db.execute(sql`
    INSERT INTO usage_logs (tenant_id, date, message_count, token_usage)
    VALUES (${tenantId}, ${today}::date, 1, ${tokenUsage})
    ON CONFLICT (tenant_id, date)
    DO UPDATE SET
      message_count = usage_logs.message_count + 1,
      token_usage = usage_logs.token_usage + ${tokenUsage}
  `);
}

/**
 * 일일 대화 수 증가
 */
export async function incrementConversationCount(tenantId: string): Promise<void> {
  const today = new Date().toISOString().split('T')[0];

  await db.execute(sql`
    INSERT INTO usage_logs (tenant_id, date, conversation_count)
    VALUES (${tenantId}, ${today}::date, 1)
    ON CONFLICT (tenant_id, date)
    DO UPDATE SET
      conversation_count = usage_logs.conversation_count + 1
  `);
}

/**
 * 대화 메타데이터 업데이트
 */
export async function updateConversationMetadata(
  tenantId: string,
  sessionId: string,
  metadata: Record<string, unknown>
): Promise<void> {
  await db
    .update(conversations)
    .set({
      metadata: sql`${conversations.metadata} || ${JSON.stringify(metadata)}::jsonb`,
      updatedAt: new Date(),
    })
    .where(and(eq(conversations.tenantId, tenantId), eq(conversations.sessionId, sessionId)));
}
