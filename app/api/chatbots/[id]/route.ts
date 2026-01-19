/**
 * 챗봇 상세 API
 *
 * GET /api/chatbots/:id - 챗봇 상세 조회
 * PATCH /api/chatbots/:id - 챗봇 수정
 * DELETE /api/chatbots/:id - 챗봇 삭제
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { eq, and, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  chatbots,
  chatbotDatasets,
  datasets,
  conversations,
  knowledgePages,
} from '@/drizzle/schema';
import { validateSession } from '@/lib/auth/session';

// 챗봇 수정 스키마
// personaConfig: 사용자 편집 가능한 필드만 허용
// ragIndexConfig: AI 자동 생성 필드로, PATCH로 수정 불가
const updateChatbotSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional().nullable(),
  status: z.enum(['active', 'inactive']).optional(),
  llmConfig: z
    .object({
      temperature: z.number().min(0).max(2).optional(),
      maxTokens: z.number().min(100).max(4096).optional(),
      systemPrompt: z.string().max(2000).optional().nullable(),
    })
    .optional(),
  searchConfig: z
    .object({
      maxChunks: z.number().min(1).max(20).optional(),
      minScore: z.number().min(0).max(1).optional(),
    })
    .optional(),
  // 페르소나 설정 (사용자 편집 가능한 챗봇 성격/태도만)
  personaConfig: z
    .object({
      name: z.string().max(100).optional(),
      expertiseArea: z.string().max(200).optional(),
      expertiseDescription: z.string().max(500).optional(),
      tone: z.enum(['professional', 'friendly', 'casual']).optional(),
    })
    .optional(),
  // ragIndexConfig는 스키마에서 제외 (AI 자동 생성, 사용자 편집 불가)
  // 청킹 실험 설정 (A/B 테스트용)
  experimentConfig: z
    .object({
      chunkingStrategy: z
        .enum(['smart', 'semantic', 'late', 'auto'])
        .optional(),
      abTestEnabled: z.boolean().optional(),
      semanticTrafficPercent: z.number().min(0).max(100).optional(),
      experimentStartedAt: z.string().optional(),
      experimentEndedAt: z.string().optional(),
      experimentNote: z.string().max(500).optional(),
    })
    .optional(),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/chatbots/:id - 챗봇 상세 조회
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
      .select()
      .from(chatbots)
      .where(and(eq(chatbots.id, id), eq(chatbots.tenantId, tenantId)));

    if (!chatbot) {
      return NextResponse.json(
        { error: '챗봇을 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    // 연결된 데이터셋 조회
    const linkedDatasets = await db
      .select({
        id: datasets.id,
        name: datasets.name,
        description: datasets.description,
        documentCount: datasets.documentCount,
        chunkCount: datasets.chunkCount,
        status: datasets.status,
        weight: chatbotDatasets.weight,
      })
      .from(chatbotDatasets)
      .innerJoin(datasets, eq(chatbotDatasets.datasetId, datasets.id))
      .where(eq(chatbotDatasets.chatbotId, id));

    // 인덱싱된 Knowledge Pages (블로그) 수 조회
    const [knowledgePagesStats] = await db
      .select({
        indexedCount: sql<number>`count(*) FILTER (WHERE is_indexed = true)::int`,
        totalCount: sql<number>`count(*)::int`,
      })
      .from(knowledgePages)
      .where(eq(knowledgePages.chatbotId, id));

    // 대화 통계
    const [conversationStats] = await db
      .select({
        total: sql<number>`count(*)::int`,
        today: sql<number>`count(*) FILTER (WHERE created_at >= CURRENT_DATE)::int`,
        thisWeek: sql<number>`count(*) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '7 days')::int`,
        thisMonth: sql<number>`count(*) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '30 days')::int`,
      })
      .from(conversations)
      .where(eq(conversations.chatbotId, id));

    return NextResponse.json({
      chatbot: {
        ...chatbot,
        datasets: linkedDatasets,
        // RAG 인덱스 생성 가능 여부 판단용 (블로그 페이지 통계)
        indexedKnowledgePagesCount: knowledgePagesStats?.indexedCount ?? 0,
        totalKnowledgePagesCount: knowledgePagesStats?.totalCount ?? 0,
        stats: {
          datasetCount: linkedDatasets.length,
          conversations: conversationStats || {
            total: 0,
            today: 0,
            thisWeek: 0,
            thisMonth: 0,
          },
        },
      },
    });
  } catch (error) {
    console.error('Chatbot get error:', error);
    return NextResponse.json(
      { error: '챗봇 조회 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/chatbots/:id - 챗봇 수정
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
      .select()
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
    const parseResult = updateChatbotSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: '입력값이 올바르지 않습니다', details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const updateData = parseResult.data;

    // 기본 챗봇은 비활성화할 수 없음
    if (existingChatbot.isDefault && updateData.status === 'inactive') {
      return NextResponse.json(
        { error: '기본 챗봇은 비활성화할 수 없습니다' },
        { status: 400 }
      );
    }

    // LLM/검색/페르소나 설정 병합
    const updatedLlmConfig = updateData.llmConfig
      ? { ...(existingChatbot.llmConfig as object), ...updateData.llmConfig }
      : existingChatbot.llmConfig;

    const updatedSearchConfig = updateData.searchConfig
      ? { ...(existingChatbot.searchConfig as object), ...updateData.searchConfig }
      : existingChatbot.searchConfig;

    const updatedPersonaConfig = updateData.personaConfig
      ? { ...(existingChatbot.personaConfig as object), ...updateData.personaConfig }
      : existingChatbot.personaConfig;

    // 실험 설정 병합 (Phase 5: A/B 테스트용)
    const updatedExperimentConfig = updateData.experimentConfig
      ? { ...(existingChatbot.experimentConfig as object), ...updateData.experimentConfig }
      : existingChatbot.experimentConfig;

    // 챗봇 수정
    const [updatedChatbot] = await db
      .update(chatbots)
      .set({
        name: updateData.name ?? existingChatbot.name,
        description: updateData.description !== undefined ? updateData.description : existingChatbot.description,
        status: updateData.status ?? existingChatbot.status,
        llmConfig: updatedLlmConfig,
        searchConfig: updatedSearchConfig,
        personaConfig: updatedPersonaConfig,
        experimentConfig: updatedExperimentConfig,
        updatedAt: new Date(),
      })
      .where(eq(chatbots.id, id))
      .returning();

    return NextResponse.json({
      message: '챗봇이 수정되었습니다',
      chatbot: updatedChatbot,
    });
  } catch (error) {
    console.error('Chatbot update error:', error);
    return NextResponse.json(
      { error: '챗봇 수정 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/chatbots/:id - 챗봇 삭제
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await validateSession();
    if (!session) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 });
    }

    const { id } = await params;
    const tenantId = session.tenantId;

    // 챗봇 존재 확인
    const [existingChatbot] = await db
      .select()
      .from(chatbots)
      .where(and(eq(chatbots.id, id), eq(chatbots.tenantId, tenantId)));

    if (!existingChatbot) {
      return NextResponse.json(
        { error: '챗봇을 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    // 기본 챗봇은 삭제할 수 없음
    if (existingChatbot.isDefault) {
      return NextResponse.json(
        { error: '기본 챗봇은 삭제할 수 없습니다' },
        { status: 400 }
      );
    }

    // 챗봇 삭제 (CASCADE로 chatbot_datasets도 함께 삭제)
    await db.delete(chatbots).where(eq(chatbots.id, id));

    return NextResponse.json({
      message: '챗봇이 삭제되었습니다',
    });
  } catch (error) {
    console.error('Chatbot delete error:', error);
    return NextResponse.json(
      { error: '챗봇 삭제 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
