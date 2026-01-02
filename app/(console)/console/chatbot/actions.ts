'use server';

/**
 * Knowledge 서버 액션
 * 문서 관리 + 라이브러리 기능 통합
 */

import { validateSession } from '@/lib/auth';
import { getSession } from '@/lib/auth/session';
import { db, documents, datasets, chunks } from '@/lib/db';
import { eq, desc, count, sql, inArray, and, asc } from 'drizzle-orm';
import { logger } from '@/lib/logger';
import { revalidatePath } from 'next/cache';
import { canReprocessDocument } from '@/lib/constants/document';

// ============================================
// 문서 관리 타입 & 액션 (Documents)
// ============================================

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

    revalidatePath('/console/chatbot');

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

    revalidatePath('/console/chatbot');

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

// ============================================
// 라이브러리 타입 & 액션 (Library)
// ============================================

export interface LibraryDocument {
  id: string;
  filename: string;
  fileSize: number | null;
  fileType: string | null;
  status: string;
  chunkCount: number;
  approvedCount: number;
  pendingCount: number;
  progressPercent: number | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
  datasetId: string | null;
  datasetName: string | null;
}

export interface MoveResult {
  success: boolean;
  error?: string;
}

export interface DuplicateResult {
  success: boolean;
  newDocumentId?: string;
  copiedChunkCount?: number;
  error?: string;
}

export interface UnassignResult {
  success: boolean;
  error?: string;
}

export interface DatasetOption {
  id: string;
  name: string;
  isDefault: boolean;
}

/**
 * 라이브러리 문서 목록 조회 (모든 문서)
 */
export async function getLibraryDocuments(): Promise<LibraryDocument[]> {
  const session = await getSession();
  if (!session?.tenantId) {
    throw new Error('인증이 필요합니다.');
  }

  // 모든 문서 조회 (LEFT JOIN으로 데이터셋 이름 포함)
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
      datasetId: documents.datasetId,
      datasetName: datasets.name,
    })
    .from(documents)
    .leftJoin(datasets, eq(documents.datasetId, datasets.id))
    .where(eq(documents.tenantId, session.tenantId))
    .orderBy(desc(documents.createdAt));

  // 각 문서의 청크 통계 조회
  const result = await Promise.all(
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
        createdAt: doc.createdAt?.toISOString() || new Date().toISOString(),
        updatedAt: doc.updatedAt?.toISOString() || new Date().toISOString(),
        datasetId: doc.datasetId,
        datasetName: doc.datasetName,
      };
    })
  );

  return result;
}

/**
 * 데이터셋 목록 조회 (맵핑 대상 선택용)
 */
export async function getDatasets(): Promise<DatasetOption[]> {
  const session = await getSession();
  if (!session?.tenantId) {
    throw new Error('인증이 필요합니다.');
  }

  const datasetList = await db
    .select({
      id: datasets.id,
      name: datasets.name,
      isDefault: datasets.isDefault,
    })
    .from(datasets)
    .where(eq(datasets.tenantId, session.tenantId))
    .orderBy(desc(datasets.isDefault), asc(datasets.name));

  return datasetList.map((d) => ({
    id: d.id,
    name: d.name,
    isDefault: d.isDefault || false,
  }));
}

/**
 * 문서를 데이터셋으로 이동 (라이브러리 → 데이터셋)
 * 라이브러리에 있는 문서(datasetId=null)만 이동 가능
 */
