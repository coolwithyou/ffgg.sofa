/**
 * 청크 검토 서비스
 * 청크 조회, 수정, 승인/거부 로직
 */

import { db, chunks, documents } from '@/lib/db';
import { eq, and, or, gte, lte, like, desc, asc, sql, inArray } from 'drizzle-orm';
import { logger } from '@/lib/logger';
import type {
  ChunkReviewItem,
  ChunkListFilter,
  ChunkListResult,
  ChunkUpdateInput,
  BulkUpdateInput,
  BulkUpdateResult,
  DeploymentStatus,
  AutoApprovalConfig,
  ChunkStatus,
} from './types';

// 상수 정의
const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 20;

/**
 * LIKE 패턴 특수문자 이스케이프
 */
function escapeLikePattern(str: string): string {
  return str.replace(/[%_\\]/g, '\\$&');
}

// 기본 자동 승인 설정
const DEFAULT_AUTO_APPROVAL: AutoApprovalConfig = {
  enabled: true,
  minQualityScore: 85,
};

/**
 * 청크 목록 조회 (필터/정렬/페이징)
 */
export async function getChunkList(filter: ChunkListFilter): Promise<ChunkListResult> {
  const {
    tenantId,
    documentId,
    status,
    minQualityScore,
    maxQualityScore,
    search,
    sortBy = 'chunkIndex',
    sortOrder = 'asc',
    page = 1,
    limit = DEFAULT_LIMIT,
  } = filter;

  // limit 상한 적용
  const safeLimit = Math.min(limit, MAX_LIMIT);

  const offset = (page - 1) * safeLimit;

  // 조건 구성
  const conditions = [eq(chunks.tenantId, tenantId)];

  if (documentId) {
    conditions.push(eq(chunks.documentId, documentId));
  }

  if (status) {
    if (Array.isArray(status)) {
      conditions.push(inArray(chunks.status, status));
    } else {
      conditions.push(eq(chunks.status, status));
    }
  }

  if (minQualityScore !== undefined) {
    conditions.push(gte(chunks.qualityScore, minQualityScore));
  }

  if (maxQualityScore !== undefined) {
    conditions.push(lte(chunks.qualityScore, maxQualityScore));
  }

  if (search) {
    const escapedSearch = escapeLikePattern(search);
    conditions.push(like(chunks.content, `%${escapedSearch}%`));
  }

  // 정렬 구성
  const orderColumn = {
    qualityScore: chunks.qualityScore,
    chunkIndex: chunks.chunkIndex,
    createdAt: chunks.createdAt,
    status: chunks.status,
  }[sortBy];

  const orderFn = sortOrder === 'desc' ? desc : asc;

  // 쿼리 실행
  const whereClause = and(...conditions);

  const [chunkResults, countResult] = await Promise.all([
    db
      .select({
        id: chunks.id,
        documentId: chunks.documentId,
        content: chunks.content,
        chunkIndex: chunks.chunkIndex,
        qualityScore: chunks.qualityScore,
        status: chunks.status,
        autoApproved: chunks.autoApproved,
        metadata: chunks.metadata,
        createdAt: chunks.createdAt,
        updatedAt: chunks.updatedAt,
        documentName: documents.filename,
      })
      .from(chunks)
      .leftJoin(documents, eq(chunks.documentId, documents.id))
      .where(whereClause)
      .orderBy(orderFn(orderColumn))
      .limit(safeLimit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)` })
      .from(chunks)
      .where(whereClause),
  ]);

  const total = countResult[0]?.count ?? 0;

  const items: ChunkReviewItem[] = chunkResults.map((row) => {
    const metadata = (row.metadata || {}) as Record<string, unknown>;
    return {
      id: row.id,
      documentId: row.documentId,
      documentName: row.documentName || 'Unknown',
      content: row.content,
      chunkIndex: row.chunkIndex ?? 0,
      qualityScore: row.qualityScore,
      status: (row.status || 'pending') as ChunkStatus,
      autoApproved: row.autoApproved ?? false,
      metadata,
      createdAt: row.createdAt?.toISOString() || '',
      updatedAt: row.updatedAt?.toISOString() || '',
      // Contextual Retrieval 필드
      contextPrefix: (metadata.contextPrefix as string) || null,
      contextPrompt: (metadata.contextPrompt as string) || null,
      hasContext: !!metadata.hasContext,
    };
  });

  return {
    chunks: items,
    total,
    page,
    limit: safeLimit,
    hasMore: offset + items.length < total,
  };
}

/**
 * 단일 청크 조회
 */
export async function getChunk(tenantId: string, chunkId: string): Promise<ChunkReviewItem | null> {
  const result = await db
    .select({
      id: chunks.id,
      documentId: chunks.documentId,
      content: chunks.content,
      chunkIndex: chunks.chunkIndex,
      qualityScore: chunks.qualityScore,
      status: chunks.status,
      autoApproved: chunks.autoApproved,
      metadata: chunks.metadata,
      createdAt: chunks.createdAt,
      updatedAt: chunks.updatedAt,
      documentName: documents.filename,
    })
    .from(chunks)
    .leftJoin(documents, eq(chunks.documentId, documents.id))
    .where(and(eq(chunks.id, chunkId), eq(chunks.tenantId, tenantId)))
    .limit(1);

  if (result.length === 0) {
    return null;
  }

  const row = result[0];
  const metadata = (row.metadata || {}) as Record<string, unknown>;
  return {
    id: row.id,
    documentId: row.documentId,
    documentName: row.documentName || 'Unknown',
    content: row.content,
    chunkIndex: row.chunkIndex ?? 0,
    qualityScore: row.qualityScore,
    status: (row.status || 'pending') as ChunkStatus,
    autoApproved: row.autoApproved ?? false,
    metadata,
    createdAt: row.createdAt?.toISOString() || '',
    updatedAt: row.updatedAt?.toISOString() || '',
    // Contextual Retrieval 필드
    contextPrefix: (metadata.contextPrefix as string) || null,
    contextPrompt: (metadata.contextPrompt as string) || null,
    hasContext: !!metadata.hasContext,
  };
}

/**
 * 청크 수정
 */
export async function updateChunk(
  tenantId: string,
  chunkId: string,
  input: ChunkUpdateInput
): Promise<ChunkReviewItem | null> {
  const updateData: Record<string, unknown> = {
    updatedAt: new Date(),
  };

  if (input.content !== undefined) {
    updateData.content = input.content;
    updateData.status = 'modified'; // 내용 수정 시 상태 변경
  }

  if (input.status !== undefined) {
    updateData.status = input.status;
  }

  if (input.qualityScore !== undefined) {
    updateData.qualityScore = input.qualityScore;
  }

  const result = await db
    .update(chunks)
    .set(updateData)
    .where(and(eq(chunks.id, chunkId), eq(chunks.tenantId, tenantId)));

  if ((result.rowCount ?? 0) === 0) {
    logger.warn('Chunk update had no effect', { tenantId, chunkId });
    return null;
  }

  logger.info('Chunk updated', { tenantId, chunkId, updates: Object.keys(updateData) });

  return getChunk(tenantId, chunkId);
}

/**
 * 청크 일괄 업데이트
 */
export async function bulkUpdateChunks(
  tenantId: string,
  input: BulkUpdateInput
): Promise<BulkUpdateResult> {
  const { chunkIds, status } = input;

  if (chunkIds.length === 0) {
    return { updated: 0, failed: 0 };
  }

  try {
    const result = await db
      .update(chunks)
      .set({
        status,
        updatedAt: new Date(),
      })
      .where(and(eq(chunks.tenantId, tenantId), inArray(chunks.id, chunkIds)));

    const updated = result.rowCount ?? 0;
    const failed = chunkIds.length - updated;

    logger.info('Bulk chunk update', { tenantId, status, requested: chunkIds.length, updated, failed });

    return { updated, failed };
  } catch (error) {
    logger.error('Bulk update failed', error as Error, { tenantId, chunkIds });
    return {
      updated: 0,
      failed: chunkIds.length,
      errors: [(error as Error).message],
    };
  }
}

/**
 * 청크 삭제 (논리적 삭제)
 */
export async function deleteChunk(tenantId: string, chunkId: string): Promise<boolean> {
  const result = await db
    .update(chunks)
    .set({
      isActive: false,
      status: 'rejected',
      updatedAt: new Date(),
    })
    .where(and(eq(chunks.id, chunkId), eq(chunks.tenantId, tenantId)));

  const success = (result.rowCount ?? 0) > 0;

  if (success) {
    logger.info('Chunk deleted (soft)', { tenantId, chunkId });
  }

  return success;
}

/**
 * 배포 상태 조회
 */
export async function getDeploymentStatus(
  tenantId: string,
  documentId?: string
): Promise<DeploymentStatus> {
  const conditions = [eq(chunks.tenantId, tenantId)];

  if (documentId) {
    conditions.push(eq(chunks.documentId, documentId));
  }

  const whereClause = and(...conditions);

  const statusCounts = await db
    .select({
      status: chunks.status,
      count: sql<number>`count(*)`,
    })
    .from(chunks)
    .where(whereClause)
    .groupBy(chunks.status);

  const lastModified = await db
    .select({ updatedAt: chunks.updatedAt })
    .from(chunks)
    .where(whereClause)
    .orderBy(desc(chunks.updatedAt))
    .limit(1);

  const counts: Record<string, number> = {};
  for (const row of statusCounts) {
    counts[row.status || 'pending'] = row.count;
  }

  const total = Object.values(counts).reduce((sum, c) => sum + c, 0);

  return {
    tenantId,
    documentId,
    totalChunks: total,
    approvedChunks: counts['approved'] || 0,
    pendingChunks: counts['pending'] || 0,
    rejectedChunks: counts['rejected'] || 0,
    modifiedChunks: counts['modified'] || 0,
    lastModifiedAt: lastModified[0]?.updatedAt?.toISOString() || new Date().toISOString(),
  };
}

/**
 * 자동 승인 적용
 */
export async function applyAutoApproval(
  tenantId: string,
  documentId: string,
  config: AutoApprovalConfig = DEFAULT_AUTO_APPROVAL
): Promise<number> {
  if (!config.enabled) {
    return 0;
  }

  const conditions = [
    eq(chunks.tenantId, tenantId),
    eq(chunks.documentId, documentId),
    eq(chunks.status, 'pending'),
    gte(chunks.qualityScore, config.minQualityScore),
  ];

  const result = await db
    .update(chunks)
    .set({
      status: 'approved',
      autoApproved: true,
      updatedAt: new Date(),
    })
    .where(and(...conditions));

  const count = result.rowCount ?? 0;

  if (count > 0) {
    logger.info('Auto-approved chunks', {
      tenantId,
      documentId,
      count,
      minScore: config.minQualityScore,
    });
  }

  return count;
}

/**
 * 문서 상태 업데이트 (모든 청크 승인 시)
 */
export async function checkAndUpdateDocumentStatus(
  tenantId: string,
  documentId: string
): Promise<void> {
  const status = await getDeploymentStatus(tenantId, documentId);

  // 모든 청크가 승인되었으면 문서 상태 업데이트
  if (status.pendingChunks === 0 && status.approvedChunks > 0) {
    await db
      .update(documents)
      .set({
        status: 'approved',
        updatedAt: new Date(),
      })
      .where(and(eq(documents.id, documentId), eq(documents.tenantId, tenantId)));

    logger.info('Document approved', { tenantId, documentId, approvedChunks: status.approvedChunks });
  }
}

/**
 * 다음 검토 대기 청크 조회
 */
export async function getNextPendingChunk(
  tenantId: string,
  currentChunkId?: string,
  documentId?: string
): Promise<ChunkReviewItem | null> {
  const conditions = [eq(chunks.tenantId, tenantId), eq(chunks.status, 'pending')];

  if (documentId) {
    conditions.push(eq(chunks.documentId, documentId));
  }

  // 현재 청크 이후의 다음 청크 찾기
  if (currentChunkId) {
    const currentChunk = await getChunk(tenantId, currentChunkId);
    if (currentChunk) {
      conditions.push(
        or(
          gte(chunks.chunkIndex, (currentChunk.chunkIndex || 0) + 1),
          // 다른 문서의 청크도 포함
          sql`${chunks.documentId} > ${currentChunk.documentId}`
        )!
      );
    }
  }

  const result = await db
    .select({
      id: chunks.id,
      documentId: chunks.documentId,
      content: chunks.content,
      chunkIndex: chunks.chunkIndex,
      qualityScore: chunks.qualityScore,
      status: chunks.status,
      autoApproved: chunks.autoApproved,
      metadata: chunks.metadata,
      createdAt: chunks.createdAt,
      updatedAt: chunks.updatedAt,
      documentName: documents.filename,
    })
    .from(chunks)
    .leftJoin(documents, eq(chunks.documentId, documents.id))
    .where(and(...conditions))
    .orderBy(asc(chunks.documentId), asc(chunks.chunkIndex))
    .limit(1);

  if (result.length === 0) {
    return null;
  }

  const row = result[0];
  const metadata = (row.metadata || {}) as Record<string, unknown>;
  return {
    id: row.id,
    documentId: row.documentId,
    documentName: row.documentName || 'Unknown',
    content: row.content,
    chunkIndex: row.chunkIndex ?? 0,
    qualityScore: row.qualityScore,
    status: (row.status || 'pending') as ChunkStatus,
    autoApproved: row.autoApproved ?? false,
    metadata,
    createdAt: row.createdAt?.toISOString() || '',
    updatedAt: row.updatedAt?.toISOString() || '',
    // Contextual Retrieval 필드
    contextPrefix: (metadata.contextPrefix as string) || null,
    contextPrompt: (metadata.contextPrompt as string) || null,
    hasContext: !!metadata.hasContext,
  };
}
