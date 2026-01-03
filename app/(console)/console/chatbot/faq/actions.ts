'use server';

/**
 * FAQ 빌더 서버 액션
 * FAQ 초안 CRUD 및 문서 내보내기
 * Console 마이그레이션 - revalidatePath 업데이트
 */

import { db } from '@/lib/db';
import { faqDrafts, documents, datasets, chatbotDatasets } from '@/drizzle/schema';
import { eq, and, desc, inArray } from 'drizzle-orm';
import { getSession } from '@/lib/auth/session';
import { revalidatePath } from 'next/cache';
import { generateMarkdown, generateSingleQAMarkdown, type Category, type QAPair } from './utils';
import { inngest } from '@/inngest/client';
import { uploadFile } from '@/lib/upload';
import { logger } from '@/lib/logger';

// 타입 정의 (서버 액션에서 사용)
export interface FAQDraftData {
  id?: string;
  chatbotId: string; // 필수: 챗봇별 관리
  name: string;
  categories: Category[];
  qaPairs: QAPair[];
}

export interface FAQDraft {
  id: string;
  tenantId: string;
  chatbotId: string | null; // nullable for migration
  name: string;
  categories: Category[];
  qaPairs: QAPair[];
  createdAt: Date;
  updatedAt: Date;
}

// FAQ 초안 목록 조회 (챗봇별)
export async function getFAQDrafts(chatbotId: string): Promise<FAQDraft[]> {
  const session = await getSession();
  if (!session?.tenantId) {
    throw new Error('인증이 필요합니다.');
  }

  const drafts = await db
    .select()
    .from(faqDrafts)
    .where(
      and(
        eq(faqDrafts.tenantId, session.tenantId),
        eq(faqDrafts.chatbotId, chatbotId)
      )
    )
    .orderBy(desc(faqDrafts.updatedAt));

  return drafts.map((draft) => ({
    id: draft.id,
    tenantId: draft.tenantId,
    chatbotId: draft.chatbotId,
    name: draft.name,
    categories: (draft.categories as Category[]) || [],
    qaPairs: (draft.qaPairs as QAPair[]) || [],
    createdAt: draft.createdAt!,
    updatedAt: draft.updatedAt!,
  }));
}

// FAQ 초안 단일 조회
export async function getFAQDraft(id: string): Promise<FAQDraft | null> {
  const session = await getSession();
  if (!session?.tenantId) {
    throw new Error('인증이 필요합니다.');
  }

  const [draft] = await db
    .select()
    .from(faqDrafts)
    .where(and(eq(faqDrafts.id, id), eq(faqDrafts.tenantId, session.tenantId)))
    .limit(1);

  if (!draft) return null;

  return {
    id: draft.id,
    tenantId: draft.tenantId,
    chatbotId: draft.chatbotId,
    name: draft.name,
    categories: (draft.categories as Category[]) || [],
    qaPairs: (draft.qaPairs as QAPair[]) || [],
    createdAt: draft.createdAt!,
    updatedAt: draft.updatedAt!,
  };
}

// FAQ 초안 저장 (생성 또는 업데이트)
export async function saveFAQDraft(
  data: FAQDraftData
): Promise<{ id: string; success: boolean }> {
  const session = await getSession();
  if (!session?.tenantId) {
    throw new Error('인증이 필요합니다.');
  }

  if (!data.chatbotId) {
    throw new Error('챗봇 ID가 필요합니다.');
  }

  // 업데이트
  if (data.id) {
    await db
      .update(faqDrafts)
      .set({
        name: data.name,
        categories: data.categories,
        qaPairs: data.qaPairs,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(faqDrafts.id, data.id),
          eq(faqDrafts.tenantId, session.tenantId),
          eq(faqDrafts.chatbotId, data.chatbotId) // 챗봇 소유권 확인
        )
      );

    revalidatePath('/console/chatbot/faq');
    return { id: data.id, success: true };
  }

  // 생성
  const [newDraft] = await db
    .insert(faqDrafts)
    .values({
      tenantId: session.tenantId,
      chatbotId: data.chatbotId,
      name: data.name,
      categories: data.categories,
      qaPairs: data.qaPairs,
    })
    .returning({ id: faqDrafts.id });

  revalidatePath('/console/chatbot/faq');
  return { id: newDraft.id, success: true };
}

// FAQ 초안 삭제
export async function deleteFAQDraft(id: string): Promise<void> {
  const session = await getSession();
  if (!session?.tenantId) {
    throw new Error('인증이 필요합니다.');
  }

  await db
    .delete(faqDrafts)
    .where(and(eq(faqDrafts.id, id), eq(faqDrafts.tenantId, session.tenantId)));

  revalidatePath('/console/chatbot/faq');
}

