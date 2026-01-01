'use server';

/**
 * 문서 관리 서버 액션
 * [Week 9] 문서 CRUD
 */

import { validateSession } from '@/lib/auth';
import { db, documents, datasets, chunks } from '@/lib/db';
import { eq, desc, count, sql, inArray } from 'drizzle-orm';
import { logger } from '@/lib/logger';
import { revalidatePath } from 'next/cache';
import { canReprocessDocument } from '@/lib/constants/document';

export interface DocumentItem {
  id: string;
  filename: string;
  fileSize: number | null;
  fileType: string | null;
  status: string;
  progressPercent: number | null;
  errorMessage: string | null;
  createdAt: string;
  /** 마지막 업데이트 시각 (stalled 판단용) */
  updatedAt: string | null;
  /** 할당된 데이터셋 이름 (null이면 라이브러리) */
  datasetName: string | null;
  /** 청크 수 */
  chunkCount: number;
}

export interface GetDocumentsResult {
  documents: DocumentItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * 문서 목록 조회 (페이지네이션 지원)
 */
export async function getDocuments(
  page: number = 1,
  limit: number = 10
): Promise<GetDocumentsResult> {
  const session = await validateSession();

  const emptyResult: GetDocumentsResult = {
    documents: [],
    pagination: { page, limit, total: 0, totalPages: 0 },
  };

  if (!session) {
    return emptyResult;
  }

  try {
    const offset = (page - 1) * limit;

    // 전체 문서 수 조회
    const [totalResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(documents)
      .where(eq(documents.tenantId, session.tenantId));

    const total = totalResult?.count || 0;
    const totalPages = Math.ceil(total / limit);

    // 문서 목록 조회 (데이터셋 JOIN 포함, 페이지네이션 적용)
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
        updatedAt: documents.updatedAt,
        datasetName: datasets.name,
      })
      .from(documents)
      .leftJoin(datasets, eq(documents.datasetId, datasets.id))
      .where(eq(documents.tenantId, session.tenantId))
      .orderBy(desc(documents.createdAt))
      .limit(limit)
      .offset(offset);

    // 현재 페이지 문서들의 청크 수 조회
    const docIds = docs.map((d) => d.id);
    const chunkCounts =
      docIds.length > 0
        ? await db
            .select({
              documentId: chunks.documentId,
              count: count(),
            })
            .from(chunks)
            .where(inArray(chunks.documentId, docIds))
            .groupBy(chunks.documentId)
        : [];

    // 청크 수를 Map으로 변환
    const chunkCountMap = new Map(chunkCounts.map((c) => [c.documentId, Number(c.count)]));

    return {
      documents: docs.map((d) => ({
        id: d.id,
        filename: d.filename,
        fileSize: d.fileSize,
        fileType: d.fileType,
        status: d.status || 'uploaded',
        progressPercent: d.progressPercent,
        errorMessage: d.errorMessage,
        createdAt: d.createdAt?.toISOString() || new Date().toISOString(),
        updatedAt: d.updatedAt?.toISOString() || null,
        datasetName: d.datasetName,
        chunkCount: chunkCountMap.get(d.id) || 0,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    };
  } catch (error) {
    logger.error('Failed to get documents', error as Error, { tenantId: session.tenantId });
    return emptyResult;
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
    // 문서 소유권 확인 (재처리에 필요한 모든 필드 조회)
    const doc = await db.query.documents.findFirst({
      where: eq(documents.id, documentId),
      columns: {
        id: true,
        tenantId: true,
        datasetId: true,
        filename: true,
        fileType: true,
        filePath: true,
        status: true,
        updatedAt: true,
      },
    });

    if (!doc || doc.tenantId !== session.tenantId) {
      return { success: false, error: '문서를 찾을 수 없습니다.' };
    }

    // 재처리 가능한 상태 확인 (uploaded, failed, 또는 stalled)
    if (!canReprocessDocument(doc.status || '', doc.updatedAt)) {
      return { success: false, error: '재처리할 수 없는 상태입니다. 현재 처리가 진행 중입니다.' };
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

    // Inngest 이벤트 발송 (datasetId 포함하여 명시적 전달)
    const { inngest } = await import('@/inngest/client');
    await inngest.send({
      name: 'document/uploaded',
      data: {
        documentId: doc.id,
        tenantId: doc.tenantId,
        datasetId: doc.datasetId, // null이면 라이브러리 문서
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
  updatedAt: string | null;
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
        updatedAt: true,
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
      updatedAt: doc.updatedAt?.toISOString() || null,
    };
  } catch (error) {
    logger.error('Failed to refresh document status', error as Error, { documentId });
    return null;
  }
}
