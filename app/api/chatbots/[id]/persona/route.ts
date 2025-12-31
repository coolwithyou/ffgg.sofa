/**
 * 챗봇 페르소나 API
 *
 * GET /api/chatbots/:id/persona - 페르소나 설정 조회
 * PATCH /api/chatbots/:id/persona - 페르소나 설정 수정
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { eq, and } from 'drizzle-orm';
import { db } from '@/lib/db';
import { chatbots } from '@/drizzle/schema';
import { validateSession } from '@/lib/auth/session';
import { DEFAULT_PERSONA } from '@/lib/chat/intent-classifier';

// 페르소나 수정 스키마
const updatePersonaSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  expertiseArea: z.string().min(1).max(500).optional(),
  tone: z.enum(['professional', 'friendly', 'casual']).optional(),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/chatbots/:id/persona - 페르소나 설정 조회
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
        personaConfig: chatbots.personaConfig,
      })
      .from(chatbots)
      .where(and(eq(chatbots.id, id), eq(chatbots.tenantId, tenantId)));

    if (!chatbot) {
      return NextResponse.json(
        { error: '챗봇을 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    // DB 값이 없으면 기본값 반환
    const personaConfig = chatbot.personaConfig
      ? { ...DEFAULT_PERSONA, ...(chatbot.personaConfig as object) }
      : DEFAULT_PERSONA;

    return NextResponse.json({ personaConfig });
  } catch (error) {
    console.error('Persona get error:', error);
    return NextResponse.json(
      { error: '페르소나 조회 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/chatbots/:id/persona - 페르소나 설정 수정
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
    const [existingChatbot] = await db
      .select({
        id: chatbots.id,
        personaConfig: chatbots.personaConfig,
      })
      .from(chatbots)
      .where(and(eq(chatbots.id, id), eq(chatbots.tenantId, tenantId)));

    if (!existingChatbot) {
      return NextResponse.json(
        { error: '챗봇을 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    // 요청 본문 파싱
    const body = await request.json();
    const parseResult = updatePersonaSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: '입력값이 올바르지 않습니다', details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const updateData = parseResult.data;

    // 기존 페르소나와 병합
    const updatedPersonaConfig = {
      ...(existingChatbot.personaConfig as object || {}),
      ...updateData,
    };

    // 챗봇 수정
    const [updatedChatbot] = await db
      .update(chatbots)
      .set({
        personaConfig: updatedPersonaConfig,
        updatedAt: new Date(),
      })
      .where(eq(chatbots.id, id))
      .returning({
        id: chatbots.id,
        personaConfig: chatbots.personaConfig,
      });

    return NextResponse.json({
      success: true,
      personaConfig: updatedPersonaConfig,
    });
  } catch (error) {
    console.error('Persona update error:', error);
    return NextResponse.json(
      { error: '페르소나 수정 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
