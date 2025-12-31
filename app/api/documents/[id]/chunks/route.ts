/**
 * 문서별 청크 조회 API
 *
 * GET /api/documents/:id/chunks - 문서의 청크 목록 조회
 */

import { NextRequest, NextResponse } from 'next/server';
import { eq, and, asc } from 'drizzle-orm';
import { db } from '@/lib/db';
import { documents, chunks } from '@/drizzle/schema';
import { validateSession } from '@/lib/auth/session';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/documents/:id/chunks - 문서의 청크 목록 조회
 *
 * Query Parameters:
 * - includeInactive: boolean (default: false) - 비활성 청크 포함 여부
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await validateSession();
    if (!session) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 });
    }

    const { id: documentId } = await params;
    const tenantId = session.tenantId;

    // 쿼리 파라미터 파싱
    const { searchParams } = new URL(request.url);
    const includeInactive = searchParams.get('includeInactive') === 'true';

    // 문서 존재 및 권한 확인
    const [doc] = await db
      .select({ id: documents.id })
      .from(documents)
      .where(and(eq(documents.id, documentId), eq(documents.tenantId, tenantId)));

    if (!doc) {
      return NextResponse.json({ error: '문서를 찾을 수 없습니다' }, { status: 404 });
    }

    // 청크 목록 조회
    const conditions = [eq(chunks.documentId, documentId), eq(chunks.tenantId, tenantId)];

    if (!includeInactive) {
      conditions.push(eq(chunks.isActive, true));
    }

    const chunkList = await db
      .select({
        id: chunks.id,
        content: chunks.content,
        chunkIndex: chunks.chunkIndex,
        qualityScore: chunks.qualityScore,
        status: chunks.status,
        isActive: chunks.isActive,
        autoApproved: chunks.autoApproved,
        metadata: chunks.metadata,
        createdAt: chunks.createdAt,
        updatedAt: chunks.updatedAt,
      })
      .from(chunks)
      .where(and(...conditions))
      .orderBy(asc(chunks.chunkIndex));

    // 응답 데이터 포맷팅
    const formattedChunks = chunkList.map((chunk) => ({
      id: chunk.id,
      content: chunk.content,
      preview: chunk.content.length > 200 ? chunk.content.substring(0, 200) + '...' : chunk.content,
      chunkIndex: chunk.chunkIndex,
      qualityScore: chunk.qualityScore,
      status: chunk.status || 'pending',
      isActive: chunk.isActive ?? true,
      autoApproved: chunk.autoApproved || false,
      metadata: chunk.metadata,
      createdAt: chunk.createdAt?.toISOString() || new Date().toISOString(),
      updatedAt: chunk.updatedAt?.toISOString() || new Date().toISOString(),
    }));

    // 통계 정보
    const stats = {
      total: chunkList.length,
      active: chunkList.filter((c) => c.isActive !== false).length,
      inactive: chunkList.filter((c) => c.isActive === false).length,
    };

    return NextResponse.json({
      chunks: formattedChunks,
      stats,
    });
  } catch (error) {
    console.error('Document chunks fetch error:', error);
    return NextResponse.json({ error: '청크 목록 조회 중 오류가 발생했습니다' }, { status: 500 });
  }
}
