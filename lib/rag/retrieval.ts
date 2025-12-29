/**
 * Hybrid Retrieval 모듈
 * Dense (BGE-m3-ko) + Sparse (Nori BM25) 검색
 */

import { db } from '@/lib/db';
import { chunks } from '@/drizzle/schema';
import { sql, eq, and } from 'drizzle-orm';
import { embedText } from './embedding';
import { logger } from '@/lib/logger';

export interface SearchResult {
  id: string;
  chunkId: string;
  documentId: string;
  datasetId?: string;
  content: string;
  score: number;
  metadata: Record<string, unknown>;
  source: 'dense' | 'sparse' | 'hybrid';
}

interface RankedResult {
  chunk: SearchResult;
  score: number;
}

const DEFAULT_LIMIT = 5;
const RRF_K = 60; // Reciprocal Rank Fusion 상수

/**
 * Hybrid Search 수행
 * Dense (임베딩) + Sparse (BM25) 검색 결과를 RRF로 결합
 */
export async function hybridSearch(
  tenantId: string,
  query: string,
  limit: number = DEFAULT_LIMIT
): Promise<SearchResult[]> {
  const startTime = Date.now();

  try {
    // 병렬로 두 검색 수행
    const [denseResults, sparseResults] = await Promise.all([
      denseSearch(tenantId, query, limit * 2),
      sparseSearch(tenantId, query, limit * 2),
    ]);

    // RRF로 결과 병합
    const hybridResults = reciprocalRankFusion(
      denseResults,
      sparseResults,
      limit
    );

    const duration = Date.now() - startTime;
    logger.info('Hybrid search completed', {
      tenantId,
      queryLength: query.length,
      denseCount: denseResults.length,
      sparseCount: sparseResults.length,
      hybridCount: hybridResults.length,
      duration,
    });

    return hybridResults;
  } catch (error) {
    logger.error(
      'Hybrid search failed',
      error instanceof Error ? error : undefined,
      { tenantId }
    );
    throw error;
  }
}

/**
 * 다중 데이터셋 Hybrid Search 수행
 * 특정 데이터셋들에서만 검색
 */
export async function hybridSearchMultiDataset(
  tenantId: string,
  datasetIds: string[],
  query: string,
  limit: number = DEFAULT_LIMIT
): Promise<SearchResult[]> {
  const startTime = Date.now();

  if (datasetIds.length === 0) {
    logger.warn('No dataset IDs provided for multi-dataset search', { tenantId });
    return [];
  }

  try {
    // 병렬로 두 검색 수행
    const [denseResults, sparseResults] = await Promise.all([
      denseSearchMultiDataset(tenantId, datasetIds, query, limit * 2),
      sparseSearchMultiDataset(tenantId, datasetIds, query, limit * 2),
    ]);

    // RRF로 결과 병합
    const hybridResults = reciprocalRankFusion(
      denseResults,
      sparseResults,
      limit
    );

    const duration = Date.now() - startTime;
    logger.info('Multi-dataset hybrid search completed', {
      tenantId,
      datasetIds,
      queryLength: query.length,
      denseCount: denseResults.length,
      sparseCount: sparseResults.length,
      hybridCount: hybridResults.length,
      duration,
    });

    return hybridResults;
  } catch (error) {
    logger.error(
      'Multi-dataset hybrid search failed',
      error instanceof Error ? error : undefined,
      { tenantId, datasetIds }
    );
    throw error;
  }
}

/**
 * Dense Search (벡터 유사도 검색)
 */
async function denseSearch(
  tenantId: string,
  query: string,
  limit: number
): Promise<SearchResult[]> {
  try {
    // 쿼리 임베딩 생성
    const queryEmbedding = await embedText(query);
    const embeddingStr = `[${queryEmbedding.join(',')}]`;

    // pgvector 코사인 유사도 검색
    const results = await db.execute(sql`
      SELECT
        id,
        document_id,
        content,
        metadata,
        1 - (embedding <=> ${embeddingStr}::vector) as score
      FROM chunks
      WHERE tenant_id = ${tenantId}
        AND status = 'approved'
        AND is_active = true
      ORDER BY embedding <=> ${embeddingStr}::vector
      LIMIT ${limit}
    `);

    return (results.rows as Array<{
      id: string;
      document_id: string;
      content: string;
      metadata: Record<string, unknown>;
      score: number;
    }>).map((row) => ({
      id: row.id,
      chunkId: row.id,
      documentId: row.document_id,
      content: row.content,
      score: Number(row.score),
      metadata: row.metadata || {},
      source: 'dense' as const,
    }));
  } catch (error) {
    logger.error(
      'Dense search failed',
      error instanceof Error ? error : undefined,
      { tenantId }
    );
    return [];
  }
}

/**
 * Sparse Search (BM25 전문 검색)
 */
async function sparseSearch(
  tenantId: string,
  query: string,
  limit: number
): Promise<SearchResult[]> {
  try {
    // Nori를 사용한 한국어 전문 검색
    const results = await db.execute(sql`
      SELECT
        id,
        document_id,
        content,
        metadata,
        ts_rank_cd(content_tsv, plainto_tsquery('korean', ${query})) as score
      FROM chunks
      WHERE tenant_id = ${tenantId}
        AND status = 'approved'
        AND is_active = true
        AND content_tsv @@ plainto_tsquery('korean', ${query})
      ORDER BY score DESC
      LIMIT ${limit}
    `);

    return (results.rows as Array<{
      id: string;
      document_id: string;
      content: string;
      metadata: Record<string, unknown>;
      score: number;
    }>).map((row) => ({
      id: row.id,
      chunkId: row.id,
      documentId: row.document_id,
      content: row.content,
      score: Number(row.score),
      metadata: row.metadata || {},
      source: 'sparse' as const,
    }));
  } catch (error) {
    logger.error(
      'Sparse search failed',
      error instanceof Error ? error : undefined,
      { tenantId }
    );
    return [];
  }
}

