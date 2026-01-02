/**
 * 공개 페이지 발행 API
 *
 * POST /api/chatbots/:id/public-page/publish
 * - 현재 저장된 설정을 공개 페이지에 발행합니다.
 * - 현재 구현에서는 자동 저장이 바로 반영되므로,
 *   발행은 공개 페이지 활성화 확인 및 성공 응답을 반환합니다.
 */

import { NextRequest, NextResponse } from 'next/server';
import { eq, and } from 'drizzle-orm';
import { db } from '@/lib/db';
import { chatbots } from '@/drizzle/schema';
import { validateSession } from '@/lib/auth/session';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/chatbots/:id/public-page/publish
 * 공개 페이지 발행
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
      .select({
        id: chatbots.id,
        name: chatbots.name,
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

    // 공개 페이지가 비활성화되어 있으면 발행 불가
    if (!chatbot.publicPageEnabled) {
      return NextResponse.json(
        { error: '공개 페이지가 활성화되어 있지 않습니다. 먼저 활성화해주세요.' },
        { status: 400 }
      );
    }

    // 슬러그가 없으면 발행 불가
    if (!chatbot.slug) {
      return NextResponse.json(
        { error: '공개 페이지 URL(슬러그)이 설정되어 있지 않습니다.' },
        { status: 400 }
      );
    }

    // 발행 시간 업데이트 (실제 발행 시점 기록)
    await db
      .update(chatbots)
      .set({
        updatedAt: new Date(),
      })
      .where(eq(chatbots.id, id));

    return NextResponse.json({
      message: '발행이 완료되었습니다',
      publicUrl: `/${chatbot.slug}`,
    });
  } catch (error) {
    console.error('Publish public page error:', error);
    return NextResponse.json(
      { error: '발행 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
