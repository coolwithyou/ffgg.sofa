/**
 * 문서 재처리 API
 * 관리자가 미처리/실패 문서를 재처리 트리거
 */

import { NextRequest, NextResponse } from 'next/server';
import { db, documents } from '@/lib/db';
import { eq, inArray } from 'drizzle-orm';
import { inngest } from '@/inngest/client';
import { getSession } from '@/lib/auth/session';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    // 개발 환경에서는 인증 우회 가능
    const isDev = process.env.NODE_ENV === 'development';
    const bypassAuth = request.headers.get('X-Dev-Bypass') === 'true';

    let sessionUserId = 'dev-user';
    let sessionEmail = 'dev@example.com';

    if (!isDev || !bypassAuth) {
      // 관리자 인증 확인
      const session = await getSession();
      if (!session?.isLoggedIn || (session.role !== 'admin' && session.role !== 'internal_operator')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      sessionUserId = session.userId;
      sessionEmail = session.email || 'unknown';
    }

    const body = await request.json();
    const { documentIds, reprocessAll } = body as {
      documentIds?: string[];
      reprocessAll?: boolean;
    };

    let targetDocuments;

    if (reprocessAll) {
      // 모든 미처리 문서 조회
      targetDocuments = await db
        .select()
        .from(documents)
        .where(inArray(documents.status, ['uploaded', 'failed', 'processing']));
    } else if (documentIds && documentIds.length > 0) {
      // 특정 문서만 조회
      targetDocuments = await db
        .select()
        .from(documents)
        .where(inArray(documents.id, documentIds));
    } else {
      return NextResponse.json(
        { error: 'documentIds or reprocessAll required' },
        { status: 400 }
      );
    }

    if (targetDocuments.length === 0) {
      return NextResponse.json({
        success: true,
        message: '재처리할 문서가 없습니다.',
        processed: 0,
      });
    }

    const results: { id: string; filename: string; success: boolean; error?: string }[] = [];

    for (const doc of targetDocuments) {
      try {
        // 문서 상태 리셋
        await db
          .update(documents)
          .set({
            status: 'uploaded',
            progressStep: null,
            progressPercent: 0,
            errorMessage: null,
            updatedAt: new Date(),
          })
          .where(eq(documents.id, doc.id));

        // Inngest 이벤트 발송
        await inngest.send({
          name: 'document/uploaded',
          data: {
            documentId: doc.id,
            tenantId: doc.tenantId,
            userId: sessionUserId,
            filename: doc.filename,
            fileType: doc.fileType || 'unknown',
            filePath: doc.filePath,
          },
        });

        results.push({ id: doc.id, filename: doc.filename, success: true });

        logger.info('Document reprocess triggered', {
          documentId: doc.id,
          triggeredBy: sessionEmail,
        });
      } catch (error) {
        results.push({
          id: doc.id,
          filename: doc.filename,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    const successCount = results.filter((r) => r.success).length;
    const failCount = results.filter((r) => !r.success).length;

    return NextResponse.json({
      success: true,
      message: `${successCount}개 문서 재처리 시작${failCount > 0 ? `, ${failCount}개 실패` : ''}`,
      processed: successCount,
      failed: failCount,
      results,
    });
  } catch (error) {
    logger.error('Document reprocess API error', error as Error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
