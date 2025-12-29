/**
 * 챗봇 API
 *
 * POST /api/chatbots - 챗봇 생성
 * GET /api/chatbots - 챗봇 목록 조회
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { eq, desc, and, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { chatbots, chatbotDatasets, datasets, conversations } from '@/drizzle/schema';
import { validateSession } from '@/lib/auth/session';
import { canCreateChatbot } from '@/lib/tier/validator';

// 챗봇 생성 스키마
const createChatbotSchema = z.object({
  name: z.string().min(1, '이름을 입력해주세요').max(100, '이름은 100자 이내로 입력해주세요'),
  description: z.string().max(500, '설명은 500자 이내로 입력해주세요').optional(),
  datasetIds: z.array(z.string().uuid()).optional(), // 연결할 데이터셋 ID 목록
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
});

/**
 * POST /api/chatbots - 챗봇 생성
 */
export async function POST(request: NextRequest) {
  try {
    const session = await validateSession();
    if (!session) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 });
    }

    const tenantId = session.tenantId;

    // 티어 제한 확인
    const { allowed, reason, limit } = await canCreateChatbot(tenantId);
    if (!allowed) {
      return NextResponse.json(
        {
          error: reason,
          limit: {
            current: limit.current,
            max: limit.max,
          },
        },
        { status: 403 }
      );
    }

    // 요청 본문 파싱
    const body = await request.json();
    const parseResult = createChatbotSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: '입력값이 올바르지 않습니다', details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const { name, description, datasetIds, llmConfig, searchConfig } = parseResult.data;

    // 데이터셋 ID 검증 (존재하고 해당 테넌트 소유인지)
    if (datasetIds && datasetIds.length > 0) {
      const validDatasets = await db
        .select({ id: datasets.id })
        .from(datasets)
        .where(
          and(
            eq(datasets.tenantId, tenantId),
            sql`${datasets.id} = ANY(${datasetIds}::uuid[])`
          )
        );

      if (validDatasets.length !== datasetIds.length) {
        return NextResponse.json(
          { error: '유효하지 않은 데이터셋이 포함되어 있습니다' },
          { status: 400 }
        );
      }
    }

    // 챗봇 생성
    const [newChatbot] = await db
      .insert(chatbots)
      .values({
        tenantId,
        name,
        description,
        isDefault: false,
        llmConfig: llmConfig || { temperature: 0.7, maxTokens: 1024, systemPrompt: null },
        searchConfig: searchConfig || { maxChunks: 5, minScore: 0.5 },
      })
      .returning();

    // 데이터셋 연결
    if (datasetIds && datasetIds.length > 0) {
      await db.insert(chatbotDatasets).values(
        datasetIds.map((datasetId) => ({
          chatbotId: newChatbot.id,
          datasetId,
        }))
      );
    }

    return NextResponse.json(
      {
        message: '챗봇이 생성되었습니다',
        chatbot: newChatbot,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Chatbot creation error:', error);
    return NextResponse.json(
      { error: '챗봇 생성 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/chatbots - 챗봇 목록 조회
 */
export async function GET(request: NextRequest) {
  try {
    const session = await validateSession();
    if (!session) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 });
    }

    const tenantId = session.tenantId;

    // URL 파라미터 파싱
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status'); // active, inactive, all
    const includeStats = searchParams.get('includeStats') === 'true';

    // 조건 구성
    const conditions = [eq(chatbots.tenantId, tenantId)];
    if (status && status !== 'all') {
      conditions.push(eq(chatbots.status, status));
    }

    // 챗봇 목록 조회
    const chatbotList = await db
      .select()
      .from(chatbots)
      .where(and(...conditions))
      .orderBy(desc(chatbots.isDefault), desc(chatbots.createdAt));

    // 통계 포함 옵션
    if (includeStats) {
      const chatbotsWithStats = await Promise.all(
        chatbotList.map(async (chatbot) => {
          // 연결된 데이터셋 수
          const [datasetCount] = await db
            .select({ count: sql<number>`count(*)::int` })
            .from(chatbotDatasets)
            .where(eq(chatbotDatasets.chatbotId, chatbot.id));

          // 대화 수
          const [conversationCount] = await db
            .select({ count: sql<number>`count(*)::int` })
            .from(conversations)
            .where(eq(conversations.chatbotId, chatbot.id));

          return {
            ...chatbot,
            stats: {
              datasetCount: datasetCount?.count || 0,
              conversationCount: conversationCount?.count || 0,
            },
          };
        })
      );

      return NextResponse.json({ chatbots: chatbotsWithStats });
    }

    return NextResponse.json({ chatbots: chatbotList });
  } catch (error) {
    console.error('Chatbot list error:', error);
    return NextResponse.json(
      { error: '챗봇 목록 조회 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
