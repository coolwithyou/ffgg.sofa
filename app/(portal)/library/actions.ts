'use server';

/**
 * 라이브러리 서버 액션
 * 라이브러리 문서 및 청크 조회
 */

import { db } from '@/lib/db';
import { documents, chunks, datasets } from '@/drizzle/schema';
import { eq, and, isNull, desc, sql, asc } from 'drizzle-orm';
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
}

export interface LibraryChunk {
  id: string;
  content: string;
  preview: string;
  chunkIndex: number | null;
  qualityScore: number | null;
  status: string;
  autoApproved: boolean;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface DatasetOption {
  id: string;
  name: string;
  isDefault: boolean;
}

// 라이브러리 문서 목록 조회
export async function getLibraryDocuments(): Promise<LibraryDocument[]> {
  const session = await getSession();
  if (!session?.tenantId) {
    throw new Error('인증이 필요합니다.');
  }

  // 라이브러리 문서 조회 (datasetId가 null인 문서)
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
    })
    .from(documents)
    .where(and(eq(documents.tenantId, session.tenantId), isNull(documents.datasetId)))
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
      };
    })
  );

  return result;
}

// 라이브러리 문서의 청크 목록 조회
export async function getLibraryChunks(documentId: string): Promise<LibraryChunk[]> {
  const session = await getSession();
  if (!session?.tenantId) {
    throw new Error('인증이 필요합니다.');
  }

  // 문서 존재 및 라이브러리 소속 확인
  const [doc] = await db
    .select({ id: documents.id, datasetId: documents.datasetId })
    .from(documents)
    .where(and(eq(documents.id, documentId), eq(documents.tenantId, session.tenantId)));

  if (!doc) {
    throw new Error('문서를 찾을 수 없습니다.');
  }

  if (doc.datasetId !== null) {
    throw new Error('이 문서는 라이브러리에 없습니다.');
  }

  // 청크 목록 조회
  const chunkList = await db
    .select({
      id: chunks.id,
      content: chunks.content,
      chunkIndex: chunks.chunkIndex,
      qualityScore: chunks.qualityScore,
      status: chunks.status,
      autoApproved: chunks.autoApproved,
      metadata: chunks.metadata,
      createdAt: chunks.createdAt,
    })
    .from(chunks)
    .where(and(eq(chunks.documentId, documentId), eq(chunks.tenantId, session.tenantId)))
    .orderBy(asc(chunks.chunkIndex));

  return chunkList.map((chunk) => ({
    id: chunk.id,
    content: chunk.content,
    preview: chunk.content.length > 200 ? chunk.content.substring(0, 200) + '...' : chunk.content,
    chunkIndex: chunk.chunkIndex,
    qualityScore: chunk.qualityScore,
    status: chunk.status || 'pending',
    autoApproved: chunk.autoApproved || false,
    metadata: chunk.metadata as Record<string, unknown> | null,
    createdAt: chunk.createdAt?.toISOString() || new Date().toISOString(),
  }));
}

// 데이터셋 목록 조회 (복사 대상 선택용)
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

// 청크를 데이터셋으로 복사
export async function copyChunksToDataset(
  chunkIds: string[],
  targetDatasetId: string
): Promise<{ success: boolean; copiedCount: number; error?: string }> {
  const session = await getSession();
  if (!session?.tenantId) {
    return { success: false, copiedCount: 0, error: '인증이 필요합니다.' };
  }

  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/datasets/${targetDatasetId}/chunks/copy`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ chunkIds }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      return { success: false, copiedCount: 0, error: error.error || '복사 실패' };
    }

    const result = await response.json();

    revalidatePath('/library');
    revalidatePath('/datasets');

    return { success: true, copiedCount: result.stats.copied };
  } catch (error) {
    console.error('Chunk copy error:', error);
    return { success: false, copiedCount: 0, error: '청크 복사 중 오류가 발생했습니다.' };
  }
}
