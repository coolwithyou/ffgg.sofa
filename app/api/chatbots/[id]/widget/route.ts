/**
 * 챗봇 위젯 API
 *
 * GET /api/chatbots/:id/widget - draft 위젯 설정 조회
 * POST /api/chatbots/:id/widget - 위젯 활성화/비활성화
 * PATCH /api/chatbots/:id/widget - draft 위젯 설정 수정
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { eq, and } from 'drizzle-orm';
import { db } from '@/lib/db';
import { chatbots, chatbotDatasets, chatbotConfigVersions } from '@/drizzle/schema';
import { validateSession } from '@/lib/auth/session';
import { nanoid } from 'nanoid';

// 위젯 활성화 스키마
const enableWidgetSchema = z.object({
  enabled: z.boolean(),
});

// 위젯 설정 수정 스키마
const updateWidgetConfigSchema = z.object({
  // 외관 설정
  primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  position: z.enum(['bottom-right', 'bottom-left']).optional(),
  // 헤더 텍스트 설정
  title: z.string().max(50).optional(),
  subtitle: z.string().max(100).optional(),
  // 텍스트 설정
  welcomeMessage: z.string().max(500).optional(),
  inputPlaceholder: z.string().max(100).optional(),
  // 브랜딩
  showBranding: z.boolean().optional(),
  customCss: z.string().max(5000).optional(),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * 새 위젯 API 키 생성
 */
function generateWidgetApiKey(): string {
  return `wgt_${nanoid(32)}`;
}

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
 * GET /api/chatbots/:id/widget - draft 위젯 설정 조회
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
        name: chatbots.name,
        widgetEnabled: chatbots.widgetEnabled,
        widgetApiKey: chatbots.widgetApiKey,
        widgetConfig: chatbots.widgetConfig,
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

    // draft 버전 조회 또는 생성
    const draftVersion = await getOrCreateDraftVersion(id, chatbot);

    // 연결된 데이터셋 수 확인
    const datasetLinks = await db
      .select()
      .from(chatbotDatasets)
      .where(eq(chatbotDatasets.chatbotId, id));

    return NextResponse.json({
      widget: {
        enabled: chatbot.widgetEnabled,
        apiKey: chatbot.widgetApiKey,
        config: draftVersion.widgetConfig, // draft 버전에서 조회
        hasDatasets: datasetLinks.length > 0,
        embedCode: chatbot.widgetEnabled && chatbot.widgetApiKey
          ? generateEmbedCode(chatbot.widgetApiKey)
          : null,
      },
    });
  } catch (error) {
    console.error('Widget get error:', error);
    return NextResponse.json(
      { error: '위젯 설정 조회 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/chatbots/:id/widget - 위젯 활성화/비활성화
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
      .select()
      .from(chatbots)
      .where(and(eq(chatbots.id, id), eq(chatbots.tenantId, tenantId)));

    if (!chatbot) {
      return NextResponse.json(
        { error: '챗봇을 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    // 요청 본문 파싱
    const body = await request.json();
    const parseResult = enableWidgetSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: '입력값이 올바르지 않습니다', details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const { enabled } = parseResult.data;

    // 활성화 시 데이터셋 연결 확인
    if (enabled) {
      const datasetLinks = await db
        .select()
        .from(chatbotDatasets)
        .where(eq(chatbotDatasets.chatbotId, id));

      if (datasetLinks.length === 0) {
        return NextResponse.json(
          { error: '위젯을 활성화하려면 먼저 데이터셋을 연결해주세요' },
          { status: 400 }
        );
      }
    }

    // API 키 생성 또는 유지
    const widgetApiKey = enabled
      ? (chatbot.widgetApiKey || generateWidgetApiKey())
      : chatbot.widgetApiKey;

    // 위젯 상태 업데이트
    const [updated] = await db
      .update(chatbots)
      .set({
        widgetEnabled: enabled,
        widgetApiKey,
        updatedAt: new Date(),
      })
      .where(eq(chatbots.id, id))
      .returning();

    return NextResponse.json({
      message: enabled ? '위젯이 활성화되었습니다' : '위젯이 비활성화되었습니다',
      widget: {
        enabled: updated.widgetEnabled,
        apiKey: updated.widgetApiKey,
        embedCode: enabled && updated.widgetApiKey
          ? generateEmbedCode(updated.widgetApiKey)
          : null,
      },
    });
  } catch (error) {
    console.error('Widget enable error:', error);
    return NextResponse.json(
      { error: '위젯 설정 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/chatbots/:id/widget - draft 위젯 설정 수정
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await validateSession();
    if (!session) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 });
    }

    const { id } = await params;
    const tenantId = session.tenantId;

    // 챗봇 존재 확인
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

    // 요청 본문 파싱
    const body = await request.json();
    const parseResult = updateWidgetConfigSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: '입력값이 올바르지 않습니다', details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const configUpdate = parseResult.data;

    // draft 버전 조회 또는 생성
    const draftVersion = await getOrCreateDraftVersion(id, chatbot);

    // 기존 설정과 병합
    const updatedConfig = {
      ...(draftVersion.widgetConfig as object || {}),
      ...configUpdate,
    };

    // draft 위젯 설정 업데이트
    await db
      .update(chatbotConfigVersions)
      .set({
        widgetConfig: updatedConfig,
        updatedAt: new Date(),
      })
      .where(eq(chatbotConfigVersions.id, draftVersion.id));

    return NextResponse.json({
      message: '위젯 설정이 수정되었습니다',
      config: updatedConfig,
    });
  } catch (error) {
    console.error('Widget config update error:', error);
    return NextResponse.json(
      { error: '위젯 설정 수정 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}

/**
 * 임베드 코드 생성
 */
function generateEmbedCode(apiKey: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://sofa.example.com';
  return `<script src="${baseUrl}/widget.js" data-api-key="${apiKey}" async></script>`;
}
