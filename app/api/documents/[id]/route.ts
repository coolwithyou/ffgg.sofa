/**
 * 문서 개별 API
 *
 * GET /api/documents/:id - 문서 상세 조회
 * DELETE /api/documents/:id - 문서 삭제
 */

import { NextRequest, NextResponse } from 'next/server';
import { eq, and } from 'drizzle-orm';
import { db } from '@/lib/db';
import { documents, chatbotDatasets } from '@/drizzle/schema';
import { validateSession } from '@/lib/auth/session';
import { logger } from '@/lib/logger';
import { triggerRagIndexGeneration } from '@/lib/chat/rag-index-generator';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/documents/:id - 문서 상세 조회
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const session = await validateSession();
    if (!session) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 });
    }

    const { id } = await params;
    const tenantId = session.tenantId;

    const [document] = await db
      .select()
      .from(documents)
      .where(and(eq(documents.id, id), eq(documents.tenantId, tenantId)));

    if (!document) {
      return NextResponse.json(
        { error: '문서를 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    return NextResponse.json({ document });
  } catch (error) {
    console.error('Document get error:', error);
    return NextResponse.json(
      { error: '문서 조회 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/documents/:id - 문서 삭제
 *
 * 문서와 관련된 청크가 cascade로 함께 삭제됩니다.
 * 삭제 후 연결된 챗봇들의 RAG 인덱스 재생성을 트리거합니다.
 */
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const session = await validateSession();
    if (!session) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 });
    }

    const { id } = await params;
    const tenantId = session.tenantId;

    // 문서 존재 및 소유권 확인 (datasetId도 함께 조회)
    const [document] = await db
      .select({
        id: documents.id,
        filename: documents.filename,
        datasetId: documents.datasetId,
      })
      .from(documents)
      .where(and(eq(documents.id, id), eq(documents.tenantId, tenantId)));

    if (!document) {
      return NextResponse.json(
        { error: '문서를 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    // 삭제 전에 연결된 챗봇 목록 조회 (datasetId가 있는 경우)
    let connectedChatbotIds: string[] = [];
    if (document.datasetId) {
      const connections = await db
        .select({ chatbotId: chatbotDatasets.chatbotId })
        .from(chatbotDatasets)
        .where(eq(chatbotDatasets.datasetId, document.datasetId));
      connectedChatbotIds = connections.map((c) => c.chatbotId);
    }

    // 삭제 (cascade로 청크도 함께 삭제됨)
    await db.delete(documents).where(eq(documents.id, id));

    logger.info('Document deleted via API', {
      documentId: id,
      filename: document.filename,
      datasetId: document.datasetId,
      tenantId,
      userId: session.userId,
      connectedChatbots: connectedChatbotIds.length,
    });

    // 연결된 챗봇들의 RAG 인덱스 재생성 트리거 (fire-and-forget)
    for (const chatbotId of connectedChatbotIds) {
      triggerRagIndexGeneration(chatbotId, tenantId).catch((error) => {
        logger.error('Failed to trigger RAG regeneration after document delete', error, {
          chatbotId,
          documentId: id,
        });
      });
    }

    return NextResponse.json({
      message: '문서가 삭제되었습니다',
      triggeredRagRegeneration: connectedChatbotIds.length > 0,
    });
  } catch (error) {
    console.error('Document delete error:', error);
    return NextResponse.json(
      { error: '문서 삭제 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
