/**
 * 라이브러리 문서 청크 API
 *
 * GET /api/library/documents/:id/chunks - 특정 라이브러리 문서의 청크 목록 조회
 */

import { NextRequest, NextResponse } from 'next/server';
import { eq, and, isNull, asc, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { documents, chunks } from '@/drizzle/schema';
import { validateSession } from '@/lib/auth/session';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/library/documents/:id/chunks - 라이브러리 문서의 청크 목록 조회
 *
 * 라이브러리에 있는 문서의 청크들을 조회합니다.
 * 이 청크들은 데이터셋에 복사하여 검색에 활용할 수 있습니다.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await validateSession();
    if (!session) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 });
    }

    const { id: documentId } = await params;
    const tenantId = session.tenantId;

    // URL 파라미터 파싱
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const status = searchParams.get('status'); // all, pending, approved, rejected

    // 페이지네이션 계산
    const offset = (page - 1) * limit;

    // 문서 존재 및 라이브러리 소속 확인
    const [doc] = await db
      .select({
        id: documents.id,
        datasetId: documents.datasetId,
        filename: documents.filename,
      })
      .from(documents)
      .where(and(eq(documents.id, documentId), eq(documents.tenantId, tenantId)));

    if (!doc) {
      return NextResponse.json({ error: '문서를 찾을 수 없습니다' }, { status: 404 });
    }

    // 라이브러리 문서 확인 (datasetId가 null이어야 함)
    if (doc.datasetId !== null) {
      return NextResponse.json(
        { error: '이 문서는 라이브러리에 없습니다. 데이터셋에 속한 문서입니다.' },
        { status: 400 }
      );
    }

    // 청크 조건 구성
    const chunkConditions = [eq(chunks.documentId, documentId), eq(chunks.tenantId, tenantId)];

    if (status && status !== 'all') {
      chunkConditions.push(eq(chunks.status, status));
    }

    // 전체 카운트 조회
    const [totalResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(chunks)
      .where(and(...chunkConditions));

    const total = totalResult?.count || 0;

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
      .where(and(...chunkConditions))
      .orderBy(asc(chunks.chunkIndex))
      .limit(limit)
      .offset(offset);

    // 응답 형식 변환
    const formattedChunks = chunkList.map((chunk) => ({
      id: chunk.id,
      content: chunk.content,
      chunkIndex: chunk.chunkIndex,
      qualityScore: chunk.qualityScore,
      status: chunk.status || 'pending',
      autoApproved: chunk.autoApproved || false,
      metadata: chunk.metadata,
      createdAt: chunk.createdAt?.toISOString() || new Date().toISOString(),
      // 미리보기용 짧은 내용
      preview: chunk.content.length > 200 ? chunk.content.substring(0, 200) + '...' : chunk.content,
    }));

    return NextResponse.json({
      document: {
        id: doc.id,
        filename: doc.filename,
      },
      chunks: formattedChunks,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Library document chunks get error:', error);
    return NextResponse.json({ error: '청크 목록 조회 중 오류가 발생했습니다' }, { status: 500 });
  }
}
