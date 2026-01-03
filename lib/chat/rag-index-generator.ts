/**
 * RAG 인덱스 백그라운드 생성 모듈
 *
 * 데이터셋 변경 시 RAG 인덱스를 자동으로 재생성합니다.
 * 생성 상태를 DB에 저장하여 UI에서 프로그레스를 표시할 수 있습니다.
 */

import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { chatbots } from '@/drizzle/schema';
import { generatePersonaFromDocuments } from './persona-generator';
import { logger } from '@/lib/logger';

export type RagIndexStatus = 'idle' | 'generating' | 'completed' | 'failed';

/**
 * RAG 인덱스 생성 상태 업데이트
 */
export async function updateRagIndexStatus(
  chatbotId: string,
  status: RagIndexStatus
): Promise<void> {
  await db
    .update(chatbots)
    .set({ ragIndexStatus: status })
    .where(eq(chatbots.id, chatbotId));
}

/**
 * 백그라운드에서 RAG 인덱스 생성 실행
 *
 * Promise를 반환하지만 await하지 않고 fire-and-forget으로 실행됩니다.
 * 생성 완료/실패 시 DB 상태가 업데이트됩니다.
 */
export async function triggerRagIndexGeneration(
  chatbotId: string,
  tenantId: string
): Promise<void> {
  // 상태를 'generating'으로 설정
  await updateRagIndexStatus(chatbotId, 'generating');

  // 백그라운드에서 비동기 실행 (fire-and-forget)
  generateRagIndexInBackground(chatbotId, tenantId).catch((error) => {
    logger.error('Background RAG index generation failed', error, {
      chatbotId,
      tenantId,
    });
  });
}

/**
 * 실제 RAG 인덱스 생성 로직 (백그라운드 실행)
 */
async function generateRagIndexInBackground(
  chatbotId: string,
  tenantId: string
): Promise<void> {
  try {
    logger.info('Starting background RAG index generation', {
      chatbotId,
      tenantId,
    });

    // 페르소나 생성 (내부에서 RAG 인덱스도 함께 생성)
    const generatedPersona = await generatePersonaFromDocuments(chatbotId, {
      tenantId,
      sampleSize: 50,
    });

    const now = new Date().toISOString();

    // 챗봇의 기존 설정 조회
    const [chatbot] = await db
      .select({
        personaConfig: chatbots.personaConfig,
      })
      .from(chatbots)
      .where(eq(chatbots.id, chatbotId));

    if (!chatbot) {
      throw new Error('챗봇을 찾을 수 없습니다');
    }

    // 결과를 두 config으로 분리 저장
    const existingPersonaConfig = (chatbot.personaConfig as Record<string, unknown>) || {};
    const updatedPersonaConfig = {
      ...existingPersonaConfig,
      name: existingPersonaConfig.name || generatedPersona.name,
      expertiseArea: generatedPersona.expertiseArea,
      expertiseDescription: generatedPersona.expertiseDescription,
      tone: generatedPersona.tone,
    };

    const updatedRagIndexConfig = {
      keywords: generatedPersona.keywords,
      includedTopics: generatedPersona.includedTopics ?? [],
      excludedTopics: generatedPersona.excludedTopics ?? [],
      confidence: generatedPersona.confidence,
      lastGeneratedAt: now,
      documentSampleCount: 50,
    };

    // DB 업데이트 (상태를 'completed'로 변경)
    await db
      .update(chatbots)
      .set({
        personaConfig: updatedPersonaConfig,
        ragIndexConfig: updatedRagIndexConfig,
        ragIndexStatus: 'completed',
        updatedAt: new Date(),
      })
      .where(eq(chatbots.id, chatbotId));

    logger.info('Background RAG index generation completed', {
      chatbotId,
      keywords: generatedPersona.keywords.length,
      includedTopics: generatedPersona.includedTopics?.length ?? 0,
      excludedTopics: generatedPersona.excludedTopics?.length ?? 0,
    });
  } catch (error) {
    logger.error('RAG index generation error', error as Error, { chatbotId });

    // 상태를 'failed'로 업데이트
    await db
      .update(chatbots)
      .set({ ragIndexStatus: 'failed' })
      .where(eq(chatbots.id, chatbotId));
  }
}

/**
 * RAG 인덱스 생성 상태 조회
 */
export async function getRagIndexStatus(
  chatbotId: string
): Promise<RagIndexStatus | null> {
  const [chatbot] = await db
    .select({ ragIndexStatus: chatbots.ragIndexStatus })
    .from(chatbots)
    .where(eq(chatbots.id, chatbotId));

  return (chatbot?.ragIndexStatus as RagIndexStatus) ?? null;
}
