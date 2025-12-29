/**
 * 데이터셋 API
 *
 * POST /api/datasets - 데이터셋 생성
 * GET /api/datasets - 데이터셋 목록 조회
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { eq, desc, and } from 'drizzle-orm';
import { db } from '@/lib/db';
import { datasets, documents, chunks } from '@/drizzle/schema';
import { validateSession } from '@/lib/auth/session';
import { canCreateDataset } from '@/lib/tier/validator';

// 데이터셋 생성 스키마
const createDatasetSchema = z.object({
  name: z.string().min(1, '이름을 입력해주세요').max(100, '이름은 100자 이내로 입력해주세요'),
  description: z.string().max(500, '설명은 500자 이내로 입력해주세요').optional(),
});

/**
 * POST /api/datasets - 데이터셋 생성
 */
export async function POST(request: NextRequest) {
  try {
    // 세션 검증
    const session = await validateSession();
    if (!session) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 });
    }

    const tenantId = session.tenantId;

    // 티어 제한 확인
    const { allowed, reason, limit } = await canCreateDataset(tenantId);
    if (!allowed) {
      return NextResponse.json(
        {
          error: reason,
          limit: {
            current: limit.current,
            max: limit.max,
          },
        },
        { status: 403 }
      );
    }

    // 요청 본문 파싱
    const body = await request.json();
    const parseResult = createDatasetSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: '입력값이 올바르지 않습니다', details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const { name, description } = parseResult.data;

    // 데이터셋 생성
    const [newDataset] = await db
      .insert(datasets)
      .values({
        tenantId,
        name,
        description,
        isDefault: false,
      })
      .returning();

    return NextResponse.json(
      {
        message: '데이터셋이 생성되었습니다',
        dataset: newDataset,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Dataset creation error:', error);
    return NextResponse.json(
      { error: '데이터셋 생성 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/datasets - 데이터셋 목록 조회
 */
export async function GET(request: NextRequest) {
  try {
    // 세션 검증
    const session = await validateSession();
    if (!session) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 });
    }

    const tenantId = session.tenantId;

    // URL 파라미터 파싱
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status'); // active, archived, all
    const includeStats = searchParams.get('includeStats') === 'true';

    // 조건 구성
    const conditions = [eq(datasets.tenantId, tenantId)];
    if (status && status !== 'all') {
      conditions.push(eq(datasets.status, status));
    }

    // 데이터셋 목록 조회
    const datasetList = await db
      .select()
      .from(datasets)
      .where(and(...conditions))
      .orderBy(desc(datasets.isDefault), desc(datasets.createdAt));

    // 통계 포함 옵션
    if (includeStats) {
      const datasetsWithStats = await Promise.all(
        datasetList.map(async (dataset) => {
          // 실시간 통계 계산 (캐시된 값과 다를 수 있음)
          const [docStats] = await db
            .select({
              count: db.$count(documents, eq(documents.datasetId, dataset.id)),
            })
            .from(documents)
            .where(eq(documents.datasetId, dataset.id));

          const [chunkStats] = await db
            .select({
              count: db.$count(chunks, eq(chunks.datasetId, dataset.id)),
            })
            .from(chunks)
            .where(eq(chunks.datasetId, dataset.id));

          return {
            ...dataset,
            stats: {
              documentCount: docStats?.count || 0,
              chunkCount: chunkStats?.count || 0,
            },
          };
        })
      );

      return NextResponse.json({ datasets: datasetsWithStats });
    }

    return NextResponse.json({ datasets: datasetList });
  } catch (error) {
    console.error('Dataset list error:', error);
    return NextResponse.json(
      { error: '데이터셋 목록 조회 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
