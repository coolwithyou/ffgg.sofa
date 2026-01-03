/**
 * AI 페르소나 자동 생성 API
 *
 * POST /api/chatbots/:id/generate-persona
 * 연결된 데이터셋의 문서를 분석하여 페르소나를 자동 생성하고 DB에 저장합니다.
 */

import { NextRequest, NextResponse } from 'next/server';
import { eq, and } from 'drizzle-orm';
import { db } from '@/lib/db';
import { chatbots } from '@/drizzle/schema';
import { validateSession } from '@/lib/auth/session';
import { generatePersonaFromDocuments } from '@/lib/chat/persona-generator';
import type { GeneratedPersona } from '@/lib/chat/persona-generator';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/chatbots/:id/generate-persona
 * AI로 페르소나 자동 생성
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
      .select({ id: chatbots.id, personaConfig: chatbots.personaConfig })
      .from(chatbots)
      .where(and(eq(chatbots.id, id), eq(chatbots.tenantId, tenantId)));

    if (!chatbot) {
      return NextResponse.json(
        { error: '챗봇을 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    // 페르소나 자동 생성
    const generatedPersona = await generatePersonaFromDocuments(id, {
      tenantId,
      sampleSize: 50,
    });

    // 생성된 페르소나를 DB에 저장 (기존 설정과 병합)
    const existingPersonaConfig = (chatbot.personaConfig as object) || {};
    const updatedPersonaConfig = {
      ...existingPersonaConfig,
      ...generatedPersona,
      lastGeneratedAt: new Date().toISOString(),
    };

    await db
      .update(chatbots)
      .set({
        personaConfig: updatedPersonaConfig,
        updatedAt: new Date(),
      })
      .where(eq(chatbots.id, id));

    return NextResponse.json({
      success: true,
      persona: updatedPersonaConfig,
    });
  } catch (error) {
    // 사용자 친화적 에러 메시지 반환
    const errorMessage =
      error instanceof Error
        ? error.message
        : '페르소나 생성 중 오류가 발생했습니다';

    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 400 }
    );
  }
}
