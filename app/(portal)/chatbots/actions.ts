/**
 * 챗봇 관리 서버 액션
 */

'use server';

import { revalidatePath } from 'next/cache';
import { validateSession } from '@/lib/auth/session';
import { db, chatbots, chatbotDatasets, datasets } from '@/lib/db';
import { eq, and, desc, sql } from 'drizzle-orm';

export interface ChatbotSummary {
  id: string;
  name: string;
  description: string | null;
  status: string;
  isDefault: boolean;
  widgetEnabled: boolean;
  kakaoEnabled: boolean;
  datasetCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface DatasetOption {
  id: string;
  name: string;
  documentCount: number;
}

/**
 * 챗봇 목록 조회
 */
export async function getChatbots(): Promise<ChatbotSummary[]> {
  const session = await validateSession();
  if (!session) {
    return [];
  }

  const result = await db
    .select({
      id: chatbots.id,
      name: chatbots.name,
      description: chatbots.description,
      status: chatbots.status,
      isDefault: chatbots.isDefault,
      widgetEnabled: chatbots.widgetEnabled,
      kakaoEnabled: chatbots.kakaoEnabled,
      createdAt: chatbots.createdAt,
      updatedAt: chatbots.updatedAt,
      datasetCount: sql<number>`(
        SELECT COUNT(*)::int FROM chatbot_datasets
        WHERE chatbot_datasets.chatbot_id = chatbots.id
      )`,
    })
    .from(chatbots)
    .where(eq(chatbots.tenantId, session.tenantId))
    .orderBy(desc(chatbots.isDefault), desc(chatbots.createdAt));

  return result.map((c) => ({
    id: c.id,
    name: c.name,
    description: c.description,
    status: c.status || 'active',
    isDefault: c.isDefault || false,
    widgetEnabled: c.widgetEnabled || false,
    kakaoEnabled: c.kakaoEnabled || false,
    datasetCount: c.datasetCount || 0,
    createdAt: c.createdAt || new Date(),
    updatedAt: c.updatedAt || new Date(),
  }));
}

/**
 * 데이터셋 옵션 목록 조회 (챗봇에 연결할 데이터셋 선택용)
 */
export async function getDatasetOptions(): Promise<DatasetOption[]> {
  const session = await validateSession();
  if (!session) {
    return [];
  }

  const result = await db
    .select({
      id: datasets.id,
      name: datasets.name,
      documentCount: datasets.documentCount,
    })
    .from(datasets)
    .where(and(eq(datasets.tenantId, session.tenantId), eq(datasets.status, 'active')))
    .orderBy(desc(datasets.isDefault), datasets.name);

  return result.map((d) => ({
    id: d.id,
    name: d.name,
    documentCount: d.documentCount || 0,
  }));
}

/**
 * 챗봇 생성
 *
 * 챗봇 생성 시 기본 데이터셋을 자동으로 생성하고 연결합니다.
 * 이를 통해 일반 사용자는 "데이터셋" 개념 없이 바로 문서를 업로드할 수 있습니다.
 *
 * @param data.name - 챗봇 이름
 * @param data.description - 챗봇 설명 (선택)
 * @returns 생성된 챗봇 ID 및 데이터셋 ID
 */
export async function createChatbot(data: {
  name: string;
  description?: string;
}): Promise<{
  success: boolean;
  error?: string;
  chatbotId?: string;
  datasetId?: string;
}> {
  const session = await validateSession();
  if (!session) {
    return { success: false, error: '인증이 필요합니다.' };
  }

  try {
    // 1. 챗봇 생성
    const [newChatbot] = await db
      .insert(chatbots)
      .values({
        tenantId: session.tenantId,
        name: data.name,
        description: data.description || null,
      })
      .returning();

    // 2. 기본 데이터셋 생성 (챗봇과 1:1 매핑)
    const datasetName = `${data.name} 데이터셋`;
    const [newDataset] = await db
      .insert(datasets)
      .values({
        tenantId: session.tenantId,
        name: datasetName,
        description: `${data.name} 챗봇의 기본 데이터셋`,
        isDefault: true,
      })
      .returning();

    // 3. 챗봇-데이터셋 연결
    await db.insert(chatbotDatasets).values({
      chatbotId: newChatbot.id,
      datasetId: newDataset.id,
      weight: 1.0,
    });

    revalidatePath('/chatbots');
    return {
      success: true,
      chatbotId: newChatbot.id,
      datasetId: newDataset.id,
    };
  } catch (error) {
    console.error('Chatbot creation error:', error);
    return { success: false, error: '챗봇 생성 중 오류가 발생했습니다.' };
  }
}

/**
 * 챗봇 수정
 */
export async function updateChatbot(
  id: string,
  data: { name?: string; description?: string; status?: 'active' | 'inactive' }
): Promise<{ success: boolean; error?: string }> {
  const session = await validateSession();
  if (!session) {
    return { success: false, error: '인증이 필요합니다.' };
  }

  try {
    const [existing] = await db
      .select()
      .from(chatbots)
      .where(and(eq(chatbots.id, id), eq(chatbots.tenantId, session.tenantId)));

    if (!existing) {
      return { success: false, error: '챗봇을 찾을 수 없습니다.' };
    }

    // 기본 챗봇은 비활성화 불가
    if (existing.isDefault && data.status === 'inactive') {
      return { success: false, error: '기본 챗봇은 비활성화할 수 없습니다.' };
    }

    await db
      .update(chatbots)
      .set({
        name: data.name ?? existing.name,
        description: data.description !== undefined ? data.description : existing.description,
        status: data.status ?? existing.status,
        updatedAt: new Date(),
      })
      .where(eq(chatbots.id, id));

    revalidatePath('/chatbots');
    return { success: true };
  } catch (error) {
    console.error('Chatbot update error:', error);
    return { success: false, error: '챗봇 수정 중 오류가 발생했습니다.' };
  }
}

/**
 * 챗봇 삭제
 */
export async function deleteChatbot(
  id: string
): Promise<{ success: boolean; error?: string }> {
  const session = await validateSession();
  if (!session) {
    return { success: false, error: '인증이 필요합니다.' };
  }

  try {
    const [existing] = await db
      .select()
      .from(chatbots)
      .where(and(eq(chatbots.id, id), eq(chatbots.tenantId, session.tenantId)));

    if (!existing) {
      return { success: false, error: '챗봇을 찾을 수 없습니다.' };
    }

    if (existing.isDefault) {
      return { success: false, error: '기본 챗봇은 삭제할 수 없습니다.' };
    }

    await db.delete(chatbots).where(eq(chatbots.id, id));

    revalidatePath('/chatbots');
    return { success: true };
  } catch (error) {
    console.error('Chatbot delete error:', error);
    return { success: false, error: '챗봇 삭제 중 오류가 발생했습니다.' };
  }
}

/**
 * 챗봇에 연결된 데이터셋 목록 조회
 */
export async function getChatbotDatasets(
  chatbotId: string
): Promise<{ id: string; name: string; weight: number }[]> {
  const session = await validateSession();
  if (!session) {
    return [];
  }

  const result = await db
    .select({
      id: datasets.id,
      name: datasets.name,
      weight: chatbotDatasets.weight,
    })
    .from(chatbotDatasets)
    .innerJoin(datasets, eq(chatbotDatasets.datasetId, datasets.id))
    .where(eq(chatbotDatasets.chatbotId, chatbotId));

  return result.map((r) => ({
    id: r.id,
    name: r.name,
    weight: r.weight || 1.0,
  }));
}

/**
 * 챗봇에 데이터셋 연결
 */
export async function linkDatasetToChatbot(
  chatbotId: string,
  datasetId: string
): Promise<{ success: boolean; error?: string }> {
  const session = await validateSession();
  if (!session) {
    return { success: false, error: '인증이 필요합니다.' };
  }

  try {
    // 챗봇 소유권 확인
    const [chatbot] = await db
      .select()
      .from(chatbots)
      .where(and(eq(chatbots.id, chatbotId), eq(chatbots.tenantId, session.tenantId)));

    if (!chatbot) {
      return { success: false, error: '챗봇을 찾을 수 없습니다.' };
    }

    // 데이터셋 소유권 확인
    const [dataset] = await db
      .select()
      .from(datasets)
      .where(and(eq(datasets.id, datasetId), eq(datasets.tenantId, session.tenantId)));

    if (!dataset) {
      return { success: false, error: '데이터셋을 찾을 수 없습니다.' };
    }

    // 이미 연결되어 있는지 확인
    const [existing] = await db
      .select()
      .from(chatbotDatasets)
      .where(
        and(
          eq(chatbotDatasets.chatbotId, chatbotId),
          eq(chatbotDatasets.datasetId, datasetId)
        )
      );

    if (existing) {
      return { success: false, error: '이미 연결된 데이터셋입니다.' };
    }

    await db.insert(chatbotDatasets).values({
      chatbotId,
      datasetId,
    });

    revalidatePath('/chatbots');
    return { success: true };
  } catch (error) {
    console.error('Link dataset error:', error);
    return { success: false, error: '데이터셋 연결 중 오류가 발생했습니다.' };
  }
}

/**
 * 챗봇에서 데이터셋 연결 해제
 */
export async function unlinkDatasetFromChatbot(
  chatbotId: string,
  datasetId: string
): Promise<{ success: boolean; error?: string }> {
  const session = await validateSession();
  if (!session) {
    return { success: false, error: '인증이 필요합니다.' };
  }

  try {
    await db
      .delete(chatbotDatasets)
      .where(
        and(
          eq(chatbotDatasets.chatbotId, chatbotId),
          eq(chatbotDatasets.datasetId, datasetId)
        )
      );

    revalidatePath('/chatbots');
    return { success: true };
  } catch (error) {
    console.error('Unlink dataset error:', error);
    return { success: false, error: '데이터셋 연결 해제 중 오류가 발생했습니다.' };
  }
}
