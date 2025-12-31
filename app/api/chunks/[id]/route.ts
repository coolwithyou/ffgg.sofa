/**
 * 청크 관리 API
 *
 * PATCH /api/chunks/:id - 청크 활성화/비활성화
 * DELETE /api/chunks/:id - 청크 완전 삭제
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { eq, and, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { chunks, datasets } from '@/drizzle/schema';
import { validateSession } from '@/lib/auth/session';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// PATCH 요청 스키마
const patchChunkSchema = z.object({
  isActive: z.boolean(),
});

/**
 * PATCH /api/chunks/:id - 청크 활성화/비활성화
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await validateSession();
    if (!session) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 });
    }

    const { id: chunkId } = await params;
    const tenantId = session.tenantId;

    // 청크 조회 및 권한 확인
    const [chunk] = await db
      .select({
        id: chunks.id,
        datasetId: chunks.datasetId,
        isActive: chunks.isActive,
      })
      .from(chunks)
      .where(and(eq(chunks.id, chunkId), eq(chunks.tenantId, tenantId)));

    if (!chunk) {
      return NextResponse.json({ error: '청크를 찾을 수 없습니다' }, { status: 404 });
    }

    // 요청 본문 파싱
    const body = await request.json();
    const parseResult = patchChunkSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: '입력값이 올바르지 않습니다', details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const { isActive } = parseResult.data;

    // 이미 같은 상태면 무시
    if (chunk.isActive === isActive) {
      return NextResponse.json({
        success: true,
        message: isActive ? '이미 활성화된 청크입니다' : '이미 비활성화된 청크입니다',
      });
    }

    // 청크 상태 업데이트
    await db
      .update(chunks)
      .set({ isActive, updatedAt: new Date() })
      .where(eq(chunks.id, chunkId));

    // 데이터셋 통계는 실제 활성 청크만 카운트하므로 별도 업데이트 불필요
    // (검색 시 isActive=true 조건으로 필터링)

    return NextResponse.json({
      success: true,
      message: isActive ? '청크가 활성화되었습니다' : '청크가 비활성화되었습니다',
      isActive,
    });
  } catch (error) {
    console.error('Chunk patch error:', error);
    return NextResponse.json({ error: '청크 상태 변경 중 오류가 발생했습니다' }, { status: 500 });
  }
}

/**
 * DELETE /api/chunks/:id - 청크 완전 삭제
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await validateSession();
    if (!session) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 });
    }

    const { id: chunkId } = await params;
    const tenantId = session.tenantId;

    // 청크 조회 및 권한 확인
    const [chunk] = await db
      .select({
        id: chunks.id,
        datasetId: chunks.datasetId,
      })
      .from(chunks)
      .where(and(eq(chunks.id, chunkId), eq(chunks.tenantId, tenantId)));

    if (!chunk) {
      return NextResponse.json({ error: '청크를 찾을 수 없습니다' }, { status: 404 });
    }

    // 청크 삭제
    await db.delete(chunks).where(eq(chunks.id, chunkId));

    // 데이터셋 통계 업데이트 (chunkCount 감소)
    if (chunk.datasetId) {
      await db
        .update(datasets)
        .set({
          chunkCount: sql`GREATEST(${datasets.chunkCount} - 1, 0)`,
          updatedAt: new Date(),
        })
        .where(eq(datasets.id, chunk.datasetId));
    }

    return NextResponse.json({
      success: true,
      message: '청크가 삭제되었습니다',
    });
  } catch (error) {
    console.error('Chunk delete error:', error);
    return NextResponse.json({ error: '청크 삭제 중 오류가 발생했습니다' }, { status: 500 });
  }
}
