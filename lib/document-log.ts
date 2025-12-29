/**
 * 문서 처리 로그 유틸리티
 * 처리 단계별 로그 기록 및 조회
 */

import { db, documentProcessingLogs } from '@/lib/db';
import { eq, desc } from 'drizzle-orm';
import { logger } from '@/lib/logger';

export type ProcessingStep =
  | 'started'
  | 'parsing'
  | 'chunking'
  | 'context_generation'
  | 'embedding'
  | 'quality_check'
  | 'completed'
  | 'failed';

export type ProcessingStatus = 'started' | 'completed' | 'failed';

export interface LogDocumentProcessingParams {
  documentId: string;
  tenantId: string;
  step: ProcessingStep;
  status: ProcessingStatus;
  message?: string;
  details?: Record<string, unknown>;
  errorMessage?: string;
  errorStack?: string;
  durationMs?: number;
}

export interface DocumentLog {
  id: string;
  step: ProcessingStep;
  status: ProcessingStatus;
  message: string | null;
  details: Record<string, unknown>;
  errorMessage: string | null;
  durationMs: number | null;
  createdAt: string;
}

/**
 * 문서 처리 로그 기록
 * DB에 저장하고 콘솔에도 출력
 */
export async function logDocumentProcessing(
  params: LogDocumentProcessingParams
): Promise<void> {
  const {
    documentId,
    tenantId,
    step,
    status,
    message,
    details,
    errorMessage,
    errorStack,
    durationMs,
  } = params;

  // 콘솔 로그 출력
  const logContext = {
    documentId,
    tenantId,
    step,
    durationMs,
    ...details,
  };

  if (status === 'started') {
    logger.info(`📄 [DOCUMENT] ${step} started`, logContext);
  } else if (status === 'completed') {
    logger.info(`✅ [DOCUMENT] ${step} completed`, logContext);
  } else if (status === 'failed') {
    logger.error(
      `❌ [DOCUMENT] ${step} failed`,
      errorMessage ? new Error(errorMessage) : undefined,
      logContext
    );
  }

  // DB에 로그 저장
  try {
    await db.insert(documentProcessingLogs).values({
      documentId,
      tenantId,
      step,
      status,
      message: message || null,
      details: details || {},
      errorMessage: errorMessage || null,
      errorStack: errorStack || null,
      durationMs: durationMs || null,
    });
  } catch (error) {
    // 로그 저장 실패해도 처리는 계속 진행
    logger.error('Failed to save document processing log', error as Error, {
      documentId,
      step,
    });
  }
}

/**
 * 문서 처리 로그 조회
 */
export async function getDocumentLogs(documentId: string): Promise<DocumentLog[]> {
  const logs = await db
    .select({
      id: documentProcessingLogs.id,
      step: documentProcessingLogs.step,
      status: documentProcessingLogs.status,
      message: documentProcessingLogs.message,
      details: documentProcessingLogs.details,
      errorMessage: documentProcessingLogs.errorMessage,
      durationMs: documentProcessingLogs.durationMs,
      createdAt: documentProcessingLogs.createdAt,
    })
    .from(documentProcessingLogs)
    .where(eq(documentProcessingLogs.documentId, documentId))
    .orderBy(desc(documentProcessingLogs.createdAt));

  return logs.map((log) => ({
    id: log.id,
    step: log.step as ProcessingStep,
    status: log.status as ProcessingStatus,
    message: log.message,
    details: (log.details as Record<string, unknown>) || {},
    errorMessage: log.errorMessage,
    durationMs: log.durationMs,
    createdAt: log.createdAt?.toISOString() || new Date().toISOString(),
  }));
}

/**
 * 문서 처리 로그 삭제 (문서 재처리 시 호출)
 */
export async function clearDocumentLogs(documentId: string): Promise<void> {
  await db
    .delete(documentProcessingLogs)
    .where(eq(documentProcessingLogs.documentId, documentId));
}