export async function moveDocumentToDataset(
  documentId: string,
  targetDatasetId: string
): Promise<MoveResult> {
  const session = await getSession();
  if (!session?.tenantId) {
    return { success: false, error: '인증이 필요합니다.' };
  }

  const tenantId = session.tenantId;

  try {
    // 대상 데이터셋 존재 및 권한 확인
    const [targetDataset] = await db
      .select({ id: datasets.id })
      .from(datasets)
      .where(and(eq(datasets.id, targetDatasetId), eq(datasets.tenantId, tenantId)));

    if (!targetDataset) {
      return { success: false, error: '데이터셋을 찾을 수 없습니다.' };
    }

    // 문서 조회 및 라이브러리 문서인지 확인
    const [doc] = await db
      .select({
        id: documents.id,
        datasetId: documents.datasetId,
      })
      .from(documents)
      .where(and(eq(documents.id, documentId), eq(documents.tenantId, tenantId)));

    if (!doc) {
      return { success: false, error: '문서를 찾을 수 없습니다.' };
    }

    if (doc.datasetId !== null) {
      return { success: false, error: '이미 데이터셋에 속한 문서입니다. 복제 기능을 사용하세요.' };
    }

    // 문서의 청크 수 조회
    const [chunkStats] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(chunks)
      .where(eq(chunks.documentId, documentId));

    const chunkCount = chunkStats?.count || 0;

    // 문서의 datasetId 업데이트
    await db
      .update(documents)
      .set({ datasetId: targetDatasetId, updatedAt: new Date() })
      .where(eq(documents.id, documentId));

    // 해당 문서의 모든 청크 datasetId 업데이트
    await db
      .update(chunks)
      .set({ datasetId: targetDatasetId, updatedAt: new Date() })
      .where(eq(chunks.documentId, documentId));

    // 대상 데이터셋 통계 업데이트
    await db
      .update(datasets)
      .set({
        documentCount: sql`${datasets.documentCount} + 1`,
        chunkCount: sql`${datasets.chunkCount} + ${chunkCount}`,
        updatedAt: new Date(),
      })
      .where(eq(datasets.id, targetDatasetId));

    revalidatePath('/console/chatbot');
    revalidatePath('/console/chatbot/datasets');
    revalidatePath(`/console/chatbot/datasets/${targetDatasetId}`);

    return { success: true };
  } catch (error) {
    console.error('Document move error:', error);
    return { success: false, error: '문서 이동 중 오류가 발생했습니다.' };
  }
}

/**
 * 문서를 다른 데이터셋으로 복제
 * 이미 데이터셋에 속한 문서를 다른 데이터셋으로 복제
 * 임베딩은 재계산 없이 복사
 */
export async function duplicateDocumentToDataset(
  documentId: string,
  targetDatasetId: string
): Promise<DuplicateResult> {
  const session = await getSession();
  if (!session?.tenantId) {
    return { success: false, error: '인증이 필요합니다.' };
  }

  const tenantId = session.tenantId;

  try {
    // 대상 데이터셋 존재 및 권한 확인
    const [targetDataset] = await db
      .select({ id: datasets.id })
      .from(datasets)
      .where(and(eq(datasets.id, targetDatasetId), eq(datasets.tenantId, tenantId)));

    if (!targetDataset) {
      return { success: false, error: '데이터셋을 찾을 수 없습니다.' };
    }

    // 원본 문서 조회
    const [sourceDoc] = await db
      .select()
      .from(documents)
      .where(and(eq(documents.id, documentId), eq(documents.tenantId, tenantId)));

    if (!sourceDoc) {
      return { success: false, error: '문서를 찾을 수 없습니다.' };
    }

    // 같은 데이터셋으로 복제 시도 방지
    if (sourceDoc.datasetId === targetDatasetId) {
      return { success: false, error: '같은 데이터셋으로는 복제할 수 없습니다.' };
    }

    // 새 문서 생성
    const [newDoc] = await db
      .insert(documents)
      .values({
        tenantId: sourceDoc.tenantId,
        datasetId: targetDatasetId,
        filename: sourceDoc.filename,
        filePath: sourceDoc.filePath,
        fileSize: sourceDoc.fileSize,
        fileType: sourceDoc.fileType,
        status: sourceDoc.status,
        progressStep: sourceDoc.progressStep,
        progressPercent: sourceDoc.progressPercent,
        metadata: {
          ...(typeof sourceDoc.metadata === 'object' && sourceDoc.metadata !== null
            ? sourceDoc.metadata
            : {}),
          duplicatedFrom: sourceDoc.id,
          duplicatedAt: new Date().toISOString(),
        },
      })
      .returning({ id: documents.id });

    // 원본 청크 조회
    const sourceChunks = await db
      .select()
      .from(chunks)
      .where(and(eq(chunks.documentId, documentId), eq(chunks.tenantId, tenantId)));

    // 청크 복제
    let copiedChunkCount = 0;
    for (const chunk of sourceChunks) {
      await db.insert(chunks).values({
        tenantId: chunk.tenantId,
        documentId: newDoc.id,
        datasetId: targetDatasetId,
        sourceChunkId: chunk.id,
        content: chunk.content,
        embedding: chunk.embedding,
        contentTsv: chunk.contentTsv,
        chunkIndex: chunk.chunkIndex,
        qualityScore: chunk.qualityScore,
        status: chunk.status,
        autoApproved: chunk.autoApproved,
        version: 1,
        isActive: true,
        metadata: {
          ...(typeof chunk.metadata === 'object' && chunk.metadata !== null ? chunk.metadata : {}),
          copiedFrom: chunk.id,
          copiedAt: new Date().toISOString(),
        },
      });
      copiedChunkCount++;
    }

    // 대상 데이터셋 통계 업데이트
    await db
      .update(datasets)
      .set({
        documentCount: sql`${datasets.documentCount} + 1`,
        chunkCount: sql`${datasets.chunkCount} + ${copiedChunkCount}`,
        updatedAt: new Date(),
      })
      .where(eq(datasets.id, targetDatasetId));

    revalidatePath('/console/chatbot');
    revalidatePath('/console/chatbot/datasets');
    revalidatePath(`/console/chatbot/datasets/${targetDatasetId}`);

    return { success: true, newDocumentId: newDoc.id, copiedChunkCount };
  } catch (error) {
    console.error('Document duplicate error:', error);
    return { success: false, error: '문서 복제 중 오류가 발생했습니다.' };
  }
}

