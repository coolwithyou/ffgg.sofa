/**
 * Hybrid Retrieval 모듈
 * Dense (BGE-m3-ko) + Sparse (Nori BM25) 검색
 */

import { db } from '@/lib/db';
import { chunks } from '@/drizzle/schema';
import { sql, eq, and } from 'drizzle-orm';
import { embedText, type EmbeddingTrackingContext } from './embedding';
import { logger } from '@/lib/logger';

export interface SearchResult {
  id: string;
  chunkId: string;
  documentId: string;
  datasetId?: string;
  content: string;
  /** RRF 점수 (랭킹용, 0.01~0.03 범위) */
  score: number;
  /** Dense 검색 원본 점수 (코사인 유사도, 0~1 범위, 임계값 비교용) */
  denseScore?: number;
  metadata: Record<string, unknown>;
  source: 'dense' | 'sparse' | 'hybrid';
}

interface RankedResult {
  chunk: SearchResult;
  score: number;
  /** Dense 검색 원본 점수 (0~1 범위) */
  denseScore?: number;
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
  limit: number = DEFAULT_LIMIT,
  trackingContext?: EmbeddingTrackingContext
): Promise<SearchResult[]> {
  const startTime = Date.now();

  try {
    // 병렬로 두 검색 수행
    const [denseResults, sparseResults] = await Promise.all([
      denseSearch(tenantId, query, limit * 2, trackingContext),
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
  limit: number = DEFAULT_LIMIT,
  trackingContext?: EmbeddingTrackingContext
): Promise<SearchResult[]> {
  const startTime = Date.now();

  if (datasetIds.length === 0) {
    logger.warn('No dataset IDs provided for multi-dataset search', { tenantId });
    return [];
  }

  try {
    // 병렬로 두 검색 수행
    const [denseResults, sparseResults] = await Promise.all([
      denseSearchMultiDataset(tenantId, datasetIds, query, limit * 2, trackingContext),
      sparseSearchMultiDataset(tenantId, datasetIds, query, limit * 2),
    ]);

    // RRF로 결과 병합
    const hybridResults = reciprocalRankFusion(
      denseResults,
      sparseResults,
      limit
    );

    const duration = Date.now() - startTime;

    // INFO 레벨로 상세 검색 결과 로깅 (디버깅용)
    logger.info('[HybridSearch] Multi-dataset search completed', {
      tenantId,
      datasetIds,
      searchQuery: query, // 실제 검색에 사용된 쿼리
      queryLength: query.length,
      denseCount: denseResults.length,
      sparseCount: sparseResults.length,
      hybridCount: hybridResults.length,
      duration,
      // 상위 3개 결과의 점수와 내용 미리보기
      topResults: hybridResults.slice(0, 3).map((r, i) => ({
        rank: i + 1,
        score: r.score,
        contentPreview: r.content.slice(0, 100),
        source: r.source,
      })),
      // Dense 검색 상위 결과 (RRF 적용 전)
      topDenseScores: denseResults.slice(0, 3).map(r => ({
        score: r.score,
        contentPreview: r.content.slice(0, 50),
      })),
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
  limit: number,
  trackingContext?: EmbeddingTrackingContext
): Promise<SearchResult[]> {
  try {
    // 쿼리 임베딩 생성
    const queryEmbedding = await embedText(query, trackingContext);
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
 *
 * PostgreSQL의 'simple' 설정을 사용하여 텍스트 검색 수행
 * 한국어의 경우 tsvector보다 ILIKE 폴백이 더 효과적일 수 있음
 */
async function sparseSearch(
  tenantId: string,
  query: string,
  limit: number
): Promise<SearchResult[]> {
  try {
    // 'simple' 설정으로 전문 검색 (한국어 토큰화 미지원이지만 오류 방지)
    // ILIKE 폴백으로 한국어 부분 문자열 매칭 지원
    const results = await db.execute(sql`
      SELECT
        id,
        document_id,
        content,
        metadata,
        CASE
          WHEN content ILIKE ${'%' + query + '%'} THEN 1.0
          ELSE 0.5
        END as score
      FROM chunks
      WHERE tenant_id = ${tenantId}
        AND status = 'approved'
        AND is_active = true
        AND content ILIKE ${'%' + query + '%'}
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
  limit: number,
  trackingContext?: EmbeddingTrackingContext
): Promise<SearchResult[]> {
  try {
    // 쿼리 임베딩 생성
    const queryEmbedding = await embedText(query, trackingContext);
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
 *
 * PostgreSQL 'simple' 설정 대신 ILIKE 기반 검색 사용
 * 한국어에서 tsvector 기반 검색보다 ILIKE가 더 효과적임
 */
async function sparseSearchMultiDataset(
  tenantId: string,
  datasetIds: string[],
  query: string,
  limit: number
): Promise<SearchResult[]> {
  try {
    const datasetIdsArray = `{${datasetIds.join(',')}}`;

    // ILIKE 기반 한국어 부분 문자열 매칭 (다중 데이터셋)
    const results = await db.execute(sql`
      SELECT
        id,
        document_id,
        dataset_id,
        content,
        metadata,
        CASE
          WHEN content ILIKE ${'%' + query + '%'} THEN 1.0
          ELSE 0.5
        END as score
      FROM chunks
      WHERE tenant_id = ${tenantId}
        AND dataset_id = ANY(${datasetIdsArray}::uuid[])
        AND status = 'approved'
        AND is_active = true
        AND content ILIKE ${'%' + query + '%'}
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
 *
 * @returns SearchResult[] - RRF 점수(score)와 Dense 원본 점수(denseScore) 모두 포함
 */
function reciprocalRankFusion(
  denseResults: SearchResult[],
  sparseResults: SearchResult[],
  limit: number
): SearchResult[] {
  const scores = new Map<string, RankedResult>();

  // Dense 결과 점수 계산 - 원본 점수도 보존
  denseResults.forEach((result, rank) => {
    const rrfScore = 1 / (RRF_K + rank + 1);
    scores.set(result.id, {
      chunk: { ...result, source: 'hybrid' },
      score: rrfScore,
      denseScore: result.score, // Dense 원본 점수 보존 (코사인 유사도)
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
        // Sparse-only 결과는 denseScore 없음
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
      denseScore: item.denseScore, // Dense 원본 점수 포함
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

/**
 * 다중 데이터셋에서 승인된 청크 랜덤 샘플링
 * 페르소나 자동 생성용으로 문서 청크를 샘플링합니다.
 */
export async function getChunksByDatasets(
  tenantId: string,
  datasetIds: string[],
  limit: number = 50
): Promise<Array<{ content: string; documentId: string }>> {
  if (datasetIds.length === 0) return [];

  try {
    const datasetIdsArray = `{${datasetIds.join(',')}}`;

    const results = await db.execute(sql`
      SELECT content, document_id
      FROM chunks
      WHERE tenant_id = ${tenantId}
        AND dataset_id = ANY(${datasetIdsArray}::uuid[])
        AND status = 'approved'
        AND is_active = true
      ORDER BY RANDOM()
      LIMIT ${limit}
    `);

    return (results.rows as Array<{ content: string; document_id: string }>).map(
      (row) => ({
        content: row.content,
        documentId: row.document_id,
      })
    );
  } catch (error) {
    logger.error(
      'Get chunks by datasets failed',
      error instanceof Error ? error : undefined,
      { tenantId, datasetIds }
    );
    return [];
  }
}
