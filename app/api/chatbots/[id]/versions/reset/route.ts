/**
 * 버전 초기화 API
 *
 * POST /api/chatbots/:id/versions/reset - draft를 기본 설정으로 완전 초기화
 *
 * Free 플랜 사용자처럼 발행 기록이 없는 경우에도 사용 가능합니다.
 * revert는 published → draft 복원이지만, reset은 DEFAULT_CONFIG로 완전 초기화입니다.
 */

import { NextRequest, NextResponse } from 'next/server';
import { eq, and } from 'drizzle-orm';
import { db } from '@/lib/db';
import { chatbots, chatbotConfigVersions } from '@/drizzle/schema';
import { validateSession } from '@/lib/auth/session';
import { DEFAULT_PUBLIC_PAGE_CONFIG } from '@/lib/public-page/types';
import { DEFAULT_CONFIG as DEFAULT_WIDGET_CONFIG } from '@/lib/widget/types';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/chatbots/:id/versions/reset
 * draft를 기본 설정으로 완전 초기화
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
      .select({ id: chatbots.id, name: chatbots.name })
      .from(chatbots)
      .where(and(eq(chatbots.id, id), eq(chatbots.tenantId, tenantId)));

    if (!chatbot) {
      return NextResponse.json(
        { error: '챗봇을 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    // 기본 설정값 (챗봇 이름으로 제목 설정)
    const defaultPageConfig = {
      ...DEFAULT_PUBLIC_PAGE_CONFIG,
      header: {
        ...DEFAULT_PUBLIC_PAGE_CONFIG.header,
        title: chatbot.name,
      },
      seo: {
        ...DEFAULT_PUBLIC_PAGE_CONFIG.seo,
        title: chatbot.name,
      },
    };

    const defaultWidgetConfig = {
      ...DEFAULT_WIDGET_CONFIG,
      title: chatbot.name,
    };

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
      // draft 버전을 기본 설정으로 업데이트
      await db
        .update(chatbotConfigVersions)
        .set({
          publicPageConfig: defaultPageConfig,
          widgetConfig: defaultWidgetConfig,
          updatedAt: new Date(),
        })
        .where(eq(chatbotConfigVersions.id, draftVersion.id));
    } else {
      // draft가 없으면 새로 생성
      await db.insert(chatbotConfigVersions).values({
        chatbotId: id,
        versionType: 'draft',
        publicPageConfig: defaultPageConfig,
        widgetConfig: defaultWidgetConfig,
      });
    }

    return NextResponse.json({
      message: '모든 설정이 초기화되었습니다',
    });
  } catch (error) {
    console.error('Reset error:', error);
    return NextResponse.json(
      { error: '초기화 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
