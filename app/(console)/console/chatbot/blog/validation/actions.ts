// app/(console)/console/chatbot/blog/validation/actions.ts

'use server';

import { db } from '@/lib/db';
import {
  validationSessions,
  claims,
  sourceSpans,
  documents,
} from '@/drizzle/schema';
import { eq, desc, inArray } from 'drizzle-orm';
import { getCurrentUserId } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
// TODO: Phase 4에서 구현 예정
// import { createPagesFromStructure } from '@/lib/knowledge-pages/document-to-pages';

// 타입 정의
export type ValidationSessionWithDocument = typeof validationSessions.$inferSelect & {
  document: {
    filename: string;
    fileType: string | null;
  } | null;
};

/**
 * 검증 세션 목록 조회
 */
export async function getValidationSessions(
  chatbotId: string
): Promise<ValidationSessionWithDocument[]> {
  // Relations가 정의되지 않았으므로 별도 쿼리로 조회
  const sessions = await db
    .select()
    .from(validationSessions)
    .where(eq(validationSessions.chatbotId, chatbotId))
    .orderBy(desc(validationSessions.createdAt));

  if (sessions.length === 0) return [];

  // 문서 정보 별도 조회
  const documentIds = [...new Set(sessions.map((s) => s.documentId))];
  const docs = await db
    .select({
      id: documents.id,
      filename: documents.filename,
      fileType: documents.fileType,
    })
    .from(documents)
    .where(inArray(documents.id, documentIds));

  const docMap = new Map(docs.map((d) => [d.id, d]));

  return sessions.map((session) => ({
    ...session,
    document: docMap.get(session.documentId) || null,
  }));
}

/**
 * 검증 세션 상세 조회 (Claims + SourceSpans 포함)
 */
export async function getValidationSessionDetail(sessionId: string) {
  const session = await db
    .select()
    .from(validationSessions)
    .where(eq(validationSessions.id, sessionId))
    .then((rows) => rows[0]);

  if (!session) throw new Error('Session not found');

  const allClaims = await db
    .select()
    .from(claims)
    .where(eq(claims.sessionId, sessionId))
    .orderBy(claims.sortOrder);

  // SourceSpans를 Claim ID별로 그룹핑
  const claimIds = allClaims.map((c) => c.id);
  const allSpans =
    claimIds.length > 0
      ? await db
          .select()
          .from(sourceSpans)
          .where(inArray(sourceSpans.claimId, claimIds))
      : [];

  const sourceSpansMap: Record<string, (typeof allSpans)[number][]> = {};
  for (const span of allSpans) {
    if (!sourceSpansMap[span.claimId]) {
      sourceSpansMap[span.claimId] = [];
    }
    sourceSpansMap[span.claimId].push(span);
  }

  return { session, claims: allClaims, sourceSpans: sourceSpansMap };
}

/**
 * 재구성 마크다운 수정
 */
export async function updateReconstructedMarkdown(
  sessionId: string,
  markdown: string
) {
  await db
    .update(validationSessions)
    .set({
      reconstructedMarkdown: markdown,
      updatedAt: new Date(),
    })
    .where(eq(validationSessions.id, sessionId));

  return { success: true };
}

/**
 * Claim 검토 결과 저장
 */
export async function updateClaimHumanVerdict(
  claimId: string,
  verdict: 'approved' | 'rejected' | 'modified',
  note?: string
) {
  await db
    .update(claims)
    .set({
      humanVerdict: verdict,
      humanNote: note,
      reviewedAt: new Date(),
    })
    .where(eq(claims.id, claimId));

  return { success: true };
}

/**
 * 검증 승인 → Knowledge Pages 생성
 */
export async function approveValidationSession(sessionId: string) {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('Unauthorized');

  const validationSession = await db
    .select()
    .from(validationSessions)
    .where(eq(validationSessions.id, sessionId))
    .then((rows) => rows[0]);

  if (!validationSession) throw new Error('Session not found');

  // 구조 JSON에서 페이지 생성
  // TODO: Phase 4에서 createPagesFromStructure 구현 후 활성화
  // const structure = validationSession.structureJson as {
  //   sections: Array<{
  //     id: string;
  //     title: string;
  //     level: number;
  //     startLine: number;
  //     endLine: number;
  //   }>;
  // };
  // const markdown = validationSession.reconstructedMarkdown || '';

  // 임시: 페이지 생성 로직 (Phase 4에서 구현)
  const pages: { id: string }[] = [];
  // const pages = await createPagesFromStructure(
  //   structure,
  //   markdown,
  //   validationSession.chatbotId,
  //   validationSession.documentId
  // );

  // 세션 상태 업데이트
  await db
    .update(validationSessions)
    .set({
      status: 'approved',
      reviewedBy: userId,
      reviewedAt: new Date(),
      generatedPagesCount: pages.length,
      updatedAt: new Date(),
    })
    .where(eq(validationSessions.id, sessionId));

  revalidatePath('/console/chatbot/blog');

  return { success: true, pagesCount: pages.length };
}

/**
 * 검증 거부
 */
export async function rejectValidationSession(sessionId: string, reason: string) {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('Unauthorized');

  await db
    .update(validationSessions)
    .set({
      status: 'rejected',
      reviewedBy: userId,
      reviewedAt: new Date(),
      reviewNote: reason,
      updatedAt: new Date(),
    })
    .where(eq(validationSessions.id, sessionId));

  return { success: true };
}