/**
 * 문서를 데이터셋에서 배치 해제 (데이터셋 → 라이브러리)
 * moveDocumentToDataset()의 반대 동작
 * 문서와 청크는 삭제되지 않고 라이브러리(미배치 상태)로 이동
 */
export async function unassignDocumentFromDataset(
  documentId: string
): Promise<UnassignResult> {
  const session = await getSession();
  if (!session?.tenantId) {
    return { success: false, error: '인증이 필요합니다.' };
  }

  const tenantId = session.tenantId;

  try {
    // 문서 조회 및 데이터셋 소속 여부 확인
    const [doc] = await db
      .select({
        id: documents.id,
        datasetId: documents.datasetId,
      })
      .from(documents)
      .where(and(eq(documents.id, documentId), eq(documents.tenantId, tenantId)));

    if (!doc) {
      return { success: false, error: '문서를 찾을 수 없습니다.' };
    }

    if (doc.datasetId === null) {
      return { success: false, error: '이미 미배치 상태인 문서입니다.' };
    }

    const sourceDatasetId = doc.datasetId;

    // 문서의 청크 수 조회 (통계 감소용)
    const [chunkStats] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(chunks)
      .where(eq(chunks.documentId, documentId));

    const chunkCount = chunkStats?.count || 0;

    // 문서의 datasetId를 null로 업데이트
    await db
      .update(documents)
      .set({ datasetId: null, updatedAt: new Date() })
      .where(eq(documents.id, documentId));

    // 해당 문서의 모든 청크 datasetId를 null로 업데이트
    await db
      .update(chunks)
      .set({ datasetId: null, updatedAt: new Date() })
      .where(eq(chunks.documentId, documentId));

    // 원래 데이터셋 통계 감소
    await db
      .update(datasets)
      .set({
        documentCount: sql`GREATEST(${datasets.documentCount} - 1, 0)`,
        chunkCount: sql`GREATEST(${datasets.chunkCount} - ${chunkCount}, 0)`,
        updatedAt: new Date(),
      })
      .where(eq(datasets.id, sourceDatasetId));

    revalidatePath('/console/chatbot');
    revalidatePath('/console/chatbot/datasets');
    revalidatePath(`/console/chatbot/datasets/${sourceDatasetId}`);

    return { success: true };
  } catch (error) {
    console.error('Document unassign error:', error);
    return { success: false, error: '문서 배치 해제 중 오류가 발생했습니다.' };
  }
}
