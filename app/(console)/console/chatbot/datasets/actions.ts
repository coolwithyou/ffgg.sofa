/**
 * 데이터셋 관리 서버 액션
 * Console 마이그레이션 - revalidatePath 경로 업데이트
 */

'use server';

import { revalidatePath } from 'next/cache';
import { validateSession } from '@/lib/auth/session';
import { db, datasets, chatbotDatasets } from '@/lib/db';
import { eq, and, desc } from 'drizzle-orm';
import { triggerRagIndexGeneration } from '@/lib/chat/rag-index-generator';
import { logger } from '@/lib/logger';

export interface DatasetSummary {
  id: string;
  name: string;
  description: string | null;
  documentCount: number;
  chunkCount: number;
  status: string;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 데이터셋 목록 조회
 */
export async function getDatasets(): Promise<DatasetSummary[]> {
  const session = await validateSession();
  if (!session) {
    return [];
  }

  const result = await db
    .select()
    .from(datasets)
    .where(eq(datasets.tenantId, session.tenantId))
    .orderBy(desc(datasets.isDefault), desc(datasets.createdAt));

  return result.map((d) => ({
    id: d.id,
    name: d.name,
    description: d.description,
    documentCount: d.documentCount || 0,
    chunkCount: d.chunkCount || 0,
    status: d.status || 'active',
    isDefault: d.isDefault || false,
    createdAt: d.createdAt || new Date(),
    updatedAt: d.updatedAt || new Date(),
  }));
}

/**
 * 데이터셋 생성
 */
export async function createDataset(data: {
  name: string;
  description?: string;
}): Promise<{ success: boolean; error?: string; datasetId?: string }> {
  const session = await validateSession();
  if (!session) {
    return { success: false, error: '인증이 필요합니다.' };
  }

  try {
    const [newDataset] = await db
      .insert(datasets)
      .values({
        tenantId: session.tenantId,
        name: data.name,
        description: data.description || null,
      })
      .returning();

    revalidatePath('/console/chatbot/datasets');
    return { success: true, datasetId: newDataset.id };
  } catch (error) {
    console.error('Dataset creation error:', error);
    return { success: false, error: '데이터셋 생성 중 오류가 발생했습니다.' };
  }
}

/**
 * 데이터셋 수정
 */
export async function updateDataset(
  id: string,
  data: { name?: string; description?: string }
): Promise<{ success: boolean; error?: string }> {
  const session = await validateSession();
  if (!session) {
    return { success: false, error: '인증이 필요합니다.' };
  }

  try {
    const [existing] = await db
      .select()
      .from(datasets)
      .where(and(eq(datasets.id, id), eq(datasets.tenantId, session.tenantId)));

    if (!existing) {
      return { success: false, error: '데이터셋을 찾을 수 없습니다.' };
    }

    await db
      .update(datasets)
      .set({
        name: data.name ?? existing.name,
        description: data.description !== undefined ? data.description : existing.description,
        updatedAt: new Date(),
      })
      .where(eq(datasets.id, id));

    revalidatePath('/console/chatbot/datasets');
    return { success: true };
  } catch (error) {
    console.error('Dataset update error:', error);
    return { success: false, error: '데이터셋 수정 중 오류가 발생했습니다.' };
  }
}

/**
 * 기본 데이터셋 설정
 */
export async function setDefaultDataset(
  id: string
): Promise<{ success: boolean; error?: string }> {
  const session = await validateSession();
  if (!session) {
    return { success: false, error: '인증이 필요합니다.' };
  }

  try {
    const [existing] = await db
      .select()
      .from(datasets)
      .where(and(eq(datasets.id, id), eq(datasets.tenantId, session.tenantId)));

    if (!existing) {
      return { success: false, error: '데이터셋을 찾을 수 없습니다.' };
    }

    if (existing.isDefault) {
      return { success: true }; // 이미 기본 데이터셋임
    }

    // 기존 기본 데이터셋 해제
    await db
      .update(datasets)
      .set({ isDefault: false, updatedAt: new Date() })
      .where(and(eq(datasets.tenantId, session.tenantId), eq(datasets.isDefault, true)));

    // 새 기본 데이터셋 설정
    await db
      .update(datasets)
      .set({ isDefault: true, updatedAt: new Date() })
      .where(eq(datasets.id, id));

    revalidatePath('/console/chatbot/datasets');
    return { success: true };
  } catch (error) {
    console.error('Set default dataset error:', error);
    return { success: false, error: '기본 데이터셋 설정 중 오류가 발생했습니다.' };
  }
}

/**
 * 데이터셋 삭제
 */
export async function deleteDataset(
  id: string
): Promise<{ success: boolean; error?: string }> {
  const session = await validateSession();
  if (!session) {
    return { success: false, error: '인증이 필요합니다.' };
  }

  try {
    const [existing] = await db
      .select()
      .from(datasets)
      .where(and(eq(datasets.id, id), eq(datasets.tenantId, session.tenantId)));

    if (!existing) {
      return { success: false, error: '데이터셋을 찾을 수 없습니다.' };
    }

    if (existing.isDefault) {
      return { success: false, error: '기본 데이터셋은 삭제할 수 없습니다.' };
    }

    // 삭제 전에 연결된 챗봇 목록 조회 (cascade 삭제 전에 저장)
    const connections = await db
      .select({ chatbotId: chatbotDatasets.chatbotId })
      .from(chatbotDatasets)
      .where(eq(chatbotDatasets.datasetId, id));
    const connectedChatbotIds = connections.map((c) => c.chatbotId);

    await db.delete(datasets).where(eq(datasets.id, id));

    logger.info('Dataset deleted via server action', {
      datasetId: id,
      datasetName: existing.name,
      tenantId: session.tenantId,
      connectedChatbots: connectedChatbotIds.length,
    });

    // 연결되어 있던 챗봇들의 RAG 인덱스 재생성 트리거 (fire-and-forget)
    for (const chatbotId of connectedChatbotIds) {
      triggerRagIndexGeneration(chatbotId, session.tenantId).catch((error) => {
        logger.error('Failed to trigger RAG regeneration after dataset delete', error, {
          chatbotId,
          datasetId: id,
        });
      });
    }

    revalidatePath('/console/chatbot/datasets');
    return { success: true };
  } catch (error) {
    console.error('Dataset delete error:', error);
    return { success: false, error: '데이터셋 삭제 중 오류가 발생했습니다.' };
  }
}
