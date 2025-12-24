/**
 * 응답 캐싱 로직
 * 유사한 질문에 대한 캐시된 응답 반환
 */

import { db, responseCache } from '@/lib/db';
import { eq, and, gt, sql } from 'drizzle-orm';
import { embedText, cosineSimilarity } from '@/lib/rag/embedding';
import { createHash } from 'crypto';
import { logger } from '@/lib/logger';

// 캐시 설정
const CACHE_TTL_HOURS = 24; // 캐시 만료 시간 (시간)
const SIMILARITY_THRESHOLD = 0.92; // 유사도 임계값 (92% 이상)

export interface CacheResult {
  hit: boolean;
  response?: string;
  cacheId?: string;
}

/**
 * 캐시에서 유사한 응답 검색
 */
export async function findCachedResponse(
  tenantId: string,
  query: string
): Promise<CacheResult> {
  try {
    // 쿼리 해시 계산
    const queryHash = hashQuery(query);

    // 1. 정확히 일치하는 해시 검색 (빠른 경로)
    const exactMatch = await db
      .select()
      .from(responseCache)
      .where(
        and(
          eq(responseCache.tenantId, tenantId),
          eq(responseCache.queryHash, queryHash),
          gt(responseCache.expiresAt, new Date())
        )
      )
      .limit(1);

    if (exactMatch.length > 0) {
      // 캐시 히트 카운트 증가
      await incrementHitCount(exactMatch[0].id);

      logger.info('Cache hit (exact match)', {
        tenantId,
        cacheId: exactMatch[0].id,
      });

      return {
        hit: true,
        response: exactMatch[0].response,
        cacheId: exactMatch[0].id,
      };
    }

    // 2. 임베딩 기반 유사도 검색 (느린 경로)
    const queryEmbedding = await embedText(query);

    // 유효한 캐시 중 가장 유사한 것 검색
    const similarResults = await db.execute<{
      id: string;
      response: string;
      query_embedding: number[];
    }>(sql`
      SELECT id, response, query_embedding
      FROM response_cache
      WHERE tenant_id = ${tenantId}
        AND expires_at > NOW()
        AND query_embedding IS NOT NULL
      ORDER BY query_embedding <=> ${queryEmbedding}::vector
      LIMIT 5
    `);

    if (similarResults.rows.length === 0) {
      return { hit: false };
    }

    // 유사도 검증
    for (const row of similarResults.rows) {
      if (row.query_embedding) {
        const similarity = cosineSimilarity(queryEmbedding, row.query_embedding);

        if (similarity >= SIMILARITY_THRESHOLD) {
          await incrementHitCount(row.id);

          logger.info('Cache hit (similarity match)', {
            tenantId,
            cacheId: row.id,
            similarity: similarity.toFixed(4),
          });

          return {
            hit: true,
            response: row.response,
            cacheId: row.id,
          };
        }
      }
    }

    return { hit: false };
  } catch (error) {
    logger.error('Cache lookup failed', error as Error, { tenantId });
    return { hit: false };
  }
}

/**
 * 응답을 캐시에 저장
 */
export async function cacheResponse(
  tenantId: string,
  query: string,
  response: string
): Promise<void> {
  try {
    const queryHash = hashQuery(query);
    const queryEmbedding = await embedText(query);
    const expiresAt = new Date(Date.now() + CACHE_TTL_HOURS * 60 * 60 * 1000);

    await db
      .insert(responseCache)
      .values({
        tenantId,
        queryHash,
        queryEmbedding,
        response,
        hitCount: 0,
        expiresAt,
      })
      .onConflictDoUpdate({
        target: [responseCache.tenantId, responseCache.queryHash],
        set: {
          response,
          queryEmbedding,
          hitCount: 0,
          expiresAt,
        },
      });

    logger.info('Response cached', {
      tenantId,
      queryHash,
      expiresAt: expiresAt.toISOString(),
    });
  } catch (error) {
    // 캐싱 실패는 무시 (기능에 영향 없음)
    logger.warn('Failed to cache response', {
      tenantId,
      errorMessage: error instanceof Error ? error.message : 'Unknown',
    });
  }
}

/**
 * 캐시 히트 카운트 증가
 */
async function incrementHitCount(cacheId: string): Promise<void> {
  await db
    .update(responseCache)
    .set({
      hitCount: sql`${responseCache.hitCount} + 1`,
    })
    .where(eq(responseCache.id, cacheId));
}

/**
 * 쿼리 해시 생성
 */
function hashQuery(query: string): string {
  // 정규화: 소문자, 공백 정리
  const normalized = query.toLowerCase().trim().replace(/\s+/g, ' ');
  return createHash('sha256').update(normalized).digest('hex');
}

/**
 * 만료된 캐시 정리 (cron으로 호출)
 */
export async function cleanupExpiredCache(): Promise<number> {
  const result = await db
    .delete(responseCache)
    .where(sql`expires_at < NOW()`);

  const deletedCount = result.rowCount ?? 0;

  if (deletedCount > 0) {
    logger.info('Expired cache cleaned up', { deletedCount });
  }

  return deletedCount;
}

/**
 * 테넌트 캐시 무효화
 */
export async function invalidateTenantCache(tenantId: string): Promise<number> {
  const result = await db
    .delete(responseCache)
    .where(eq(responseCache.tenantId, tenantId));

  const deletedCount = result.rowCount ?? 0;

  logger.info('Tenant cache invalidated', {
    tenantId,
    deletedCount,
  });

  return deletedCount;
}
