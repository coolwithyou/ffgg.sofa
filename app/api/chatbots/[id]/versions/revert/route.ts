/**
 * 버전 되돌리기 API
 *
 * POST /api/chatbots/:id/versions/revert - draft를 현재 published 버전으로 되돌리기
 */

import { NextRequest, NextResponse } from 'next/server';
import { eq, and } from 'drizzle-orm';
import { db } from '@/lib/db';
import { chatbots, chatbotConfigVersions } from '@/drizzle/schema';
import { validateSession } from '@/lib/auth/session';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/chatbots/:id/versions/revert
 * draft를 현재 published 버전으로 되돌리기
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await validateSession();
    if (!session) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 });
    }

    const { id } = await params;
    const tenantId = session.tenantId;

    // 챗봇 존재 확인
    const [chatbot] = await db
      .select({ id: chatbots.id })
      .from(chatbots)
      .where(and(eq(chatbots.id, id), eq(chatbots.tenantId, tenantId)));

    if (!chatbot) {
      return NextResponse.json(
        { error: '챗봇을 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    // 현재 published 버전 조회
    const [publishedVersion] = await db
      .select()
      .from(chatbotConfigVersions)
      .where(
        and(
          eq(chatbotConfigVersions.chatbotId, id),
          eq(chatbotConfigVersions.versionType, 'published')
        )
      );

    if (!publishedVersion) {
      return NextResponse.json(
        { error: '되돌릴 발행 버전이 없습니다' },
        { status: 400 }
      );
    }

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

    if (draftVersion) {
      // draft 버전을 published 내용으로 업데이트
      await db
        .update(chatbotConfigVersions)
        .set({
          publicPageConfig: publishedVersion.publicPageConfig,
          widgetConfig: publishedVersion.widgetConfig,
          updatedAt: new Date(),
        })
        .where(eq(chatbotConfigVersions.id, draftVersion.id));
    } else {
      // draft가 없으면 새로 생성
      await db.insert(chatbotConfigVersions).values({
        chatbotId: id,
        versionType: 'draft',
        publicPageConfig: publishedVersion.publicPageConfig,
        widgetConfig: publishedVersion.widgetConfig,
      });
    }

    return NextResponse.json({
      message: '발행된 버전으로 되돌렸습니다',
    });
  } catch (error) {
    console.error('Revert error:', error);
    return NextResponse.json(
      { error: '되돌리기 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
