/**
 * 챗봇 버전 관리 API
 *
 * GET /api/chatbots/:id/versions - 버전 목록 조회 (draft, published, history)
 */

import { NextRequest, NextResponse } from 'next/server';
import { eq, and, desc } from 'drizzle-orm';
import { db } from '@/lib/db';
import { chatbots, chatbotConfigVersions, users } from '@/drizzle/schema';
import { validateSession } from '@/lib/auth/session';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/chatbots/:id/versions
 * 버전 목록 조회 (draft, published, history)
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
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

    // 버전 목록 조회
    const versions = await db
      .select({
        id: chatbotConfigVersions.id,
        versionType: chatbotConfigVersions.versionType,
        publicPageConfig: chatbotConfigVersions.publicPageConfig,
        widgetConfig: chatbotConfigVersions.widgetConfig,
        publishedAt: chatbotConfigVersions.publishedAt,
        publishNote: chatbotConfigVersions.publishNote,
        versionNumber: chatbotConfigVersions.versionNumber,
        createdAt: chatbotConfigVersions.createdAt,
        updatedAt: chatbotConfigVersions.updatedAt,
        publishedByName: users.name,
        publishedByEmail: users.email,
      })
      .from(chatbotConfigVersions)
      .leftJoin(users, eq(chatbotConfigVersions.publishedBy, users.id))
      .where(eq(chatbotConfigVersions.chatbotId, id))
      .orderBy(desc(chatbotConfigVersions.publishedAt));

    // 버전 타입별 분류
    const draft = versions.find((v) => v.versionType === 'draft');
    const published = versions.find((v) => v.versionType === 'published');
    const history = versions
      .filter((v) => v.versionType === 'history')
      .sort((a, b) => {
        // versionNumber 기준 내림차순
        return (b.versionNumber ?? 0) - (a.versionNumber ?? 0);
      });

    // draft와 published 비교하여 변경 여부 확인
    const hasChanges = draft && published
      ? JSON.stringify(draft.publicPageConfig) !== JSON.stringify(published.publicPageConfig) ||
        JSON.stringify(draft.widgetConfig) !== JSON.stringify(published.widgetConfig)
      : !!draft; // published가 없으면 draft가 있으면 변경됨으로 처리

    return NextResponse.json({
      versions: {
        draft: draft
          ? {
              id: draft.id,
              publicPageConfig: draft.publicPageConfig,
              widgetConfig: draft.widgetConfig,
              updatedAt: draft.updatedAt,
            }
          : null,
        published: published
          ? {
              id: published.id,
              publicPageConfig: published.publicPageConfig,
              widgetConfig: published.widgetConfig,
              publishedAt: published.publishedAt,
              publishNote: published.publishNote,
              versionNumber: published.versionNumber,
              publishedBy: published.publishedByName || published.publishedByEmail,
            }
          : null,
        history: history.map((h) => ({
          id: h.id,
          versionNumber: h.versionNumber,
          publishedAt: h.publishedAt,
          publishNote: h.publishNote,
          publishedBy: h.publishedByName || h.publishedByEmail,
        })),
      },
      hasChanges,
    });
  } catch (error) {
    console.error('Versions get error:', error);
    return NextResponse.json(
      { error: '버전 조회 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
