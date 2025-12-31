'use server';

/**
 * 라이브러리 서버 액션
 * 라이브러리 문서 및 청크 조회
 */

import { db } from '@/lib/db';
import { documents, chunks, datasets } from '@/drizzle/schema';
import { eq, and, desc, sql, asc } from 'drizzle-orm';
import { getSession } from '@/lib/auth/session';
import { revalidatePath } from 'next/cache';

// 타입 정의
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

// 문서 이동/복제 결과 타입
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

export interface DatasetOption {
  id: string;
  name: string;
  isDefault: boolean;
}

// 라이브러리 문서 목록 조회 (모든 문서)
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

// 데이터셋 목록 조회 (맵핑 대상 선택용)
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

    revalidatePath('/library');
    revalidatePath('/datasets');
    revalidatePath(`/datasets/${targetDatasetId}`);

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

    revalidatePath('/library');
    revalidatePath('/datasets');
    revalidatePath(`/datasets/${targetDatasetId}`);

    return { success: true, newDocumentId: newDoc.id, copiedChunkCount };
  } catch (error) {
    console.error('Document duplicate error:', error);
    return { success: false, error: '문서 복제 중 오류가 발생했습니다.' };
  }
}
