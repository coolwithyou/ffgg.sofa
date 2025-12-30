/**
 * 데이터셋 문서 API
 *
 * GET /api/datasets/:id/documents - 데이터셋의 문서 목록 조회
 */

import { NextRequest, NextResponse } from 'next/server';
import { eq, and, desc, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { datasets, documents, chunks } from '@/drizzle/schema';
import { validateSession } from '@/lib/auth/session';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/datasets/:id/documents - 데이터셋의 문서 목록 조회
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await validateSession();
    if (!session) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 });
    }

    const { id: datasetId } = await params;
    const tenantId = session.tenantId;

    // 데이터셋 존재 및 권한 확인
    const [dataset] = await db
      .select({ id: datasets.id })
      .from(datasets)
      .where(and(eq(datasets.id, datasetId), eq(datasets.tenantId, tenantId)));

    if (!dataset) {
      return NextResponse.json(
        { error: '데이터셋을 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    // 문서 목록 조회 with 청크 통계
    const docs = await db
      .select({
        id: documents.id,
        filename: documents.filename,
        fileSize: documents.fileSize,
        fileType: documents.fileType,
        status: documents.status,
        progressPercent: documents.progressPercent,
        errorMessage: documents.errorMessage,
        createdAt: documents.createdAt,
      })
      .from(documents)
      .where(eq(documents.datasetId, datasetId))
      .orderBy(desc(documents.createdAt));

    // 각 문서의 청크 통계 조회
    const docsWithStats = await Promise.all(
      docs.map(async (doc) => {
        const [chunkStats] = await db
          .select({
            count: sql<number>`count(*)::int`,
            approvedCount: sql<number>`count(*) FILTER (WHERE status = 'approved')::int`,
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
          progressPercent: doc.progressPercent,
          errorMessage: doc.errorMessage,
          createdAt: doc.createdAt?.toISOString() || new Date().toISOString(),
        };
      })
    );

    return NextResponse.json({
      documents: docsWithStats,
    });
  } catch (error) {
    console.error('Dataset documents get error:', error);
    return NextResponse.json(
      { error: '문서 목록 조회 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
