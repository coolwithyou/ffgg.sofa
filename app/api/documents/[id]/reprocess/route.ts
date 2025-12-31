/**
 * 문서 재처리 API
 * 실패하거나 대기 중인 문서를 다시 처리합니다.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { db, documents } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { inngest } from '@/inngest/client';
import { logger } from '@/lib/logger';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session?.isLoggedIn) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: documentId } = await params;

    // 문서 조회
    const doc = await db.query.documents.findFirst({
      where: eq(documents.id, documentId),
    });

    if (!doc) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    // 관리자가 아니면 자신의 테넌트 문서만 재처리 가능
    const isAdmin = session.role === 'admin' || session.role === 'internal_operator';
    if (!isAdmin && doc.tenantId !== session.tenantId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // 이미 처리 중인 문서는 재처리 불가
    if (doc.status === 'processing') {
      return NextResponse.json(
        { error: '이미 처리 중인 문서입니다' },
        { status: 400 }
      );
    }

    // 문서 상태를 uploaded로 리셋
    await db
      .update(documents)
      .set({
        status: 'uploaded',
        progressStep: null,
        progressPercent: 0,
        errorMessage: null,
        updatedAt: new Date(),
      })
      .where(eq(documents.id, documentId));

    // Inngest 이벤트 발송
    await inngest.send({
      name: 'document/uploaded',
      data: {
        documentId: doc.id,
        tenantId: doc.tenantId,
        datasetId: doc.datasetId, // 데이터셋 연결 유지
        userId: session.userId,
        filename: doc.filename,
        fileType: doc.fileType || 'unknown',
        filePath: doc.filePath,
      },
    });

    logger.info('Document reprocess initiated', {
      documentId,
      userId: session.userId,
      tenantId: doc.tenantId,
    });

    return NextResponse.json({
      success: true,
      message: '문서 재처리가 시작되었습니다',
      document: {
        id: doc.id,
        filename: doc.filename,
        status: 'uploaded',
      },
    });
  } catch (error) {
    logger.error('Document reprocess API error', error as Error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
