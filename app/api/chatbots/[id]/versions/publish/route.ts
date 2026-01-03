/**
 * 버전 발행 API
 *
 * POST /api/chatbots/:id/versions/publish - draft를 published로 발행
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { eq, and, asc, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { chatbots, chatbotConfigVersions, tenants } from '@/drizzle/schema';
import { validateSession } from '@/lib/auth/session';
import { TIER_LIMITS, Tier } from '@/lib/tier/constants';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// 발행 요청 스키마
const publishSchema = z.object({
  note: z.string().max(500).optional(),
});

/**
 * POST /api/chatbots/:id/versions/publish
 * draft를 published로 발행
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await validateSession();
    if (!session) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 });
    }

    const { id } = await params;
    const tenantId = session.tenantId;
    const userId = session.userId;

    // 요청 파싱
    const body = await request.json().catch(() => ({}));
    const parseResult = publishSchema.safeParse(body);
    const note = parseResult.success ? parseResult.data.note : undefined;

    // 챗봇 및 테넌트 조회
    const [chatbotWithTenant] = await db
      .select({
        chatbotId: chatbots.id,
        tier: tenants.tier,
      })
      .from(chatbots)
      .innerJoin(tenants, eq(chatbots.tenantId, tenants.id))
      .where(and(eq(chatbots.id, id), eq(chatbots.tenantId, tenantId)));

    if (!chatbotWithTenant) {
      return NextResponse.json(
        { error: '챗봇을 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    // 티어별 발행 이력 제한
    const rawTier = chatbotWithTenant.tier?.toLowerCase() || 'basic';
    const tier: Tier = (rawTier === 'basic' || rawTier === 'standard' || rawTier === 'premium')
      ? rawTier
      : 'basic';
    const maxHistory = TIER_LIMITS[tier].maxPublishHistory;

    // draft 버전 조회
    const [draftVersion] = await db
      .select()
      .from(chatbotConfigVersions)
      .where(
        and(
          eq(chatbotConfigVersions.chatbotId, id),
          eq(chatbotConfigVersions.versionType, 'draft')
        )
      );

    if (!draftVersion) {
      return NextResponse.json(
        { error: '발행할 draft 버전이 없습니다' },
        { status: 400 }
      );
    }

    // 현재 published 버전 조회
    const [currentPublished] = await db
      .select()
      .from(chatbotConfigVersions)
      .where(
        and(
          eq(chatbotConfigVersions.chatbotId, id),
          eq(chatbotConfigVersions.versionType, 'published')
        )
      );

    // 발행 처리 (neon-http는 트랜잭션 미지원, 순차 쿼리로 처리)
    let newVersionNumber = 1;

    if (currentPublished) {
      // 현재 published → history로 변경
      newVersionNumber = (currentPublished.versionNumber ?? 0) + 1;

      await db
        .update(chatbotConfigVersions)
        .set({
          versionType: 'history',
          updatedAt: new Date(),
        })
        .where(eq(chatbotConfigVersions.id, currentPublished.id));

      // history 개수 확인 및 초과분 삭제 (FIFO)
      const historyCount = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(chatbotConfigVersions)
        .where(
          and(
            eq(chatbotConfigVersions.chatbotId, id),
            eq(chatbotConfigVersions.versionType, 'history')
          )
        );

      const currentHistoryCount = historyCount[0]?.count ?? 0;

      if (currentHistoryCount > maxHistory) {
        // 가장 오래된 history부터 삭제
        const deleteCount = currentHistoryCount - maxHistory;
        const oldestHistories = await db
          .select({ id: chatbotConfigVersions.id })
          .from(chatbotConfigVersions)
          .where(
            and(
              eq(chatbotConfigVersions.chatbotId, id),
              eq(chatbotConfigVersions.versionType, 'history')
            )
          )
          .orderBy(asc(chatbotConfigVersions.publishedAt))
          .limit(deleteCount);

        for (const old of oldestHistories) {
          await db
            .delete(chatbotConfigVersions)
            .where(eq(chatbotConfigVersions.id, old.id));
        }
      }
    }

    // 새 published 버전 생성 (draft 내용 복사)
    const [newPublished] = await db
      .insert(chatbotConfigVersions)
      .values({
        chatbotId: id,
        versionType: 'published',
        publicPageConfig: draftVersion.publicPageConfig,
        widgetConfig: draftVersion.widgetConfig,
        publishedAt: new Date(),
        publishedBy: userId,
        publishNote: note,
        versionNumber: newVersionNumber,
      })
      .returning();

    const result = {
      versionNumber: newVersionNumber,
      publishedAt: newPublished.publishedAt,
    };

    return NextResponse.json({
      message: '발행되었습니다',
      version: {
        number: result.versionNumber,
        publishedAt: result.publishedAt,
      },
    });
  } catch (error) {
    console.error('Publish error:', error);
    return NextResponse.json(
      { error: '발행 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
