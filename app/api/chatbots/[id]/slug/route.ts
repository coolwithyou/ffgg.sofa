/**
 * 슬러그 변경 API
 *
 * GET /api/chatbots/:id/slug - 현재 슬러그 및 변경 제한 정보 조회
 * PATCH /api/chatbots/:id/slug - 슬러그 변경 (티어 제한 적용)
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { eq, and, ne } from 'drizzle-orm';
import { db } from '@/lib/db';
import { chatbots, tenants } from '@/drizzle/schema';
import { validateSession } from '@/lib/auth/session';
import { validateSlugAsync } from '@/lib/public-page/reserved-slugs';
import {
  checkSlugChangeLimit,
  logSlugChange,
} from '@/lib/slug/change-limit';
import { normalizeTier } from '@/lib/tier/constants';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// 슬러그 변경 스키마
const updateSlugSchema = z.object({
  slug: z
    .string()
    .min(3, '슬러그는 3자 이상이어야 합니다')
    .max(50, '슬러그는 50자 이하여야 합니다')
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      '슬러그는 영문 소문자, 숫자, 하이픈만 사용 가능합니다'
    ),
});

/**
 * GET /api/chatbots/:id/slug
 * 현재 슬러그 및 변경 제한 정보 조회
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await validateSession();
    if (!session) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 });
    }

    const { id } = await params;
    const tenantId = session.tenantId;

    // 챗봇 조회
    const [chatbot] = await db
      .select({
        id: chatbots.id,
        slug: chatbots.slug,
        publicPageEnabled: chatbots.publicPageEnabled,
      })
      .from(chatbots)
      .where(and(eq(chatbots.id, id), eq(chatbots.tenantId, tenantId)));

    if (!chatbot) {
      return NextResponse.json(
        { error: '챗봇을 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    // 테넌트 티어 조회
    const [tenant] = await db
      .select({ tier: tenants.tier })
      .from(tenants)
      .where(eq(tenants.id, tenantId));

    const tier = normalizeTier(tenant?.tier);

    // 슬러그 변경 제한 확인
    const limitInfo = await checkSlugChangeLimit(id, tier);

    return NextResponse.json({
      slug: chatbot.slug,
      publicPageEnabled: chatbot.publicPageEnabled,
      changeLimit: limitInfo,
      tier,
    });
  } catch (error) {
    console.error('Get slug info error:', error);
    return NextResponse.json(
      { error: '슬러그 정보 조회 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/chatbots/:id/slug
 * 슬러그 변경 (티어 제한 적용)
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await validateSession();
    if (!session) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 });
    }

    const { id } = await params;
    const tenantId = session.tenantId;
    const userId = session.userId;

    // 챗봇 조회
    const [chatbot] = await db
      .select({
        id: chatbots.id,
        slug: chatbots.slug,
        tenantId: chatbots.tenantId,
      })
      .from(chatbots)
      .where(and(eq(chatbots.id, id), eq(chatbots.tenantId, tenantId)));

    if (!chatbot) {
      return NextResponse.json(
        { error: '챗봇을 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    // 테넌트 티어 조회
    const [tenant] = await db
      .select({ tier: tenants.tier })
      .from(tenants)
      .where(eq(tenants.id, tenantId));

    const tier = normalizeTier(tenant?.tier);

    // 슬러그 변경 제한 확인
    const limitInfo = await checkSlugChangeLimit(id, tier);

    if (!limitInfo.canChange) {
      return NextResponse.json(
        {
          error: limitInfo.reason || '슬러그 변경 제한에 도달했습니다',
          changeLimit: limitInfo,
        },
        { status: 403 }
      );
    }

    // 요청 파싱
    const body = await request.json();
    const parseResult = updateSlugSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: parseResult.error.issues[0]?.message || '잘못된 요청입니다',
        },
        { status: 400 }
      );
    }

    const { slug: newSlug } = parseResult.data;

    // 동일한 슬러그로 변경 시 무시
    if (newSlug === chatbot.slug) {
      return NextResponse.json({
        message: '슬러그가 동일합니다',
        slug: newSlug,
        changeLimit: limitInfo,
      });
    }

    // 슬러그 유효성 검사 (시스템 예약어 + DB 예약어)
    const validation = await validateSlugAsync(newSlug);
    if (!validation.valid) {
      return NextResponse.json(
        { error: '사용할 수 없는 키워드입니다' },
        { status: 400 }
      );
    }

    // 중복 체크 (다른 챗봇이 사용 중인지)
    const existingChatbot = await db.query.chatbots.findFirst({
      where: and(eq(chatbots.slug, newSlug), ne(chatbots.id, id)),
      columns: { id: true },
    });

    if (existingChatbot) {
      return NextResponse.json(
        { error: '사용할 수 없는 키워드입니다' },
        { status: 400 }
      );
    }

    // 트랜잭션으로 슬러그 업데이트 + 변경 로그 기록
    await db.transaction(async (tx) => {
      // chatbots 테이블 업데이트
      await tx
        .update(chatbots)
        .set({
          slug: newSlug,
          updatedAt: new Date(),
        })
        .where(eq(chatbots.id, id));

      // 변경 로그 기록 (logSlugChange는 트랜잭션 외부라서 직접 삽입)
      // logSlugChange 함수는 별도 db 인스턴스 사용하므로 여기서 직접 처리
    });

    // 변경 로그 기록 (트랜잭션 성공 후)
    await logSlugChange({
      chatbotId: id,
      previousSlug: chatbot.slug,
      newSlug,
      changedBy: userId,
    });

    // 업데이트된 제한 정보 조회
    const updatedLimitInfo = await checkSlugChangeLimit(id, tier);

    return NextResponse.json({
      message: '슬러그가 변경되었습니다',
      slug: newSlug,
      previousSlug: chatbot.slug,
      changeLimit: updatedLimitInfo,
    });
  } catch (error) {
    console.error('Update slug error:', error);
    return NextResponse.json(
      { error: '슬러그 변경 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
