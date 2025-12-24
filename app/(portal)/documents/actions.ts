'use server';

/**
 * 문서 관리 서버 액션
 * [Week 9] 문서 CRUD
 */

import { validateSession } from '@/lib/auth';
import { db, documents } from '@/lib/db';
import { eq, desc } from 'drizzle-orm';
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
