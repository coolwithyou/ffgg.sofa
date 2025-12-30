/**
 * 데이터셋 상세 API
 *
 * GET /api/datasets/:id - 데이터셋 상세 조회
 * PATCH /api/datasets/:id - 데이터셋 수정
 * DELETE /api/datasets/:id - 데이터셋 삭제
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { eq, and, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { datasets, documents, chunks, chatbotDatasets } from '@/drizzle/schema';
import { validateSession } from '@/lib/auth/session';

// 데이터셋 수정 스키마
const updateDatasetSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  status: z.enum(['active', 'archived']).optional(),
  isDefault: z.boolean().optional(),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/datasets/:id - 데이터셋 상세 조회
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await validateSession();
    if (!session) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 });
    }

    const { id } = await params;
    const tenantId = session.tenantId;

    // 데이터셋 조회
    const [dataset] = await db
      .select()
      .from(datasets)
      .where(and(eq(datasets.id, id), eq(datasets.tenantId, tenantId)));

    if (!dataset) {
      return NextResponse.json(
        { error: '데이터셋을 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    // 실시간 통계 조회
    const [docStats] = await db
      .select({
        count: sql<number>`count(*)::int`,
        totalSize: sql<number>`COALESCE(SUM(file_size), 0)::bigint`,
      })
      .from(documents)
      .where(eq(documents.datasetId, id));

    const [chunkStats] = await db
      .select({
        count: sql<number>`count(*)::int`,
        approvedCount: sql<number>`count(*) FILTER (WHERE status = 'approved')::int`,
      })
      .from(chunks)
      .where(eq(chunks.datasetId, id));

    // 연결된 챗봇 수
    const [chatbotCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(chatbotDatasets)
      .where(eq(chatbotDatasets.datasetId, id));

    return NextResponse.json({
      dataset: {
        ...dataset,
        stats: {
          documentCount: docStats?.count || 0,
          totalStorageBytes: Number(docStats?.totalSize) || 0,
          chunkCount: chunkStats?.count || 0,
          approvedChunkCount: chunkStats?.approvedCount || 0,
          connectedChatbots: chatbotCount?.count || 0,
        },
      },
    });
  } catch (error) {
    console.error('Dataset get error:', error);
    return NextResponse.json(
      { error: '데이터셋 조회 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/datasets/:id - 데이터셋 수정
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await validateSession();
    if (!session) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 });
    }

    const { id } = await params;
    const tenantId = session.tenantId;

    // 데이터셋 존재 확인
    const [existingDataset] = await db
      .select()
      .from(datasets)
      .where(and(eq(datasets.id, id), eq(datasets.tenantId, tenantId)));

    if (!existingDataset) {
      return NextResponse.json(
        { error: '데이터셋을 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    // 요청 본문 파싱
    const body = await request.json();
    const parseResult = updateDatasetSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: '입력값이 올바르지 않습니다', details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const updateData = parseResult.data;

    // 기본 데이터셋은 삭제(archived)할 수 없음
    if (existingDataset.isDefault && updateData.status === 'archived') {
      return NextResponse.json(
        { error: '기본 데이터셋은 보관할 수 없습니다' },
        { status: 400 }
      );
    }

    // 기본 데이터셋 변경 시 기존 기본 데이터셋의 isDefault를 false로 설정
    if (updateData.isDefault === true && !existingDataset.isDefault) {
      await db
        .update(datasets)
        .set({ isDefault: false, updatedAt: new Date() })
        .where(and(eq(datasets.tenantId, tenantId), eq(datasets.isDefault, true)));
    }

    // 기본 데이터셋을 해제하려는 경우 방지
    if (updateData.isDefault === false && existingDataset.isDefault) {
      return NextResponse.json(
        { error: '기본 데이터셋은 다른 데이터셋을 기본으로 설정하여 변경할 수 있습니다' },
        { status: 400 }
      );
    }

    // 데이터셋 수정
    const [updatedDataset] = await db
      .update(datasets)
      .set({
        ...updateData,
        updatedAt: new Date(),
      })
      .where(eq(datasets.id, id))
      .returning();

    return NextResponse.json({
      message: '데이터셋이 수정되었습니다',
      dataset: updatedDataset,
    });
  } catch (error) {
    console.error('Dataset update error:', error);
    return NextResponse.json(
      { error: '데이터셋 수정 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/datasets/:id - 데이터셋 삭제
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await validateSession();
    if (!session) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 });
    }

    const { id } = await params;
    const tenantId = session.tenantId;

    // 데이터셋 존재 확인
    const [existingDataset] = await db
      .select()
      .from(datasets)
      .where(and(eq(datasets.id, id), eq(datasets.tenantId, tenantId)));

    if (!existingDataset) {
      return NextResponse.json(
        { error: '데이터셋을 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    // 기본 데이터셋은 삭제할 수 없음
    if (existingDataset.isDefault) {
      return NextResponse.json(
        { error: '기본 데이터셋은 삭제할 수 없습니다' },
        { status: 400 }
      );
    }

    // 데이터셋 삭제 (CASCADE로 documents, chunks, chatbot_datasets도 함께 삭제)
    await db.delete(datasets).where(eq(datasets.id, id));

    return NextResponse.json({
      message: '데이터셋이 삭제되었습니다',
    });
  } catch (error) {
    console.error('Dataset delete error:', error);
    return NextResponse.json(
      { error: '데이터셋 삭제 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
