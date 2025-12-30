/**
 * 청크 복사 API
 *
 * POST /api/datasets/:id/chunks/copy - 청크를 대상 데이터셋으로 복사
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { eq, and, inArray, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { datasets, chunks } from '@/drizzle/schema';
import { validateSession } from '@/lib/auth/session';
import { createAuditLogFromRequest, AuditAction, TargetType } from '@/lib/audit';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// 요청 스키마
const copyChunksSchema = z.object({
  chunkIds: z.array(z.string().uuid()).min(1, '최소 1개의 청크를 선택해주세요'),
});

/**
 * POST /api/datasets/:id/chunks/copy - 청크를 데이터셋으로 복사
 *
 * 라이브러리 또는 다른 데이터셋의 청크를 대상 데이터셋으로 복사합니다.
 * - 원본 청크는 그대로 유지됩니다.
 * - 복사된 청크의 sourceChunkId에 원본 청크 ID가 저장됩니다.
 * - 임베딩 벡터도 함께 복사되므로 재계산이 불필요합니다.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await validateSession();
    if (!session) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 });
    }

    const { id: targetDatasetId } = await params;
    const tenantId = session.tenantId;

    // 대상 데이터셋 존재 및 권한 확인
    const [targetDataset] = await db
      .select({ id: datasets.id, name: datasets.name })
      .from(datasets)
      .where(and(eq(datasets.id, targetDatasetId), eq(datasets.tenantId, tenantId)));

    if (!targetDataset) {
      return NextResponse.json({ error: '데이터셋을 찾을 수 없습니다' }, { status: 404 });
    }

    // 요청 본문 파싱
    const body = await request.json();
    const parseResult = copyChunksSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: '입력값이 올바르지 않습니다', details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const { chunkIds } = parseResult.data;

    // 원본 청크 조회 (테넌트 소유 확인)
    const sourceChunks = await db
      .select()
      .from(chunks)
      .where(and(inArray(chunks.id, chunkIds), eq(chunks.tenantId, tenantId)));

    if (sourceChunks.length === 0) {
      return NextResponse.json({ error: '유효한 청크를 찾을 수 없습니다' }, { status: 400 });
    }

    // 이미 대상 데이터셋에 있는 청크 필터링
    const chunksToProcess = sourceChunks.filter((chunk) => chunk.datasetId !== targetDatasetId);

    if (chunksToProcess.length === 0) {
      return NextResponse.json(
        { error: '모든 청크가 이미 해당 데이터셋에 있습니다' },
        { status: 400 }
      );
    }

    // 청크 복사 실행
    const copiedChunks: { originalId: string; newId: string }[] = [];

    for (const chunk of chunksToProcess) {
      const [newChunk] = await db
        .insert(chunks)
        .values({
          tenantId: chunk.tenantId,
          documentId: chunk.documentId,
          datasetId: targetDatasetId,
          sourceChunkId: chunk.id, // 원본 청크 ID 저장
          content: chunk.content,
          embedding: chunk.embedding,
          contentTsv: chunk.contentTsv,
          chunkIndex: chunk.chunkIndex,
          qualityScore: chunk.qualityScore,
          status: chunk.status,
          autoApproved: chunk.autoApproved,
          version: 1,
          isActive: true,
          metadata: {
            ...(typeof chunk.metadata === 'object' ? chunk.metadata : {}),
            copiedFrom: chunk.id,
            copiedAt: new Date().toISOString(),
          },
        })
        .returning({ id: chunks.id });

      copiedChunks.push({
        originalId: chunk.id,
        newId: newChunk.id,
      });
    }

    // 데이터셋 통계 업데이트
    await db
      .update(datasets)
      .set({
        chunkCount: sql`${datasets.chunkCount} + ${copiedChunks.length}`,
        updatedAt: new Date(),
      })
      .where(eq(datasets.id, targetDatasetId));

    // 감사 로그 기록
    await createAuditLogFromRequest(request, {
      userId: session.userId,
      tenantId,
      action: AuditAction.CHUNK_MODIFY,
      targetType: TargetType.CHUNK,
      targetId: targetDatasetId,
      result: 'success',
      details: {
        action: 'copy_chunks',
        sourceChunkIds: chunkIds,
        copiedCount: copiedChunks.length,
        skippedCount: sourceChunks.length - chunksToProcess.length,
      },
    });

    return NextResponse.json({
      success: true,
      message: `${copiedChunks.length}개의 청크가 복사되었습니다`,
      copiedChunks,
      stats: {
        requested: chunkIds.length,
        found: sourceChunks.length,
        copied: copiedChunks.length,
        skipped: sourceChunks.length - chunksToProcess.length,
      },
    });
  } catch (error) {
    console.error('Chunk copy error:', error);
    return NextResponse.json({ error: '청크 복사 중 오류가 발생했습니다' }, { status: 500 });
  }
}
