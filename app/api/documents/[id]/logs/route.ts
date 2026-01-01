/**
 * 문서 처리 로그 조회 API
 * 포털: 자신의 테넌트 문서만 / 관리자: 모든 문서
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { db, documents, documentProcessingLogs, chunks } from '@/lib/db';
import { eq, desc, and, sql } from 'drizzle-orm';
import { logger } from '@/lib/logger';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session?.isLoggedIn) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: documentId } = await params;

    // 문서 조회 (소유권 확인)
    const doc = await db.query.documents.findFirst({
      where: eq(documents.id, documentId),
      columns: {
        id: true,
        tenantId: true,
        filename: true,
        status: true,
        progressStep: true,
        progressPercent: true,
        errorMessage: true,
        updatedAt: true,
      },
    });

    if (!doc) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    // 관리자가 아니면 자신의 테넌트 문서만 조회 가능
    const isAdmin = session.role === 'admin' || session.role === 'internal_operator';
    if (!isAdmin && doc.tenantId !== session.tenantId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // 처리 로그 조회
    const logs = await db
      .select({
        id: documentProcessingLogs.id,
        step: documentProcessingLogs.step,
        status: documentProcessingLogs.status,
        message: documentProcessingLogs.message,
        details: documentProcessingLogs.details,
        errorMessage: documentProcessingLogs.errorMessage,
        durationMs: documentProcessingLogs.durationMs,
        createdAt: documentProcessingLogs.createdAt,
      })
      .from(documentProcessingLogs)
      .where(eq(documentProcessingLogs.documentId, documentId))
      .orderBy(documentProcessingLogs.createdAt); // 오래된 순 (시간순)

    // 청크 수 조회
    const chunkCountResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(chunks)
      .where(eq(chunks.documentId, documentId));

    const chunkCount = chunkCountResult[0]?.count ?? 0;

    return NextResponse.json({
      document: {
        id: doc.id,
        filename: doc.filename,
        status: doc.status,
        progressStep: doc.progressStep,
        progressPercent: doc.progressPercent,
        errorMessage: doc.errorMessage,
        updatedAt: doc.updatedAt?.toISOString() || null,
        chunkCount,
      },
      logs: logs.map((log) => ({
        id: log.id,
        step: log.step,
        status: log.status,
        message: log.message,
        details: log.details || {},
        errorMessage: log.errorMessage,
        durationMs: log.durationMs,
        createdAt: log.createdAt?.toISOString(),
      })),
    });
  } catch (error) {
    logger.error('Document logs API error', error as Error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
