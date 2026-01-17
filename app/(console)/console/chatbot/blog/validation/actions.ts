// app/(console)/console/chatbot/blog/validation/actions.ts

'use server';

import { db } from '@/lib/db';
import {
  validationSessions,
  claims,
  sourceSpans,
  documents,
  validationAuditLogs,
} from '@/drizzle/schema';
import { eq, desc, inArray } from 'drizzle-orm';
import { getCurrentUserId } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { auditHelpers } from '@/lib/knowledge-pages/verification/audit-logger';
import { inngest } from '@/inngest/client';
import type { KnowledgePagesValidateDocumentEvent } from '@/inngest/client';
import { getFileFromStorage } from '@/lib/upload/storage';
import { parseDocument, type SupportedFileType } from '@/lib/parsers';
import { createPagesFromStructure } from '@/lib/knowledge-pages/document-to-pages';
import type { DocumentStructure } from '@/lib/knowledge-pages/types';

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
  note?: string,
  sessionId?: string
) {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('Unauthorized');

  // 기존 verdict 조회 (감사 로그용)
  const existingClaim = await db
    .select({ humanVerdict: claims.humanVerdict, sessionId: claims.sessionId })
    .from(claims)
    .where(eq(claims.id, claimId))
    .then((rows) => rows[0]);

  await db
    .update(claims)
    .set({
      humanVerdict: verdict,
      humanNote: note,
      reviewedAt: new Date(),
    })
    .where(eq(claims.id, claimId));

  // 감사 로그 기록
  const sid = sessionId || existingClaim?.sessionId;
  if (sid) {
    await auditHelpers.claimReviewed(
      sid,
      userId,
      claimId,
      verdict,
      existingClaim?.humanVerdict ?? undefined
    );
  }

  return { success: true };
}

/**
 * 검증 승인 → Knowledge Pages 생성
 *
 * Human-in-the-loop 검증이 완료된 세션을 승인하고,
 * 검증된 구조와 마크다운에서 Knowledge Pages를 생성합니다.
 */
export async function approveValidationSession(
  sessionId: string,
  parentPageId?: string | null
) {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('Unauthorized');

  const validationSession = await db
    .select()
    .from(validationSessions)
    .where(eq(validationSessions.id, sessionId))
    .then((rows) => rows[0]);

  if (!validationSession) throw new Error('Session not found');

  // 검증된 구조와 마크다운이 있는지 확인
  const structure = validationSession.structureJson as DocumentStructure | null;
  const markdown = validationSession.reconstructedMarkdown;

  let pagesCount = 0;

  if (structure && markdown) {
    // 검증된 구조에서 Knowledge Pages 생성
    const result = await createPagesFromStructure(
      structure,
      markdown,
      validationSession.chatbotId,
      validationSession.documentId,
      parentPageId ?? undefined
    );

    if (!result.success) {
      throw new Error(`페이지 생성 실패: ${result.error}`);
    }

    pagesCount = result.pageCount;
  }

  // 세션 상태 업데이트
  await db
    .update(validationSessions)
    .set({
      status: 'approved',
      reviewedBy: userId,
      reviewedAt: new Date(),
      generatedPagesCount: pagesCount,
      updatedAt: new Date(),
    })
    .where(eq(validationSessions.id, sessionId));

  // 감사 로그 기록
  await auditHelpers.sessionApproved(sessionId, userId);

  revalidatePath('/console/chatbot/blog');

  return { success: true, pagesCount };
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

  // 감사 로그 기록
  await auditHelpers.sessionRejected(sessionId, userId, reason);

  return { success: true };
}

/**
 * 검증 세션 삭제
 *
 * 검토 대기 또는 완료된 세션만 삭제 가능합니다.
 * 처리 중인 세션(pending, analyzing, extracting_claims, verifying)은 삭제할 수 없습니다.
 *
 * 주의: cascade 삭제로 claims, sourceSpans, auditLogs가 함께 삭제됩니다.
 */
export async function deleteValidationSession(
  sessionId: string
): Promise<{ success: boolean; error?: string }> {
  const userId = await getCurrentUserId();
  if (!userId) {
    return { success: false, error: '인증이 필요합니다.' };
  }

  try {
    // 세션 조회
    const session = await db
      .select()
      .from(validationSessions)
      .where(eq(validationSessions.id, sessionId))
      .then((rows) => rows[0]);

    if (!session) {
      return { success: false, error: '세션을 찾을 수 없습니다.' };
    }

    // 상태 검증: 처리 중인 세션은 삭제 불가
    const processingStatuses = ['pending', 'analyzing', 'extracting_claims', 'verifying'];
    if (processingStatuses.includes(session.status)) {
      return {
        success: false,
        error: '처리 중인 세션은 삭제할 수 없습니다. 처리가 완료된 후 다시 시도해주세요.',
      };
    }

    // 문서 정보 조회 (로깅용)
    const doc = await db
      .select({ filename: documents.filename })
      .from(documents)
      .where(eq(documents.id, session.documentId))
      .then((rows) => rows[0]);

    // 삭제 전 로깅 (DB 감사 로그는 cascade로 함께 삭제되므로 console.log로 기록)
    console.log('[Validation] Session deleted:', {
      sessionId,
      userId,
      filename: doc?.filename,
      status: session.status,
      chatbotId: session.chatbotId,
    });

    // 세션 삭제 (cascade로 claims, sourceSpans, auditLogs 자동 삭제)
    await db.delete(validationSessions).where(eq(validationSessions.id, sessionId));

    revalidatePath('/console/chatbot/blog/validation');

    return { success: true };
  } catch (error) {
    console.error('Validation session delete error:', error);
    return { success: false, error: '세션 삭제 중 오류가 발생했습니다.' };
  }
}

