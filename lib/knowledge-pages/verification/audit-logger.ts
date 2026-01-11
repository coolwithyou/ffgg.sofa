// lib/knowledge-pages/verification/audit-logger.ts

/**
 * 검증 감사 로그 서비스
 *
 * 검증 과정의 모든 액션을 기록합니다.
 * 컴플라이언스 및 감사 추적용입니다.
 */

import { db } from '@/lib/db';
import { validationAuditLogs } from '@/drizzle/schema';
import { eq, desc } from 'drizzle-orm';
import { headers } from 'next/headers';

type AuditAction = NonNullable<
  typeof validationAuditLogs.$inferInsert['action']
>;

interface LogAuditOptions {
  sessionId: string;
  userId: string;
  action: AuditAction;
  targetType?: 'session' | 'claim' | 'markdown';
  targetId?: string;
  previousValue?: string;
  newValue?: string;
  metadata?: Record<string, unknown>;
}

/**
 * 감사 로그 기록
 */
export async function logAudit(options: LogAuditOptions): Promise<void> {
  const {
    sessionId,
    userId,
    action,
    targetType,
    targetId,
    previousValue,
    newValue,
    metadata,
  } = options;

  // 클라이언트 정보 추출
  const headersList = await headers();
  const ipAddress =
    headersList.get('x-forwarded-for')?.split(',')[0].trim() ||
    headersList.get('x-real-ip') ||
    'unknown';
  const userAgent = headersList.get('user-agent') || 'unknown';

  try {
    await db.insert(validationAuditLogs).values({
      sessionId,
      userId,
      action,
      targetType,
      targetId,
      previousValue,
      newValue,
      metadata,
      ipAddress,
      userAgent,
    });
  } catch (error) {
    // 감사 로그 실패가 메인 로직을 중단시키면 안 됨
    console.error('Failed to log audit:', error);
  }
}

/**
 * 세션별 감사 로그 조회
 */
export async function getSessionAuditLogs(sessionId: string) {
  // users 테이블 조인을 위해 raw query 사용
  const logs = await db
    .select()
    .from(validationAuditLogs)
    .where(eq(validationAuditLogs.sessionId, sessionId))
    .orderBy(desc(validationAuditLogs.createdAt));

  return logs;
}

/**
 * 감사 로그 헬퍼 함수들
 */
export const auditHelpers = {
  sessionViewed: (sessionId: string, userId: string) =>
    logAudit({
      sessionId,
      userId,
      action: 'session_viewed',
      targetType: 'session',
      targetId: sessionId,
    }),

  sessionApproved: (sessionId: string, userId: string) =>
    logAudit({
      sessionId,
      userId,
      action: 'session_approved',
      targetType: 'session',
      targetId: sessionId,
    }),

  sessionRejected: (sessionId: string, userId: string, reason: string) =>
    logAudit({
      sessionId,
      userId,
      action: 'session_rejected',
      targetType: 'session',
      targetId: sessionId,
      metadata: { reason },
    }),

  claimReviewed: (
    sessionId: string,
    userId: string,
    claimId: string,
    verdict: string,
    previousVerdict?: string
  ) =>
    logAudit({
      sessionId,
      userId,
      action: 'claim_reviewed',
      targetType: 'claim',
      targetId: claimId,
      previousValue: previousVerdict,
      newValue: verdict,
      metadata: { verdict },
    }),

  claimApproved: (sessionId: string, userId: string, claimId: string) =>
    logAudit({
      sessionId,
      userId,
      action: 'claim_approved',
      targetType: 'claim',
      targetId: claimId,
    }),

  claimRejected: (
    sessionId: string,
    userId: string,
    claimId: string,
    reason?: string
  ) =>
    logAudit({
      sessionId,
      userId,
      action: 'claim_rejected',
      targetType: 'claim',
      targetId: claimId,
      metadata: reason ? { reason } : undefined,
    }),

  claimModified: (
    sessionId: string,
    userId: string,
    claimId: string,
    previousContent: string,
    newContent: string
  ) =>
    logAudit({
      sessionId,
      userId,
      action: 'claim_modified',
      targetType: 'claim',
      targetId: claimId,
      previousValue: previousContent.slice(0, 1000),
      newValue: newContent.slice(0, 1000),
    }),

  markdownEdited: (
    sessionId: string,
    userId: string,
    previousContent: string,
    newContent: string
  ) =>
    logAudit({
      sessionId,
      userId,
      action: 'markdown_edited',
      targetType: 'markdown',
      previousValue: previousContent.slice(0, 1000), // 너무 길면 잘라서 저장
      newValue: newContent.slice(0, 1000),
    }),

  maskingApplied: (sessionId: string, userId: string, count: number) =>
    logAudit({
      sessionId,
      userId,
      action: 'masking_applied',
      targetType: 'session',
      targetId: sessionId,
      metadata: { maskingCount: count },
    }),

  maskingRevealed: (sessionId: string, userId: string) =>
    logAudit({
      sessionId,
      userId,
      action: 'masking_revealed',
      targetType: 'session',
      targetId: sessionId,
    }),

  exportGenerated: (
    sessionId: string,
    userId: string,
    format: string,
    pagesCount: number
  ) =>
    logAudit({
      sessionId,
      userId,
      action: 'export_generated',
      targetType: 'session',
      targetId: sessionId,
      metadata: { format, pagesCount },
    }),
};
