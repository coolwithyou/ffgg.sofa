/**
 * 라이브러리 문서 API
 *
 * GET /api/library/documents - 라이브러리 문서 목록 조회 (datasetId가 null인 문서)
 */

import { NextRequest, NextResponse } from 'next/server';
import { eq, and, desc, isNull, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { documents, chunks } from '@/drizzle/schema';
import { validateSession } from '@/lib/auth/session';

/**
 * GET /api/library/documents - 라이브러리 문서 목록 조회
 *
 * 라이브러리는 datasetId가 null인 문서들의 가상 집합입니다.
 * 이 문서들은 아직 어떤 데이터셋에도 배치되지 않은 상태입니다.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await validateSession();
    if (!session) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 });
    }

    const tenantId = session.tenantId;

    // URL 파라미터 파싱
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const status = searchParams.get('status'); // all, uploaded, processing, chunked, approved, failed

    // 페이지네이션 계산
    const offset = (page - 1) * limit;

    // 조건 구성: 테넌트 소유 + datasetId가 null (라이브러리)
    const conditions = [eq(documents.tenantId, tenantId), isNull(documents.datasetId)];

    if (status && status !== 'all') {
      conditions.push(eq(documents.status, status));
    }

    // 전체 카운트 조회
    const [totalResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(documents)
      .where(and(...conditions));

    const total = totalResult?.count || 0;

    // 문서 목록 조회
    const docs = await db
      .select({
        id: documents.id,
        filename: documents.filename,
        fileSize: documents.fileSize,
        fileType: documents.fileType,
        status: documents.status,
        progressPercent: documents.progressPercent,
        errorMessage: documents.errorMessage,
        metadata: documents.metadata,
        createdAt: documents.createdAt,
        updatedAt: documents.updatedAt,
      })
      .from(documents)
      .where(and(...conditions))
      .orderBy(desc(documents.createdAt))
      .limit(limit)
      .offset(offset);

    // 각 문서의 청크 통계 조회
    const docsWithStats = await Promise.all(
      docs.map(async (doc) => {
        const [chunkStats] = await db
          .select({
            count: sql<number>`count(*)::int`,
            approvedCount: sql<number>`count(*) FILTER (WHERE status = 'approved')::int`,
            pendingCount: sql<number>`count(*) FILTER (WHERE status = 'pending')::int`,
          })
          .from(chunks)
          .where(eq(chunks.documentId, doc.id));

        return {
          id: doc.id,
          filename: doc.filename,
          fileSize: doc.fileSize,
          fileType: doc.fileType,
          status: doc.status || 'uploaded',
          chunkCount: chunkStats?.count || 0,
          approvedCount: chunkStats?.approvedCount || 0,
          pendingCount: chunkStats?.pendingCount || 0,
          progressPercent: doc.progressPercent,
          errorMessage: doc.errorMessage,
          metadata: doc.metadata,
          createdAt: doc.createdAt?.toISOString() || new Date().toISOString(),
          updatedAt: doc.updatedAt?.toISOString() || new Date().toISOString(),
        };
      })
    );

    return NextResponse.json({
      documents: docsWithStats,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Library documents get error:', error);
    return NextResponse.json({ error: '라이브러리 문서 목록 조회 중 오류가 발생했습니다' }, { status: 500 });
  }
}
