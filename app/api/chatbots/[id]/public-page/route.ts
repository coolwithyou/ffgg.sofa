/**
 * 공개 페이지 설정 API
 *
 * GET /api/chatbots/:id/public-page - draft 설정 조회
 * POST /api/chatbots/:id/public-page - 활성화/비활성화 토글
 * PATCH /api/chatbots/:id/public-page - draft 설정 업데이트
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { eq, and, ne } from 'drizzle-orm';
import { db } from '@/lib/db';
import { chatbots, chatbotConfigVersions } from '@/drizzle/schema';
import { validateSession } from '@/lib/auth/session';
import { validateSlugAsync } from '@/lib/public-page/reserved-slugs';
import {
  parsePublicPageConfig,
  toPublicPageConfigJson,
  DEFAULT_PUBLIC_PAGE_CONFIG,
} from '@/lib/public-page/types';
import { blocksArraySchema } from '@/lib/public-page/block-schema';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// 토글 스키마
const toggleSchema = z.object({
  enabled: z.boolean(),
  slug: z.string().optional(),
});

// 업데이트 스키마
const updateSchema = z.object({
  slug: z.string().nullable().optional(),
  config: z
    .object({
      header: z
        .object({
          title: z.string().optional(),
          description: z.string().optional(),
          logoUrl: z.string().optional(),
          showBrandName: z.boolean().optional(),
        })
        .optional(),
      theme: z
        .object({
          // 배경 타입
          backgroundType: z.enum(['solid', 'image', 'gradient']).optional(),
          // 기본 색상
          backgroundColor: z.string().optional(),
          primaryColor: z.string().optional(),
          textColor: z.string().optional(),
          fontFamily: z.string().optional(),
          // 배경 이미지
          backgroundImage: z.string().optional(),
          backgroundSize: z.enum(['cover', 'contain', 'auto']).optional(),
          backgroundRepeat: z
            .enum(['no-repeat', 'repeat', 'repeat-x', 'repeat-y'])
            .optional(),
          backgroundPosition: z.string().optional(),
          // 그라데이션
          gradientFrom: z.string().optional(),
          gradientTo: z.string().optional(),
          gradientDirection: z
            .enum([
              'to-b',
              'to-t',
              'to-r',
              'to-l',
              'to-br',
              'to-bl',
              'to-tr',
              'to-tl',
            ])
            .optional(),
          gradientAngle: z.number().min(0).max(360).optional(),
          // 카드 스타일
          cardBackgroundColor: z.string().optional(),
          cardShadow: z.number().optional(),
          cardMarginY: z.number().optional(),
          cardPaddingX: z.number().optional(),
          cardBorderRadius: z.number().optional(),
        })
        .optional(),
      seo: z
        .object({
          title: z.string().optional(),
          description: z.string().optional(),
          ogImage: z.string().optional(),
        })
        .optional(),
      blocks: blocksArraySchema.optional(),
    })
    .optional(),
});

/**
 * draft 버전 조회 또는 생성
 */
async function getOrCreateDraftVersion(chatbotId: string, chatbot: {
  publicPageConfig: unknown;
  widgetConfig: unknown;
}) {
  // draft 버전 조회
  const [draftVersion] = await db
    .select()
    .from(chatbotConfigVersions)
    .where(
      and(
        eq(chatbotConfigVersions.chatbotId, chatbotId),
        eq(chatbotConfigVersions.versionType, 'draft')
      )
    );

  if (draftVersion) {
    return draftVersion;
  }

  // draft가 없으면 chatbot의 현재 설정으로 생성
  const [newDraft] = await db
    .insert(chatbotConfigVersions)
    .values({
      chatbotId,
      versionType: 'draft',
      publicPageConfig: chatbot.publicPageConfig ?? {},
      widgetConfig: chatbot.widgetConfig ?? {},
    })
    .returning();

  return newDraft;
}

