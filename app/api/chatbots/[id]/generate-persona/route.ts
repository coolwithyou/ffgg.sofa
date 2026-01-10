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
      .select({
        id: chatbots.id,
        personaConfig: chatbots.personaConfig,
        ragIndexConfig: chatbots.ragIndexConfig,
      })
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

    // 결과를 두 config으로 분리 저장
    // personaConfig: 사용자 편집 가능한 챗봇 성격/태도
    // ragIndexConfig: AI 자동 생성, 사용자 편집 불가 (RAG 검색 트리거)
    const now = new Date().toISOString();

    const existingPersonaConfig = (chatbot.personaConfig as object) || {};
    const updatedPersonaConfig = {
      ...existingPersonaConfig,
      // AI가 생성한 페르소나 필드 (사용자도 편집 가능)
      name: (existingPersonaConfig as { name?: string }).name || generatedPersona.name,
      expertiseArea: generatedPersona.expertiseArea,
      expertiseDescription: generatedPersona.expertiseDescription,
      tone: generatedPersona.tone,
    };

    // RAG 인덱스 설정 (AI 전용, 사용자 편집 불가)
    const updatedRagIndexConfig = {
      keywords: generatedPersona.keywords,
      includedTopics: generatedPersona.includedTopics,
      excludedTopics: generatedPersona.excludedTopics,
      confidence: generatedPersona.confidence,
      lastGeneratedAt: now,
      // 실제 분석된 청크/문서 수 저장
      chunkSampleCount: generatedPersona.analyzedChunkCount,
      documentSampleCount: generatedPersona.analyzedDocumentCount,
    };

    await db
      .update(chatbots)
      .set({
        personaConfig: updatedPersonaConfig,
        ragIndexConfig: updatedRagIndexConfig,
        updatedAt: new Date(),
      })
      .where(eq(chatbots.id, id));

    return NextResponse.json({
      success: true,
      persona: updatedPersonaConfig,
      ragIndex: updatedRagIndexConfig,
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
