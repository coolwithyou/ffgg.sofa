/**
 * 데이터셋 무결성 체크 API
 *
 * GET /api/datasets/:id/integrity - 무결성 이슈 상세 조회
 * POST /api/datasets/:id/integrity - 무결성 수정 실행
 *   - fixDatasetId: 청크의 datasetId를 문서 기준으로 동기화
 *   - fixMissingEmbedding: 임베딩 누락 청크에 임베딩 재생성
 */

import { NextRequest, NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { validateSession } from '@/lib/auth/session';
import { embedTexts } from '@/lib/rag';
import { logger } from '@/lib/logger';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// 임베딩 배치 처리 크기
const EMBEDDING_BATCH_SIZE = 50;

/**
 * GET /api/datasets/:id/integrity - 무결성 이슈 상세 조회
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await validateSession();
    if (!session) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 });
    }

    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const issueType = searchParams.get('type') || 'missingDatasetId';
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);

    let chunksQuery;

    switch (issueType) {
      case 'missingDatasetId':
        // datasetId가 누락되거나 불일치하는 청크
        chunksQuery = await db.execute(sql`
          SELECT
            c.id,
            c.document_id,
            c.dataset_id as chunk_dataset_id,
            d.dataset_id as doc_dataset_id,
            d.filename,
            LEFT(c.content, 100) as content_preview,
            c.status,
            c.is_active,
            c.created_at,
            c.updated_at
          FROM chunks c
          INNER JOIN documents d ON c.document_id = d.id
          WHERE d.dataset_id = ${id}
          AND (c.dataset_id IS NULL OR c.dataset_id != ${id})
          ORDER BY c.created_at DESC
          LIMIT ${limit}
        `);
        break;

      case 'missingEmbedding':
        // 임베딩이 누락된 청크
        chunksQuery = await db.execute(sql`
          SELECT
            c.id,
            c.document_id,
            d.filename,
            LEFT(c.content, 100) as content_preview,
            c.status,
            c.is_active,
            c.created_at,
            c.updated_at
          FROM chunks c
          INNER JOIN documents d ON c.document_id = d.id
          WHERE c.dataset_id = ${id}
          AND c.embedding IS NULL
          AND c.status = 'approved'
          ORDER BY c.created_at DESC
          LIMIT ${limit}
        `);
        break;

      case 'emptyContent':
        // 빈 콘텐츠 청크
        chunksQuery = await db.execute(sql`
          SELECT
            c.id,
            c.document_id,
            d.filename,
            c.content,
            c.status,
            c.is_active,
            c.created_at,
            c.updated_at
          FROM chunks c
          INNER JOIN documents d ON c.document_id = d.id
          WHERE c.dataset_id = ${id}
          AND LENGTH(c.content) = 0
          ORDER BY c.created_at DESC
          LIMIT ${limit}
        `);
        break;

      default:
        return NextResponse.json(
          { error: '지원하지 않는 이슈 타입입니다' },
          { status: 400 }
        );
    }

    return NextResponse.json({
      issueType,
      chunks: chunksQuery.rows,
      count: chunksQuery.rows.length,
    });
  } catch (error) {
    console.error('Integrity check error:', error);
    return NextResponse.json(
      { error: '무결성 체크 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/datasets/:id/integrity - 무결성 수정 실행
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await validateSession();
    if (!session) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 });
    }

    const { id: datasetId } = await params;
    const tenantId = session.tenantId;
    const body = await request.json();
    const { action } = body;

    // Action 1: datasetId 동기화
    if (action === 'fixDatasetId') {
      const result = await db.execute(sql`
        UPDATE chunks c
        SET dataset_id = d.dataset_id, updated_at = NOW()
        FROM documents d
        WHERE c.document_id = d.id
        AND d.dataset_id = ${datasetId}
        AND (c.dataset_id IS NULL OR c.dataset_id != ${datasetId})
      `);

      return NextResponse.json({
        message: 'datasetId 동기화가 완료되었습니다',
        affectedRows: result.rowCount,
      });
    }

    // Action 2: 임베딩 재생성
    if (action === 'fixMissingEmbedding') {
      // 1. 임베딩이 누락된 청크 조회 (content 포함)
      const chunksResult = await db.execute(sql`
        SELECT c.id, c.content
        FROM chunks c
        WHERE c.dataset_id = ${datasetId}
        AND c.embedding IS NULL
        AND c.status = 'approved'
        AND LENGTH(c.content) > 0
        ORDER BY c.created_at ASC
      `);

      const chunks = chunksResult.rows as Array<{ id: string; content: string }>;

      if (chunks.length === 0) {
        return NextResponse.json({
          message: '임베딩이 필요한 청크가 없습니다',
          affectedRows: 0,
        });
      }

      logger.info('Starting embedding regeneration', {
        datasetId,
        totalChunks: chunks.length,
      });

      let totalProcessed = 0;
      let totalFailed = 0;

      // 2. 배치 단위로 임베딩 생성 및 업데이트
      for (let i = 0; i < chunks.length; i += EMBEDDING_BATCH_SIZE) {
        const batch = chunks.slice(i, i + EMBEDDING_BATCH_SIZE);
        const texts = batch.map((chunk) => chunk.content);

        try {
          // 임베딩 생성
          const embeddings = await embedTexts(texts, { tenantId });

          // 각 청크에 임베딩 업데이트
          for (let j = 0; j < batch.length; j++) {
            const chunk = batch[j];
            const embedding = embeddings[j];

            if (embedding && embedding.length > 0) {
              // pgvector 형식으로 변환
              const embeddingStr = `[${embedding.join(',')}]`;

              await db.execute(sql`
                UPDATE chunks
                SET embedding = ${embeddingStr}::vector,
                    updated_at = NOW()
                WHERE id = ${chunk.id}
              `);

              totalProcessed++;
            } else {
              totalFailed++;
              logger.warn('Empty embedding returned', { chunkId: chunk.id });
            }
          }

          logger.info('Embedding batch completed', {
            batchIndex: Math.floor(i / EMBEDDING_BATCH_SIZE) + 1,
            batchSize: batch.length,
            totalProcessed,
          });
        } catch (batchError) {
          totalFailed += batch.length;
          logger.error(
            'Embedding batch failed',
            batchError instanceof Error ? batchError : new Error('Unknown error'),
            { batchIndex: Math.floor(i / EMBEDDING_BATCH_SIZE) + 1 }
          );
        }
      }

      logger.info('Embedding regeneration completed', {
        datasetId,
        totalProcessed,
        totalFailed,
      });

      return NextResponse.json({
        message: `임베딩 재생성이 완료되었습니다`,
        affectedRows: totalProcessed,
        failedRows: totalFailed,
        totalChunks: chunks.length,
      });
    }

    return NextResponse.json(
      { error: '지원하지 않는 액션입니다' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Integrity fix error:', error);
    return NextResponse.json(
      { error: '무결성 수정 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
