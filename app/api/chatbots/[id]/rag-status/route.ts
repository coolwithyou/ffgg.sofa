/**
 * RAG 인덱스 생성 상태 조회 API
 *
 * GET /api/chatbots/:id/rag-status - RAG 인덱스 상태 조회
 */

import { NextRequest, NextResponse } from 'next/server';
import { eq, and } from 'drizzle-orm';
import { db } from '@/lib/db';
import { chatbots } from '@/drizzle/schema';
import { validateSession } from '@/lib/auth/session';
import type { RagIndexStatus } from '@/lib/chat/rag-index-generator';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/chatbots/:id/rag-status - RAG 인덱스 상태 조회
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const session = await validateSession();
    if (!session) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 });
    }

    const { id } = await params;
    const tenantId = session.tenantId;

    // 챗봇 존재 확인 및 상태 조회
    const [chatbot] = await db
      .select({
        ragIndexStatus: chatbots.ragIndexStatus,
        ragIndexConfig: chatbots.ragIndexConfig,
      })
      .from(chatbots)
      .where(and(eq(chatbots.id, id), eq(chatbots.tenantId, tenantId)));

    if (!chatbot) {
      return NextResponse.json(
        { error: '챗봇을 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    const ragIndexConfig = chatbot.ragIndexConfig as {
      lastGeneratedAt?: string;
    } | null;

    return NextResponse.json({
      status: (chatbot.ragIndexStatus as RagIndexStatus) ?? 'idle',
      lastGeneratedAt: ragIndexConfig?.lastGeneratedAt ?? null,
    });
  } catch (error) {
    console.error('RAG status get error:', error);
    return NextResponse.json(
      { error: 'RAG 상태 조회 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
