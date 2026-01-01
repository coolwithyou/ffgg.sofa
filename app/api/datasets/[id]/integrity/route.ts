/**
 * 데이터셋 무결성 체크 API
 *
 * GET /api/datasets/:id/integrity - 무결성 이슈 상세 조회
 * POST /api/datasets/:id/integrity - 무결성 수정 실행
 */

import { NextRequest, NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { validateSession } from '@/lib/auth/session';

interface RouteParams {
  params: Promise<{ id: string }>;
}

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

    const { id } = await params;
    const body = await request.json();
    const { action } = body;

    if (action === 'fixDatasetId') {
      // datasetId를 documents 테이블에서 동기화
      const result = await db.execute(sql`
        UPDATE chunks c
        SET dataset_id = d.dataset_id, updated_at = NOW()
        FROM documents d
        WHERE c.document_id = d.id
        AND d.dataset_id = ${id}
        AND (c.dataset_id IS NULL OR c.dataset_id != ${id})
      `);

      return NextResponse.json({
        message: 'datasetId 동기화가 완료되었습니다',
        affectedRows: result.rowCount,
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
