'use server';

/**
 * 문서 관리 서버 액션
 * [Week 9] 문서 CRUD
 */

import { validateSession } from '@/lib/auth';
import { db, documents, datasets, chunks } from '@/lib/db';
import { eq, desc, count, sql } from 'drizzle-orm';
import { logger } from '@/lib/logger';
import { revalidatePath } from 'next/cache';

export interface DocumentItem {
  id: string;
  filename: string;
  fileSize: number | null;
  fileType: string | null;
  status: string;
  progressPercent: number | null;
  errorMessage: string | null;
  createdAt: string;
  /** 할당된 데이터셋 이름 (null이면 라이브러리) */
  datasetName: string | null;
  /** 청크 수 */
  chunkCount: number;
}

/**
 * 문서 목록 조회
 */
export async function getDocuments(): Promise<DocumentItem[]> {
  const session = await validateSession();

  if (!session) {
    return [];
  }

  try {
    // 청크 수 서브쿼리
    const chunkCountSubquery = db
      .select({
        documentId: chunks.documentId,
        chunkCount: count().as('chunk_count'),
      })
      .from(chunks)
      .groupBy(chunks.documentId)
      .as('chunk_counts');

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
        datasetName: datasets.name,
        chunkCount: chunkCountSubquery.chunkCount,
      })
      .from(documents)
      .leftJoin(datasets, eq(documents.datasetId, datasets.id))
      .leftJoin(chunkCountSubquery, eq(documents.id, chunkCountSubquery.documentId))
      .where(eq(documents.tenantId, session.tenantId))
      .orderBy(desc(documents.createdAt));

    return docs.map((d) => ({
      id: d.id,
      filename: d.filename,
      fileSize: d.fileSize,
      fileType: d.fileType,
      status: d.status || 'uploaded',
      progressPercent: d.progressPercent,
      errorMessage: d.errorMessage,
      createdAt: d.createdAt?.toISOString() || new Date().toISOString(),
      datasetName: d.datasetName,
      chunkCount: Number(d.chunkCount) || 0,
    }));
  } catch (error) {
    logger.error('Failed to get documents', error as Error, { tenantId: session.tenantId });
    return [];
  }
}

/**
 * 문서 삭제
 */
export async function deleteDocument(documentId: string): Promise<{ success: boolean; error?: string }> {
  const session = await validateSession();

  if (!session) {
    return { success: false, error: '인증이 필요합니다.' };
  }

  try {
    // 문서 소유권 확인
    const doc = await db.query.documents.findFirst({
      where: eq(documents.id, documentId),
      columns: { tenantId: true },
    });

    if (!doc || doc.tenantId !== session.tenantId) {
      return { success: false, error: '문서를 찾을 수 없습니다.' };
    }

    // 삭제 (cascade로 청크도 함께 삭제됨)
    await db.delete(documents).where(eq(documents.id, documentId));

    revalidatePath('/documents');

    logger.info('Document deleted', { documentId, tenantId: session.tenantId });
    return { success: true };
  } catch (error) {
    logger.error('Failed to delete document', error as Error, { documentId });
    return { success: false, error: '삭제 중 오류가 발생했습니다.' };
  }
}

/**
 * 문서 재처리
 */
export async function reprocessDocument(documentId: string): Promise<{ success: boolean; error?: string }> {
  const session = await validateSession();

  if (!session) {
    return { success: false, error: '인증이 필요합니다.' };
  }

  try {
    // 문서 소유권 확인
    const doc = await db.query.documents.findFirst({
      where: eq(documents.id, documentId),
      columns: {
        id: true,
        tenantId: true,
        filename: true,
        fileType: true,
        filePath: true,
        status: true,
      },
    });

    if (!doc || doc.tenantId !== session.tenantId) {
      return { success: false, error: '문서를 찾을 수 없습니다.' };
    }

    // 재처리 가능한 상태 확인
    if (!['uploaded', 'failed'].includes(doc.status || '')) {
      return { success: false, error: '재처리할 수 없는 상태입니다.' };
    }

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
      .where(eq(documents.id, documentId));

    // Inngest 이벤트 발송
    const { inngest } = await import('@/inngest/client');
    await inngest.send({
      name: 'document/uploaded',
      data: {
        documentId: doc.id,
        tenantId: doc.tenantId,
        userId: session.userId,
        filename: doc.filename,
        fileType: doc.fileType || 'unknown',
        filePath: doc.filePath,
      },
    });

    revalidatePath('/documents');

    logger.info('Document reprocess triggered', {
      documentId,
      tenantId: session.tenantId,
      triggeredBy: session.userId,
    });
    return { success: true };
  } catch (error) {
    logger.error('Failed to reprocess document', error as Error, { documentId });
    return { success: false, error: '재처리 요청 중 오류가 발생했습니다.' };
  }
}

/**
 * 문서 상태 새로고침 (폴링용)
 */
export async function refreshDocumentStatus(documentId: string): Promise<{
  status: string;
  progressPercent: number | null;
  errorMessage: string | null;
} | null> {
  const session = await validateSession();

  if (!session) {
    return null;
  }

  try {
    const doc = await db.query.documents.findFirst({
      where: eq(documents.id, documentId),
      columns: {
        status: true,
        progressPercent: true,
        errorMessage: true,
        tenantId: true,
      },
    });

    if (!doc || doc.tenantId !== session.tenantId) {
      return null;
    }

    return {
      status: doc.status || 'uploaded',
      progressPercent: doc.progressPercent,
      errorMessage: doc.errorMessage,
    };
  } catch (error) {
    logger.error('Failed to refresh document status', error as Error, { documentId });
    return null;
  }
}