/**
 * 감사 로그 조회
 */
export async function getValidationAuditLogs(sessionId: string) {
  const logs = await db
    .select()
    .from(validationAuditLogs)
    .where(eq(validationAuditLogs.sessionId, sessionId))
    .orderBy(desc(validationAuditLogs.createdAt));

  return logs;
}

/**
 * 세션 조회 감사 로그 기록
 */
export async function logSessionViewed(sessionId: string) {
  const userId = await getCurrentUserId();
  if (!userId) return;

  await auditHelpers.sessionViewed(sessionId, userId);
}

/**
 * 마스킹 해제 감사 로그 기록
 */
export async function logMaskingRevealed(sessionId: string) {
  const userId = await getCurrentUserId();
  if (!userId) return;

  await auditHelpers.maskingRevealed(sessionId, userId);
}

/**
 * 문서에서 검증 세션 생성
 *
 * 기존 문서를 사용하여 검증 세션을 생성하고 검증 파이프라인을 시작합니다.
 * PDF → 텍스트 추출이 이미 완료된 문서에 대해 Human-in-the-loop 검증을 수행합니다.
 *
 * @param documentId - 문서 ID
 * @param chatbotId - 챗봇 ID
 * @param parentPageId - 상위 페이지 ID (선택)
 */
export async function createValidationSessionFromDocument(
  documentId: string,
  chatbotId: string,
  parentPageId?: string
) {
  const userId = await getCurrentUserId();
  if (!userId) throw new Error('Unauthorized');

  // 환경 변수 사전 체크 (빠른 실패)
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicKey || anthropicKey === 'your-anthropic-api-key' || anthropicKey.startsWith('sk-ant-xxx')) {
    throw new Error(
      'ANTHROPIC_API_KEY 환경변수가 설정되지 않았습니다. AI 문서 재구성 기능을 사용하려면 .env.local 파일에 유효한 Anthropic API 키를 추가해주세요.'
    );
  }

  // 문서 정보 조회
  const document = await db
    .select()
    .from(documents)
    .where(eq(documents.id, documentId))
    .then((rows) => rows[0]);

  if (!document) {
    throw new Error('Document not found');
  }

  // 문서가 처리 완료 상태인지 확인
  if (document.status !== 'approved' && document.status !== 'reviewing' && document.status !== 'chunked') {
    throw new Error(
      `문서가 아직 처리 중입니다. 처리가 완료된 후 다시 시도해주세요. (현재 상태: ${document.status})`
    );
  }

  // 문서 파일을 다시 파싱하여 원본 텍스트 추출
  let originalText: string;
  try {
    const fileBuffer = await getFileFromStorage(document.filePath, document.tenantId);
    const parseResult = await parseDocument(
      fileBuffer,
      document.fileType as SupportedFileType
    );
    originalText = parseResult.text;
  } catch (error) {
    const errMsg = (error as Error).message || '';
    if (errMsg.includes('NoSuchKey') || errMsg.includes('not found') || errMsg.includes('ENOENT')) {
      throw new Error(
        `원본 파일을 찾을 수 없습니다. (파일: ${document.filename})`
      );
    }
    throw new Error(`문서 파싱 실패: ${errMsg}`);
  }

  // 검증 세션 생성
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7); // 7일 후 만료

  const [session] = await db
    .insert(validationSessions)
    .values({
      tenantId: document.tenantId,
      chatbotId,
      documentId,
      originalText,
      originalPdfUrl: document.filePath, // S3/R2 경로
      status: 'pending',
      expiresAt,
    })
    .returning();

  // Inngest 이벤트 발송
  console.log('[HITL] Sending validate-document event:', {
    sessionId: session.id,
    chatbotId,
    tenantId: document.tenantId,
  });

  const sendResult = await inngest.send({
    name: 'knowledge-pages/validate-document',
    data: {
      sessionId: session.id,
      chatbotId,
      tenantId: document.tenantId,
      parentPageId,
    },
  } as KnowledgePagesValidateDocumentEvent);

  console.log('[HITL] Event send result:', sendResult);

  revalidatePath('/console/chatbot/blog/validation');

  return {
    success: true,
    sessionId: session.id,
  };
}
