'use server';

/**
 * FAQ 빌더 서버 액션
 * FAQ 초안 CRUD 및 문서 내보내기
 */

import { db } from '@/lib/db';
import { faqDrafts } from '@/drizzle/schema';
import { eq, and, desc } from 'drizzle-orm';
import { getSession } from '@/lib/auth/session';
import { revalidatePath } from 'next/cache';
import { generateMarkdown, type Category, type QAPair } from './utils';

// 타입 정의 (서버 액션에서 사용)
export interface FAQDraftData {
  id?: string;
  name: string;
  categories: Category[];
  qaPairs: QAPair[];
}

export interface FAQDraft {
  id: string;
  tenantId: string;
  name: string;
  categories: Category[];
  qaPairs: QAPair[];
  createdAt: Date;
  updatedAt: Date;
}

// FAQ 초안 목록 조회
export async function getFAQDrafts(): Promise<FAQDraft[]> {
  const session = await getSession();
  if (!session?.tenantId) {
    throw new Error('인증이 필요합니다.');
  }

  const drafts = await db
    .select()
    .from(faqDrafts)
    .where(eq(faqDrafts.tenantId, session.tenantId))
    .orderBy(desc(faqDrafts.updatedAt));

  return drafts.map((draft) => ({
    id: draft.id,
    tenantId: draft.tenantId,
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
        and(eq(faqDrafts.id, data.id), eq(faqDrafts.tenantId, session.tenantId))
      );

    revalidatePath('/faq-builder');
    return { id: data.id, success: true };
  }

  // 생성
  const [newDraft] = await db
    .insert(faqDrafts)
    .values({
      tenantId: session.tenantId,
      name: data.name,
      categories: data.categories,
      qaPairs: data.qaPairs,
    })
    .returning({ id: faqDrafts.id });

  revalidatePath('/faq-builder');
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

  revalidatePath('/faq-builder');
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