/**
 * 다중 데이터셋 Dense Search (벡터 유사도 검색)
 */
async function denseSearchMultiDataset(
  tenantId: string,
  datasetIds: string[],
  query: string,
  limit: number
): Promise<SearchResult[]> {
  try {
    // 쿼리 임베딩 생성
    const queryEmbedding = await embedText(query);
    const embeddingStr = `[${queryEmbedding.join(',')}]`;
    const datasetIdsArray = `{${datasetIds.join(',')}}`;

    // pgvector 코사인 유사도 검색 (다중 데이터셋)
    const results = await db.execute(sql`
      SELECT
        id,
        document_id,
        dataset_id,
        content,
        metadata,
        1 - (embedding <=> ${embeddingStr}::vector) as score
      FROM chunks
      WHERE tenant_id = ${tenantId}
        AND dataset_id = ANY(${datasetIdsArray}::uuid[])
        AND status = 'approved'
        AND is_active = true
      ORDER BY embedding <=> ${embeddingStr}::vector
      LIMIT ${limit}
    `);

    return (results.rows as Array<{
      id: string;
      document_id: string;
      dataset_id: string;
      content: string;
      metadata: Record<string, unknown>;
      score: number;
    }>).map((row) => ({
      id: row.id,
      chunkId: row.id,
      documentId: row.document_id,
      datasetId: row.dataset_id,
      content: row.content,
      score: Number(row.score),
      metadata: row.metadata || {},
      source: 'dense' as const,
    }));
  } catch (error) {
    logger.error(
      'Multi-dataset dense search failed',
      error instanceof Error ? error : undefined,
      { tenantId, datasetIds }
    );
    return [];
  }
}

/**
 * 다중 데이터셋 Sparse Search (BM25 전문 검색)
 */
async function sparseSearchMultiDataset(
  tenantId: string,
  datasetIds: string[],
  query: string,
  limit: number
): Promise<SearchResult[]> {
  try {
    const datasetIdsArray = `{${datasetIds.join(',')}}`;

    // Nori를 사용한 한국어 전문 검색 (다중 데이터셋)
    const results = await db.execute(sql`
      SELECT
        id,
        document_id,
        dataset_id,
        content,
        metadata,
        ts_rank_cd(content_tsv, plainto_tsquery('korean', ${query})) as score
      FROM chunks
      WHERE tenant_id = ${tenantId}
        AND dataset_id = ANY(${datasetIdsArray}::uuid[])
        AND status = 'approved'
        AND is_active = true
        AND content_tsv @@ plainto_tsquery('korean', ${query})
      ORDER BY score DESC
      LIMIT ${limit}
    `);

    return (results.rows as Array<{
      id: string;
      document_id: string;
      dataset_id: string;
      content: string;
      metadata: Record<string, unknown>;
      score: number;
    }>).map((row) => ({
      id: row.id,
      chunkId: row.id,
      documentId: row.document_id,
      datasetId: row.dataset_id,
      content: row.content,
      score: Number(row.score),
      metadata: row.metadata || {},
      source: 'sparse' as const,
    }));
  } catch (error) {
    logger.error(
      'Multi-dataset sparse search failed',
      error instanceof Error ? error : undefined,
      { tenantId, datasetIds }
    );
    return [];
  }
}

/**
 * Reciprocal Rank Fusion (RRF) 알고리즘
 * 두 검색 결과를 순위 기반으로 병합
 */
function reciprocalRankFusion(
  denseResults: SearchResult[],
  sparseResults: SearchResult[],
  limit: number
): SearchResult[] {
  const scores = new Map<string, RankedResult>();

  // Dense 결과 점수 계산
  denseResults.forEach((result, rank) => {
    const rrfScore = 1 / (RRF_K + rank + 1);
    scores.set(result.id, {
      chunk: { ...result, source: 'hybrid' },
      score: rrfScore,
    });
  });

  // Sparse 결과 점수 합산
  sparseResults.forEach((result, rank) => {
    const rrfScore = 1 / (RRF_K + rank + 1);
    const existing = scores.get(result.id);

    if (existing) {
      existing.score += rrfScore;
    } else {
      scores.set(result.id, {
        chunk: { ...result, source: 'hybrid' },
        score: rrfScore,
      });
    }
  });

  // 점수 기준 정렬 및 상위 N개 반환
  return Array.from(scores.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((item) => ({
      ...item.chunk,
      score: item.score,
    }));
}

/**
 * 단순 벡터 검색 (폴백용)
 */
export async function vectorSearch(
  tenantId: string,
  query: string,
  limit: number = DEFAULT_LIMIT
): Promise<SearchResult[]> {
  return denseSearch(tenantId, query, limit);
}

/**
 * 문서별 청크 검색
 */
export async function getChunksByDocument(
  documentId: string,
  tenantId: string
): Promise<SearchResult[]> {
  const results = await db
    .select({
      id: chunks.id,
      content: chunks.content,
      metadata: chunks.metadata,
      qualityScore: chunks.qualityScore,
    })
    .from(chunks)
    .where(
      and(
        eq(chunks.documentId, documentId),
        eq(chunks.tenantId, tenantId),
        eq(chunks.isActive, true)
      )
    );

  return results.map((row) => ({
    id: row.id,
    chunkId: row.id,
    documentId: documentId,
    content: row.content,
    score: row.qualityScore || 0,
    metadata: (row.metadata as Record<string, unknown>) || {},
    source: 'dense' as const,
  }));
}
