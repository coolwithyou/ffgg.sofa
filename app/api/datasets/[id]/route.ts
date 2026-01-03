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
import { triggerRagIndexGeneration } from '@/lib/chat/rag-index-generator';
import { logger } from '@/lib/logger';

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
        pendingCount: sql<number>`count(*) FILTER (WHERE status = 'pending')::int`,
        rejectedCount: sql<number>`count(*) FILTER (WHERE status = 'rejected')::int`,
        modifiedCount: sql<number>`count(*) FILTER (WHERE status = 'modified')::int`,
      })
      .from(chunks)
      .where(eq(chunks.datasetId, id));

    // 연결된 챗봇 수
    const [chatbotCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(chatbotDatasets)
      .where(eq(chatbotDatasets.datasetId, id));

    // v2: 확장 통계 - 검색 가능 상태
    const [searchabilityStats] = await db
      .select({
        denseReady: sql<number>`count(*) FILTER (WHERE embedding IS NOT NULL)::int`,
        sparseReady: sql<number>`count(*) FILTER (WHERE content_tsv IS NOT NULL)::int`,
        hybridReady: sql<number>`count(*) FILTER (WHERE embedding IS NOT NULL AND content_tsv IS NOT NULL)::int`,
        notSearchable: sql<number>`count(*) FILTER (WHERE embedding IS NULL AND content_tsv IS NULL)::int`,
      })
      .from(chunks)
      .where(eq(chunks.datasetId, id));

    // v2: 품질 분포
    const [qualityDistribution] = await db
      .select({
        excellent: sql<number>`count(*) FILTER (WHERE quality_score >= 80)::int`,
        good: sql<number>`count(*) FILTER (WHERE quality_score >= 60 AND quality_score < 80)::int`,
        fair: sql<number>`count(*) FILTER (WHERE quality_score >= 40 AND quality_score < 60)::int`,
        poor: sql<number>`count(*) FILTER (WHERE quality_score < 40)::int`,
        unscored: sql<number>`count(*) FILTER (WHERE quality_score IS NULL)::int`,
      })
      .from(chunks)
      .where(eq(chunks.datasetId, id));

    // v2: 데이터 무결성 이슈
    const [integrityStats] = await db
      .select({
        emptyContent: sql<number>`count(*) FILTER (WHERE LENGTH(content) = 0)::int`,
        missingEmbedding: sql<number>`count(*) FILTER (WHERE embedding IS NULL AND status = 'approved')::int`,
      })
      .from(chunks)
      .where(eq(chunks.datasetId, id));

    // v2: datasetId 불일치 청크 (문서는 이 데이터셋에 속하지만 청크의 datasetId가 null이거나 다른 경우)
    // 이 청크들은 검색에서 완전히 제외됨
    const orphanedChunksResult = await db.execute(sql`
      SELECT COUNT(*)::int as count
      FROM chunks c
      INNER JOIN documents d ON c.document_id = d.id
      WHERE d.dataset_id = ${id}
      AND (c.dataset_id IS NULL OR c.dataset_id != ${id})
    `);
    const missingDatasetId = (orphanedChunksResult.rows[0] as any)?.count || 0;

    // v2: 평균 청크 크기 및 토큰 수
    const [sizeStats] = await db
      .select({
        avgContentLength: sql<number>`COALESCE(AVG(LENGTH(content)), 0)::int`,
        avgTokens: sql<number>`COALESCE(AVG(
          CASE
            WHEN content ~ '[가-힣ㄱ-ㅎㅏ-ㅣ]' THEN LENGTH(content) / 2.5
            ELSE LENGTH(content) / 4
          END
        ), 0)::int`,
      })
      .from(chunks)
      .where(eq(chunks.datasetId, id));

    return NextResponse.json({
      dataset: {
        ...dataset,
        stats: {
          documentCount: docStats?.count || 0,
          totalStorageBytes: Number(docStats?.totalSize) || 0,
          chunkCount: chunkStats?.count || 0,
          approvedChunkCount: chunkStats?.approvedCount || 0,
          pendingChunkCount: chunkStats?.pendingCount || 0,
          rejectedChunkCount: chunkStats?.rejectedCount || 0,
          modifiedChunkCount: chunkStats?.modifiedCount || 0,
          connectedChatbots: chatbotCount?.count || 0,
        },
        // v2: 확장 통계
        extendedStats: {
          searchability: {
            denseReady: searchabilityStats?.denseReady || 0,
            sparseReady: searchabilityStats?.sparseReady || 0,
            hybridReady: searchabilityStats?.hybridReady || 0,
            notSearchable: searchabilityStats?.notSearchable || 0,
          },
          quality: {
            excellent: qualityDistribution?.excellent || 0,
            good: qualityDistribution?.good || 0,
            fair: qualityDistribution?.fair || 0,
            poor: qualityDistribution?.poor || 0,
            unscored: qualityDistribution?.unscored || 0,
          },
          integrity: {
            emptyContent: integrityStats?.emptyContent || 0,
            missingEmbedding: integrityStats?.missingEmbedding || 0,
            missingDatasetId, // 검색에서 제외되는 청크 (datasetId 누락/불일치)
            duplicateContent: 0, // 중복 체크는 비용이 높아 on-demand 처리
            unscored: qualityDistribution?.unscored || 0,
          },
          averageChunkSize: sizeStats?.avgContentLength || 0,
          averageTokenCount: sizeStats?.avgTokens || 0,
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
 *
 * 삭제 후 연결되어 있던 챗봇들의 RAG 인덱스 재생성을 트리거합니다.
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

    // 삭제 전에 연결된 챗봇 목록 조회 (cascade 삭제 전에 저장)
    const connections = await db
      .select({ chatbotId: chatbotDatasets.chatbotId })
      .from(chatbotDatasets)
      .where(eq(chatbotDatasets.datasetId, id));
    const connectedChatbotIds = connections.map((c) => c.chatbotId);

    // 데이터셋 삭제 (CASCADE로 documents, chunks, chatbot_datasets도 함께 삭제)
    await db.delete(datasets).where(eq(datasets.id, id));

    logger.info('Dataset deleted via API', {
      datasetId: id,
      datasetName: existingDataset.name,
      tenantId,
      connectedChatbots: connectedChatbotIds.length,
    });

    // 연결되어 있던 챗봇들의 RAG 인덱스 재생성 트리거 (fire-and-forget)
    for (const chatbotId of connectedChatbotIds) {
      triggerRagIndexGeneration(chatbotId, tenantId).catch((error) => {
        logger.error('Failed to trigger RAG regeneration after dataset delete', error, {
          chatbotId,
          datasetId: id,
        });
      });
    }

    return NextResponse.json({
      message: '데이터셋이 삭제되었습니다',
      triggeredRagRegeneration: connectedChatbotIds.length > 0,
    });
  } catch (error) {
    console.error('Dataset delete error:', error);
    return NextResponse.json(
      { error: '데이터셋 삭제 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
