/**
 * 사용량 조회 API
 * GET /api/user/usage
 */

import { NextResponse } from 'next/server';
import { validateSession } from '@/lib/auth';
import { db, tenants, chatbots, datasets, documents, conversations } from '@/lib/db';
import { eq, and, gte, sql } from 'drizzle-orm';
import { ErrorCode, AppError, errorResponse } from '@/lib/errors';
import { TIER_LIMITS, normalizeTier } from '@/lib/tier/constants';

export async function GET() {
  try {
    const session = await validateSession();

    if (!session) {
      return NextResponse.json(
        new AppError(ErrorCode.UNAUTHORIZED).toSafeResponse(),
        { status: 401 }
      );
    }

    // 테넌트 정보 조회
    const tenant = await db.query.tenants.findFirst({
      where: eq(tenants.id, session.tenantId),
      columns: {
        id: true,
        tier: true,
      },
    });

    if (!tenant) {
      return NextResponse.json(
        new AppError(ErrorCode.NOT_FOUND, '테넌트를 찾을 수 없습니다.').toSafeResponse(),
        { status: 404 }
      );
    }

    const tier = normalizeTier(tenant.tier);
    const limits = TIER_LIMITS[tier];

    // 챗봇 수 조회
    const chatbotCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(chatbots)
      .where(eq(chatbots.tenantId, session.tenantId));

    // 데이터셋 수 조회
    const datasetCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(datasets)
      .where(eq(datasets.tenantId, session.tenantId));

    // 문서 수 조회
    const documentCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(documents)
      .where(eq(documents.tenantId, session.tenantId));

    // 저장 용량 조회 (데이터셋의 totalStorageBytes 합계)
    const storageResult = await db
      .select({ total: sql<number>`COALESCE(SUM(total_storage_bytes), 0)` })
      .from(datasets)
      .where(eq(datasets.tenantId, session.tenantId));

    // 이번 달 대화 수 조회
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const conversationCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(conversations)
      .where(
        and(
          eq(conversations.tenantId, session.tenantId),
          gte(conversations.createdAt, startOfMonth)
        )
      );

    return NextResponse.json({
      tier,
      usage: {
        chatbots: {
          used: Number(chatbotCount[0]?.count || 0),
          limit: limits.maxChatbots,
        },
        datasets: {
          used: Number(datasetCount[0]?.count || 0),
          limit: limits.maxDatasets,
        },
        documents: {
          used: Number(documentCount[0]?.count || 0),
          limit: limits.maxTotalDocuments,
        },
        storage: {
          used: Number(storageResult[0]?.total || 0),
          limit: limits.maxStorageBytes,
        },
        conversations: {
          used: Number(conversationCount[0]?.count || 0),
          limit: limits.maxMonthlyConversations,
        },
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