/**
 * GET /api/chatbots/:id/public-page
 * draft 버전 설정 조회
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
        publicPageConfig: chatbots.publicPageConfig,
        widgetConfig: chatbots.widgetConfig,
      })
      .from(chatbots)
      .where(and(eq(chatbots.id, id), eq(chatbots.tenantId, tenantId)));

    if (!chatbot) {
      return NextResponse.json(
        { error: '챗봇을 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    // draft 버전 조회 또는 생성
    const draftVersion = await getOrCreateDraftVersion(id, chatbot);

    // config 파싱 (draft 버전에서)
    const config = parsePublicPageConfig(draftVersion.publicPageConfig);

    return NextResponse.json({
      publicPage: {
        enabled: chatbot.publicPageEnabled,
        slug: chatbot.slug,
        config,
      },
    });
  } catch (error) {
    console.error('Get public page error:', error);
    return NextResponse.json(
      { error: '설정 조회 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/chatbots/:id/public-page
 * 공개 페이지 활성화/비활성화 토글
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await validateSession();
    if (!session) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 });
    }

    const { id } = await params;
    const tenantId = session.tenantId;

    // 챗봇 조회
    const [chatbot] = await db
      .select()
      .from(chatbots)
      .where(and(eq(chatbots.id, id), eq(chatbots.tenantId, tenantId)));

    if (!chatbot) {
      return NextResponse.json(
        { error: '챗봇을 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    // 요청 파싱
    const body = await request.json();
    const parseResult = toggleSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: '잘못된 요청입니다' },
        { status: 400 }
      );
    }

    const { enabled, slug } = parseResult.data;

    // 활성화하려면 슬러그 필수
    if (enabled) {
      const targetSlug = slug || chatbot.slug;

      if (!targetSlug) {
        return NextResponse.json(
          { error: '공개 페이지를 활성화하려면 슬러그가 필요합니다' },
          { status: 400 }
        );
      }

      // 슬러그 유효성 검사 (DB 예약어 포함)
      const validation = await validateSlugAsync(targetSlug);
      if (!validation.valid) {
        return NextResponse.json({ error: validation.error }, { status: 400 });
      }

      // 슬러그 중복 체크 (자기 자신 제외)
      const existingChatbot = await db.query.chatbots.findFirst({
        where: and(eq(chatbots.slug, targetSlug), ne(chatbots.id, id)),
        columns: { id: true },
      });

      // 자기 자신이 아닌 다른 챗봇이 해당 슬러그를 사용 중인지 확인
      if (existingChatbot && existingChatbot.id !== id) {
        return NextResponse.json(
          { error: '이미 사용 중인 슬러그입니다' },
          { status: 400 }
        );
      }

      // 활성화 + 슬러그 업데이트
      await db
        .update(chatbots)
        .set({
          publicPageEnabled: true,
          slug: targetSlug,
          updatedAt: new Date(),
        })
        .where(eq(chatbots.id, id));
    } else {
      // 비활성화 (슬러그는 유지)
      await db
        .update(chatbots)
        .set({
          publicPageEnabled: false,
          updatedAt: new Date(),
        })
        .where(eq(chatbots.id, id));
    }

    return NextResponse.json({
      message: enabled
        ? '공개 페이지가 활성화되었습니다'
        : '공개 페이지가 비활성화되었습니다',
    });
  } catch (error) {
    console.error('Toggle public page error:', error);
    return NextResponse.json(
      { error: '설정 변경 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/chatbots/:id/public-page
 * draft 버전 설정 업데이트
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await validateSession();
    if (!session) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 });
    }

    const { id } = await params;
    const tenantId = session.tenantId;

    // 챗봇 조회
    const [chatbot] = await db
      .select()
      .from(chatbots)
      .where(and(eq(chatbots.id, id), eq(chatbots.tenantId, tenantId)));

    if (!chatbot) {
      return NextResponse.json(
        { error: '챗봇을 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    // 요청 파싱
    const body = await request.json();
    const parseResult = updateSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: '잘못된 요청입니다', details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const { slug, config } = parseResult.data;

    // 슬러그 업데이트 검사
    if (slug !== undefined && slug !== null && slug !== chatbot.slug) {
      // 슬러그 유효성 검사 (DB 예약어 포함)
      const validation = await validateSlugAsync(slug);
      if (!validation.valid) {
        return NextResponse.json({ error: validation.error }, { status: 400 });
      }

      // 슬러그 중복 체크
      const existingChatbot = await db.query.chatbots.findFirst({
        where: eq(chatbots.slug, slug),
        columns: { id: true },
      });

      if (existingChatbot && existingChatbot.id !== id) {
        return NextResponse.json(
          { error: '이미 사용 중인 슬러그입니다' },
          { status: 400 }
        );
      }

      // chatbots 테이블의 slug 업데이트
      await db
        .update(chatbots)
        .set({
          slug,
          updatedAt: new Date(),
        })
        .where(eq(chatbots.id, id));
    }

    // draft 버전 조회 또는 생성
    const draftVersion = await getOrCreateDraftVersion(id, chatbot);

    // 기존 config와 병합
    const existingConfig = parsePublicPageConfig(draftVersion.publicPageConfig);
    const updatedConfig = config
      ? toPublicPageConfigJson({
          header: { ...existingConfig.header, ...config.header },
          theme: { ...existingConfig.theme, ...config.theme },
          seo: { ...existingConfig.seo, ...config.seo },
          // blocks는 전체 교체 (deep merge 아님)
          blocks: config.blocks ?? existingConfig.blocks,
        })
      : draftVersion.publicPageConfig;

    // draft 버전 업데이트
    await db
      .update(chatbotConfigVersions)
      .set({
        publicPageConfig: updatedConfig,
        updatedAt: new Date(),
      })
      .where(eq(chatbotConfigVersions.id, draftVersion.id));

    return NextResponse.json({
      message: '설정이 저장되었습니다',
    });
  } catch (error) {
    console.error('Update public page error:', error);
    return NextResponse.json(
      { error: '설정 저장 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