// 문서로 내보내기 (업로드)
export async function exportAsDocument(
  draftId: string
): Promise<{ documentId: string; success: boolean }> {
  const session = await getSession();
  if (!session?.tenantId) {
    throw new Error('인증이 필요합니다.');
  }

  const draft = await getFAQDraft(draftId);
  if (!draft) {
    throw new Error('FAQ 초안을 찾을 수 없습니다.');
  }

  // Markdown 생성
  const markdown = generateMarkdown(draft.categories, draft.qaPairs);

  // FormData 생성하여 업로드 API 호출
  const blob = new Blob([markdown], { type: 'text/markdown' });
  const formData = new FormData();
  formData.append(
    'file',
    blob,
    `${draft.name.replace(/[^a-zA-Z0-9가-힣]/g, '_')}.md`
  );

  const response = await fetch(
    `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/documents/upload`,
    {
      method: 'POST',
      body: formData,
      headers: {
        Cookie: `session=${session}`,
      },
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || '문서 업로드에 실패했습니다.');
  }

  const result = await response.json();
  return { documentId: result.document.id, success: true };
}

// 개별 Q&A를 문서로 업로드
export async function uploadQAAsDocument(
  draftId: string,
  qaId: string,
  targetDatasetId?: string, // 대상 데이터셋 ID
  chatbotId?: string // 챗봇 ID (targetDatasetId 없을 때 챗봇 연결 데이터셋 사용)
): Promise<{ documentId: string; success: boolean; updatedQAPair: QAPair }> {
  const session = await getSession();
  if (!session?.tenantId) {
    throw new Error('인증이 필요합니다.');
  }

  // 초안 조회
  const draft = await getFAQDraft(draftId);
  if (!draft) {
    throw new Error('FAQ 초안을 찾을 수 없습니다.');
  }

  // 해당 Q&A 찾기
  const qa = draft.qaPairs.find((q) => q.id === qaId);
  if (!qa) {
    throw new Error('Q&A를 찾을 수 없습니다.');
  }

  // Q&A 유효성 검사
  if (!qa.question.trim() || !qa.answer.trim()) {
    throw new Error('질문과 답변을 모두 입력해주세요.');
  }

  // 질문/답변 길이 제한 검사
  const MAX_QUESTION_LENGTH = 500;
  const MAX_ANSWER_LENGTH = 5000;
  if (qa.question.length > MAX_QUESTION_LENGTH) {
    throw new Error(`질문은 ${MAX_QUESTION_LENGTH}자 이하로 입력해주세요.`);
  }
  if (qa.answer.length > MAX_ANSWER_LENGTH) {
    throw new Error(`답변은 ${MAX_ANSWER_LENGTH}자 이하로 입력해주세요.`);
  }

  // 기존 문서 ID 저장 (업로드 성공 후 삭제)
  const oldDocumentId = qa.documentId;

  // 카테고리 이름 찾기
  const category = draft.categories.find((c) => c.id === qa.categoryId);

  // 단일 Q&A를 Markdown으로 변환
  const markdown = generateSingleQAMarkdown(qa, category?.name);

  // 파일명 생성
  const filename = `QA_${qa.question.slice(0, 20).replace(/[^a-zA-Z0-9가-힣]/g, '_')}.md`;

  // 대상 데이터셋 결정
  let datasetId: string;
  let datasetName: string;

  if (targetDatasetId) {
    // 지정된 데이터셋 검증
    const [targetDataset] = await db
      .select({ id: datasets.id, name: datasets.name })
      .from(datasets)
      .where(and(eq(datasets.id, targetDatasetId), eq(datasets.tenantId, session.tenantId)));

    if (!targetDataset) {
      throw new Error('유효하지 않은 데이터셋입니다.');
    }
    datasetId = targetDataset.id;
    datasetName = targetDataset.name;
  } else if (chatbotId) {
    // 챗봇의 연결된 데이터셋 사용 (첫 번째 것)
    const linkedDatasets = await db
      .select({ datasetId: chatbotDatasets.datasetId })
      .from(chatbotDatasets)
      .where(eq(chatbotDatasets.chatbotId, chatbotId));

    if (linkedDatasets.length === 0) {
      throw new Error('챗봇에 연결된 데이터셋이 없습니다.');
    }

    const [linkedDataset] = await db
      .select({ id: datasets.id, name: datasets.name })
      .from(datasets)
      .where(
        and(
          eq(datasets.id, linkedDatasets[0].datasetId),
          eq(datasets.tenantId, session.tenantId)
        )
      );

    if (!linkedDataset) {
      throw new Error('챗봇 연결 데이터셋을 찾을 수 없습니다.');
    }
    datasetId = linkedDataset.id;
    datasetName = linkedDataset.name;
  } else {
    // 레거시 호환: 기본 데이터셋 사용 (chatbotId 없는 경우)
    const [defaultDataset] = await db
      .select({ id: datasets.id, name: datasets.name })
      .from(datasets)
      .where(and(eq(datasets.tenantId, session.tenantId), eq(datasets.isDefault, true)));

    if (!defaultDataset) {
      throw new Error('기본 데이터셋이 없습니다. 먼저 데이터셋을 생성하세요.');
    }
    datasetId = defaultDataset.id;
    datasetName = defaultDataset.name;
  }

  // 파일 업로드 (스토리지)
  const fileBuffer = Buffer.from(markdown, 'utf-8');
  const uploadResult = await uploadFile(fileBuffer, {
    tenantId: session.tenantId,
    filename: filename,
    contentType: 'text/markdown',
    folder: 'documents',
    metadata: {
      originalFilename: filename,
      uploadedBy: session.userId,
      source: 'faq-builder',
    },
  });

  if (!uploadResult.success) {
    logger.error('FAQ Q&A file upload failed', new Error(uploadResult.error || 'Unknown error'), {
      filename,
      tenantId: session.tenantId,
    });
    throw new Error('파일 업로드에 실패했습니다.');
  }

  // DB에 문서 레코드 생성
  const [newDocument] = await db
    .insert(documents)
    .values({
      tenantId: session.tenantId,
      datasetId: datasetId,
      filename: filename,
      filePath: uploadResult.key!,
      fileSize: fileBuffer.length,
      fileType: 'text/markdown',
      status: 'uploaded',
      metadata: {
        originalFilename: filename,
        uploadedBy: session.userId,
        url: uploadResult.url,
        source: 'faq-builder',
        qaId: qaId,
        draftId: draftId,
      },
    })
    .returning();

  const newDocumentId = newDocument.id;

  // Inngest 이벤트 발송 (문서 처리 시작)
  await inngest.send({
    name: 'document/uploaded',
    data: {
      documentId: newDocumentId,
      tenantId: session.tenantId,
      datasetId: datasetId,
      userId: session.userId,
      filename: filename,
      fileType: 'text/markdown',
      filePath: uploadResult.key!,
    },
  });

  logger.info('FAQ Q&A uploaded as document', {
    documentId: newDocumentId,
    filename,
    tenantId: session.tenantId,
    qaId,
    draftId,
  });

  // Q&A 업데이트 (잠금 상태로 변경)
  const updatedQAPair: QAPair = {
    ...qa,
    documentId: newDocumentId,
    uploadedAt: new Date().toISOString(),
    uploadedDatasetId: datasetId,
    uploadedDatasetName: datasetName,
    isLocked: true,
    isModified: false,
    originalQuestion: qa.question,
    originalAnswer: qa.answer,
  };

  // 초안의 qaPairs 업데이트
  const updatedQAPairs = draft.qaPairs.map((q) =>
    q.id === qaId ? updatedQAPair : q
  );

  await db
    .update(faqDrafts)
    .set({
      qaPairs: updatedQAPairs,
      updatedAt: new Date(),
    })
    .where(
      and(eq(faqDrafts.id, draftId), eq(faqDrafts.tenantId, session.tenantId))
    );

  // 새 문서 업로드 성공 후 기존 문서 삭제 (안전한 순서)
  if (oldDocumentId) {
    try {
      const existingDoc = await db.query.documents.findFirst({
        where: eq(documents.id, oldDocumentId),
        columns: { tenantId: true },
      });

      if (existingDoc && existingDoc.tenantId === session.tenantId) {
        await db.delete(documents).where(eq(documents.id, oldDocumentId));
      }
    } catch {
      // 기존 문서 삭제 실패해도 새 문서는 이미 생성됨
      console.warn('기존 문서 삭제 실패:', oldDocumentId);
    }
  }

  revalidatePath('/console/chatbot/faq');
  revalidatePath('/console/chatbot');

  return { documentId: newDocumentId, success: true, updatedQAPair };
}

