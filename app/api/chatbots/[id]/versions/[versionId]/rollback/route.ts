/**
 * 버전 롤백 API
 *
 * POST /api/chatbots/:id/versions/:versionId/rollback - 특정 히스토리 버전으로 draft 복원
 */

import { NextRequest, NextResponse } from 'next/server';
import { eq, and } from 'drizzle-orm';
import { db } from '@/lib/db';
import { chatbots, chatbotConfigVersions } from '@/drizzle/schema';
import { validateSession } from '@/lib/auth/session';

interface RouteParams {
  params: Promise<{ id: string; versionId: string }>;
}

/**
 * POST /api/chatbots/:id/versions/:versionId/rollback
 * 특정 히스토리 버전으로 draft 복원
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await validateSession();
    if (!session) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 });
    }

    const { id, versionId } = await params;
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

    // 히스토리 버전 조회
    const [historyVersion] = await db
      .select()
      .from(chatbotConfigVersions)
      .where(
        and(
          eq(chatbotConfigVersions.id, versionId),
          eq(chatbotConfigVersions.chatbotId, id),
          eq(chatbotConfigVersions.versionType, 'history')
        )
      );

    if (!historyVersion) {
      return NextResponse.json(
        { error: '해당 히스토리 버전을 찾을 수 없습니다' },
        { status: 404 }
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
      // draft 버전을 히스토리 내용으로 업데이트
      await db
        .update(chatbotConfigVersions)
        .set({
          publicPageConfig: historyVersion.publicPageConfig,
          widgetConfig: historyVersion.widgetConfig,
          updatedAt: new Date(),
        })
        .where(eq(chatbotConfigVersions.id, draftVersion.id));
    } else {
      // draft가 없으면 새로 생성
      await db.insert(chatbotConfigVersions).values({
        chatbotId: id,
        versionType: 'draft',
        publicPageConfig: historyVersion.publicPageConfig,
        widgetConfig: historyVersion.widgetConfig,
      });
    }

    return NextResponse.json({
      message: `버전 ${historyVersion.versionNumber}로 복원했습니다`,
      restoredVersion: historyVersion.versionNumber,
    });
  } catch (error) {
    console.error('Rollback error:', error);
    return NextResponse.json(
      { error: '롤백 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
