/**
 * 관리자 문서 목록 API
 * 전체 테넌트의 문서 조회 및 관리
 */

import { NextRequest, NextResponse } from 'next/server';
import { db, documents, tenants, chunks } from '@/lib/db';
import { eq, desc, sql, count } from 'drizzle-orm';
import { getSession } from '@/lib/auth/session';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  try {
    // 개발 환경에서는 인증 우회 가능
    const isDev = process.env.NODE_ENV === 'development';
    const bypassAuth = request.headers.get('X-Dev-Bypass') === 'true';

    if (!isDev || !bypassAuth) {
      // 관리자 인증 확인
      const session = await getSession();
      if (!session?.isLoggedIn || (session.role !== 'admin' && session.role !== 'internal_operator')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const tenantId = searchParams.get('tenantId');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // 문서 목록 조회 (테넌트 정보 포함)
    let query = db
      .select({
        id: documents.id,
        tenantId: documents.tenantId,
        tenantName: tenants.name,
        filename: documents.filename,
        filePath: documents.filePath,
        fileSize: documents.fileSize,
        fileType: documents.fileType,
        status: documents.status,
        progressStep: documents.progressStep,
        progressPercent: documents.progressPercent,
        errorMessage: documents.errorMessage,
        createdAt: documents.createdAt,
        updatedAt: documents.updatedAt,
      })
      .from(documents)
      .leftJoin(tenants, eq(documents.tenantId, tenants.id))
      .orderBy(desc(documents.createdAt))
      .limit(limit)
      .offset(offset);

    // 필터 적용
    if (status) {
      query = query.where(eq(documents.status, status)) as typeof query;
    }
    if (tenantId) {
      query = query.where(eq(documents.tenantId, tenantId)) as typeof query;
    }

    const docs = await query;

    // 각 문서의 청크 수 조회
    const docsWithChunks = await Promise.all(
      docs.map(async (doc) => {
        const chunkCount = await db
          .select({ count: count() })
          .from(chunks)
          .where(eq(chunks.documentId, doc.id));

        return {
          ...doc,
          chunkCount: chunkCount[0]?.count || 0,
        };
      })
    );

    // 상태별 통계
    const stats = await db
      .select({
        status: documents.status,
        count: count(),
      })
      .from(documents)
      .groupBy(documents.status);

    const statusCounts: Record<string, number> = {};
    for (const stat of stats) {
      if (stat.status) {
        statusCounts[stat.status] = stat.count;
      }
    }

    return NextResponse.json({
      documents: docsWithChunks,
      stats: statusCounts,
      pagination: {
        limit,
        offset,
        total: Object.values(statusCounts).reduce((a, b) => a + b, 0),
      },
    });
  } catch (error) {
    logger.error('Admin documents API error', error as Error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
