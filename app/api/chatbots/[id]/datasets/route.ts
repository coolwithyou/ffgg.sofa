/**
 * 챗봇-데이터셋 연결 API
 *
 * GET /api/chatbots/:id/datasets - 연결된 데이터셋 목록
 * POST /api/chatbots/:id/datasets - 데이터셋 연결
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { eq, and, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { chatbots, chatbotDatasets, datasets } from '@/drizzle/schema';
import { validateSession } from '@/lib/auth/session';
import { triggerRagIndexGeneration } from '@/lib/chat/rag-index-generator';

// 데이터셋 연결 스키마
const linkDatasetSchema = z.object({
  datasetId: z.string().uuid(),
  weight: z.number().min(0.1).max(10).optional().default(1.0),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/chatbots/:id/datasets - 연결된 데이터셋 목록
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await validateSession();
    if (!session) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 });
    }

    const { id } = await params;
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

    // 연결된 데이터셋 조회
    const linkedDatasets = await db
      .select({
        id: datasets.id,
        name: datasets.name,
        description: datasets.description,
        documentCount: datasets.documentCount,
        chunkCount: datasets.chunkCount,
        totalStorageBytes: datasets.totalStorageBytes,
        status: datasets.status,
        isDefault: datasets.isDefault,
        weight: chatbotDatasets.weight,
        linkedAt: chatbotDatasets.createdAt,
      })
      .from(chatbotDatasets)
      .innerJoin(datasets, eq(chatbotDatasets.datasetId, datasets.id))
      .where(eq(chatbotDatasets.chatbotId, id));

    return NextResponse.json({
      datasets: linkedDatasets,
    });
  } catch (error) {
    console.error('Chatbot datasets get error:', error);
    return NextResponse.json(
      { error: '데이터셋 목록 조회 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/chatbots/:id/datasets - 데이터셋 연결
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await validateSession();
    if (!session) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 });
    }

    const { id } = await params;
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

    // 요청 본문 파싱
    const body = await request.json();
    const parseResult = linkDatasetSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: '입력값이 올바르지 않습니다', details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const { datasetId, weight } = parseResult.data;

    // 데이터셋 존재 및 소유권 확인
    const [dataset] = await db
      .select()
      .from(datasets)
      .where(and(eq(datasets.id, datasetId), eq(datasets.tenantId, tenantId)));

    if (!dataset) {
      return NextResponse.json(
        { error: '데이터셋을 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    // 이미 연결되어 있는지 확인
    const [existing] = await db
      .select()
      .from(chatbotDatasets)
      .where(
        and(
          eq(chatbotDatasets.chatbotId, id),
          eq(chatbotDatasets.datasetId, datasetId)
        )
      );

    if (existing) {
      // 이미 연결되어 있으면 가중치만 업데이트
      await db
        .update(chatbotDatasets)
        .set({ weight })
        .where(eq(chatbotDatasets.id, existing.id));

      return NextResponse.json({
        message: '데이터셋 가중치가 업데이트되었습니다',
        updated: true,
      });
    }

    // 새로 연결
    await db.insert(chatbotDatasets).values({
      chatbotId: id,
      datasetId,
      weight,
    });

    // 콘텐츠 변경 시점 갱신 (페르소나 재생성 필요 여부 판단에 사용)
    await db
      .update(chatbots)
      .set({ contentUpdatedAt: new Date() })
      .where(eq(chatbots.id, id));

    // 데이터셋 연결 시 RAG 인덱스 백그라운드 재생성 트리거
    triggerRagIndexGeneration(id, tenantId);

    return NextResponse.json(
      {
        message: '데이터셋이 연결되었습니다',
        dataset: {
          id: dataset.id,
          name: dataset.name,
          weight,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Chatbot dataset link error:', error);
    return NextResponse.json(
      { error: '데이터셋 연결 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