// Q&A 잠금 해제
export async function unlockQA(
  draftId: string,
  qaId: string
): Promise<{ success: boolean; updatedQAPair: QAPair }> {
  const session = await getSession();
  if (!session?.tenantId) {
    throw new Error('인증이 필요합니다.');
  }

  // 초안 조회
  const draft = await getFAQDraft(draftId);
  if (!draft) {
    throw new Error('FAQ 초안을 찾을 수 없습니다.');
  }

  // 해당 Q&A 찾기
  const qa = draft.qaPairs.find((q) => q.id === qaId);
  if (!qa) {
    throw new Error('Q&A를 찾을 수 없습니다.');
  }

  // 잠금 해제 (수정 상태 초기화)
  const updatedQAPair: QAPair = {
    ...qa,
    isLocked: false,
    isModified: false,
  };

  // 초안의 qaPairs 업데이트
  const updatedQAPairs = draft.qaPairs.map((q) =>
    q.id === qaId ? updatedQAPair : q
  );

  await db
    .update(faqDrafts)
    .set({
      qaPairs: updatedQAPairs,
      updatedAt: new Date(),
    })
    .where(
      and(eq(faqDrafts.id, draftId), eq(faqDrafts.tenantId, session.tenantId))
    );

  revalidatePath('/console/chatbot/faq');

  return { success: true, updatedQAPair };
}
