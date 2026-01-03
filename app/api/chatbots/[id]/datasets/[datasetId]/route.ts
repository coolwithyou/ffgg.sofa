/**
 * 챗봇-데이터셋 개별 연결 API
 *
 * PATCH /api/chatbots/:id/datasets/:datasetId - 가중치 수정
 * DELETE /api/chatbots/:id/datasets/:datasetId - 데이터셋 연결 해제
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { eq, and } from 'drizzle-orm';
import { db } from '@/lib/db';
import { chatbots, chatbotDatasets, datasets } from '@/drizzle/schema';
import { validateSession } from '@/lib/auth/session';
import { triggerRagIndexGeneration } from '@/lib/chat/rag-index-generator';

// 가중치 수정 스키마
const updateWeightSchema = z.object({
  weight: z.number().min(0.1).max(10),
});

interface RouteParams {
  params: Promise<{ id: string; datasetId: string }>;
}

/**
 * PATCH /api/chatbots/:id/datasets/:datasetId - 가중치 수정
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await validateSession();
    if (!session) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 });
    }

    const { id, datasetId } = await params;
    const tenantId = session.tenantId;

    // 챗봇 존재 확인
    const [chatbot] = await db
      .select()
      .from(chatbots)
      .where(and(eq(chatbots.id, id), eq(chatbots.tenantId, tenantId)));

    if (!chatbot) {
      return NextResponse.json(
        { error: '챗봇을 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    // 연결 존재 확인
    const [link] = await db
      .select()
      .from(chatbotDatasets)
      .where(
        and(
          eq(chatbotDatasets.chatbotId, id),
          eq(chatbotDatasets.datasetId, datasetId)
        )
      );

    if (!link) {
      return NextResponse.json(
        { error: '연결된 데이터셋을 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    // 요청 본문 파싱
    const body = await request.json();
    const parseResult = updateWeightSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: '입력값이 올바르지 않습니다', details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const { weight } = parseResult.data;

    // 가중치 업데이트
    await db
      .update(chatbotDatasets)
      .set({ weight })
      .where(eq(chatbotDatasets.id, link.id));

    return NextResponse.json({
      message: '가중치가 수정되었습니다',
      weight,
    });
  } catch (error) {
    console.error('Chatbot dataset weight update error:', error);
    return NextResponse.json(
      { error: '가중치 수정 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/chatbots/:id/datasets/:datasetId - 데이터셋 연결 해제
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await validateSession();
    if (!session) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 });
    }

    const { id, datasetId } = await params;
    const tenantId = session.tenantId;

    // 챗봇 존재 확인
    const [chatbot] = await db
      .select()
      .from(chatbots)
      .where(and(eq(chatbots.id, id), eq(chatbots.tenantId, tenantId)));

    if (!chatbot) {
      return NextResponse.json(
        { error: '챗봇을 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    // 연결 존재 확인
    const [link] = await db
      .select()
      .from(chatbotDatasets)
      .where(
        and(
          eq(chatbotDatasets.chatbotId, id),
          eq(chatbotDatasets.datasetId, datasetId)
        )
      );

    if (!link) {
      return NextResponse.json(
        { error: '연결된 데이터셋을 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    // 연결 해제
    await db.delete(chatbotDatasets).where(eq(chatbotDatasets.id, link.id));

    // 콘텐츠 변경 시점 갱신 (페르소나 재생성 필요 여부 판단에 사용)
    await db
      .update(chatbots)
      .set({ contentUpdatedAt: new Date() })
      .where(eq(chatbots.id, id));

    // 데이터셋 해제 시 RAG 인덱스 백그라운드 재생성 트리거
    triggerRagIndexGeneration(id, tenantId);

    return NextResponse.json({
      message: '데이터셋 연결이 해제되었습니다',
    });
  } catch (error) {
    console.error('Chatbot dataset unlink error:', error);
    return NextResponse.json(
      { error: '데이터셋 연결 해제 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
