/**
 * 공개 페이지 설정 API
 *
 * GET /api/chatbots/:id/public-page - 설정 조회
 * POST /api/chatbots/:id/public-page - 활성화/비활성화 토글
 * PATCH /api/chatbots/:id/public-page - 설정 업데이트
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { eq, and, ne } from 'drizzle-orm';
import { db } from '@/lib/db';
import { chatbots } from '@/drizzle/schema';
import { validateSession } from '@/lib/auth/session';
import { validateSlug } from '@/lib/public-page/reserved-slugs';
import {
  parsePublicPageConfig,
  toPublicPageConfigJson,
  DEFAULT_PUBLIC_PAGE_CONFIG,
} from '@/lib/public-page/types';

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
          backgroundColor: z.string().optional(),
          primaryColor: z.string().optional(),
          textColor: z.string().optional(),
        })
        .optional(),
      seo: z
        .object({
          title: z.string().optional(),
          description: z.string().optional(),
          ogImage: z.string().optional(),
        })
        .optional(),
    })
    .optional(),
});

/**
 * GET /api/chatbots/:id/public-page
 * 공개 페이지 설정 조회
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
      })
      .from(chatbots)
      .where(and(eq(chatbots.id, id), eq(chatbots.tenantId, tenantId)));

    if (!chatbot) {
      return NextResponse.json(
        { error: '챗봇을 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    // config 파싱
    const config = parsePublicPageConfig(chatbot.publicPageConfig);

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

      // 슬러그 유효성 검사
      const validation = validateSlug(targetSlug);
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
 * 공개 페이지 설정 업데이트
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
      // 슬러그 유효성 검사
      const validation = validateSlug(slug);
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
    }

    // 기존 config와 병합
    const existingConfig = parsePublicPageConfig(chatbot.publicPageConfig);
    const updatedConfig = config
      ? toPublicPageConfigJson({
          header: { ...existingConfig.header, ...config.header },
          theme: { ...existingConfig.theme, ...config.theme },
          seo: { ...existingConfig.seo, ...config.seo },
        })
      : chatbot.publicPageConfig;

    // 업데이트
    await db
      .update(chatbots)
      .set({
        slug: slug !== undefined ? slug : chatbot.slug,
        publicPageConfig: updatedConfig,
        updatedAt: new Date(),
      })
      .where(eq(chatbots.id, id));

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
