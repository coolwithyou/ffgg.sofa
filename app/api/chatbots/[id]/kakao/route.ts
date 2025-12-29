/**
 * 챗봇 카카오 연동 API
 *
 * GET /api/chatbots/:id/kakao - 카카오 연동 설정 조회
 * POST /api/chatbots/:id/kakao - 카카오 연동 활성화/비활성화
 * PATCH /api/chatbots/:id/kakao - 카카오 연동 설정 수정
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { eq, and } from 'drizzle-orm';
import { db } from '@/lib/db';
import { chatbots, chatbotDatasets } from '@/drizzle/schema';
import { validateSession } from '@/lib/auth/session';

// 카카오 연동 스키마
const enableKakaoSchema = z.object({
  enabled: z.boolean(),
  botId: z.string().min(1).max(100).optional(), // 활성화 시 필수
});

// 카카오 설정 수정 스키마
const updateKakaoConfigSchema = z.object({
  // 스킬 설정
  skillUrl: z.string().url().optional(),
  skillTimeout: z.number().min(1000).max(30000).optional(),
  // 응답 설정
  useQuickReplies: z.boolean().optional(),
  maxButtons: z.number().min(1).max(5).optional(),
  // 폴백 메시지
  fallbackMessage: z.string().max(500).optional(),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/chatbots/:id/kakao - 카카오 연동 설정 조회
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
        kakaoEnabled: chatbots.kakaoEnabled,
        kakaoBotId: chatbots.kakaoBotId,
        kakaoConfig: chatbots.kakaoConfig,
      })
      .from(chatbots)
      .where(and(eq(chatbots.id, id), eq(chatbots.tenantId, tenantId)));

    if (!chatbot) {
      return NextResponse.json(
        { error: '챗봇을 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    // 연결된 데이터셋 수 확인
    const datasetLinks = await db
      .select()
      .from(chatbotDatasets)
      .where(eq(chatbotDatasets.chatbotId, id));

    // 스킬 서버 URL 생성
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://sofa.example.com';
    const skillUrl = `${baseUrl}/api/kakao/skill`;

    return NextResponse.json({
      kakao: {
        enabled: chatbot.kakaoEnabled,
        botId: chatbot.kakaoBotId,
        config: chatbot.kakaoConfig,
        hasDatasets: datasetLinks.length > 0,
        skillUrl,
        webhookInfo: chatbot.kakaoEnabled ? {
          url: skillUrl,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        } : null,
      },
    });
  } catch (error) {
    console.error('Kakao get error:', error);
    return NextResponse.json(
      { error: '카카오 설정 조회 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/chatbots/:id/kakao - 카카오 연동 활성화/비활성화
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
    const parseResult = enableKakaoSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: '입력값이 올바르지 않습니다', details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const { enabled, botId } = parseResult.data;

    // 활성화 시 검증
    if (enabled) {
      // 봇 ID 필수
      if (!botId && !chatbot.kakaoBotId) {
        return NextResponse.json(
          { error: '카카오 봇 ID가 필요합니다' },
          { status: 400 }
        );
      }

      // 데이터셋 연결 확인
      const datasetLinks = await db
        .select()
        .from(chatbotDatasets)
        .where(eq(chatbotDatasets.chatbotId, id));

      if (datasetLinks.length === 0) {
        return NextResponse.json(
          { error: '카카오를 연동하려면 먼저 데이터셋을 연결해주세요' },
          { status: 400 }
        );
      }

      // 봇 ID 중복 확인 (다른 챗봇에서 사용 중인지)
      const newBotId = botId || chatbot.kakaoBotId;
      if (newBotId) {
        const [existing] = await db
          .select()
          .from(chatbots)
          .where(
            and(
              eq(chatbots.kakaoBotId, newBotId),
              eq(chatbots.kakaoEnabled, true)
            )
          );

        if (existing && existing.id !== id) {
          return NextResponse.json(
            { error: '이 카카오 봇 ID는 이미 다른 챗봇에서 사용 중입니다' },
            { status: 400 }
          );
        }
      }
    }

    // 카카오 상태 업데이트
    const [updated] = await db
      .update(chatbots)
      .set({
        kakaoEnabled: enabled,
        kakaoBotId: enabled ? (botId || chatbot.kakaoBotId) : chatbot.kakaoBotId,
        updatedAt: new Date(),
      })
      .where(eq(chatbots.id, id))
      .returning();

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://sofa.example.com';

    return NextResponse.json({
      message: enabled ? '카카오 연동이 활성화되었습니다' : '카카오 연동이 비활성화되었습니다',
      kakao: {
        enabled: updated.kakaoEnabled,
        botId: updated.kakaoBotId,
        skillUrl: enabled ? `${baseUrl}/api/kakao/skill` : null,
      },
    });
  } catch (error) {
    console.error('Kakao enable error:', error);
    return NextResponse.json(
      { error: '카카오 설정 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/chatbots/:id/kakao - 카카오 연동 설정 수정
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
    const parseResult = updateKakaoConfigSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: '입력값이 올바르지 않습니다', details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const configUpdate = parseResult.data;

    // 기존 설정과 병합
    const updatedConfig = {
      ...(chatbot.kakaoConfig as object || {}),
      ...configUpdate,
    };

    // 카카오 설정 업데이트
    const [updated] = await db
      .update(chatbots)
      .set({
        kakaoConfig: updatedConfig,
        updatedAt: new Date(),
      })
      .where(eq(chatbots.id, id))
      .returning();

    return NextResponse.json({
      message: '카카오 설정이 수정되었습니다',
      config: updated.kakaoConfig,
    });
  } catch (error) {
    console.error('Kakao config update error:', error);
    return NextResponse.json(
      { error: '카카오 설정 수정 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
