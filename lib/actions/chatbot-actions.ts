/**
 * 챗봇 관리 서버 액션 (공유)
 *
 * Console과 API에서 공통으로 사용하는 챗봇 관련 액션
 * Portal에서 마이그레이션됨 (2026-01)
 */

'use server';

import { revalidatePath } from 'next/cache';
import { validateSession } from '@/lib/auth/session';
import { db, chatbots, chatbotDatasets, datasets } from '@/lib/db';

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

    // Console 경로로 revalidate
    revalidatePath('/console');

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
