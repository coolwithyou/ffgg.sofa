/**
 * 검증 세션 만료 처리 Inngest 함수 (Cron)
 *
 * Human-in-the-loop 검증 세션의 만료 처리를 담당합니다.
 *
 * 워크플로우:
 * 1. 매일 새벽 4시(한국 시간)에 실행
 * 2. expiresAt이 현재 시간보다 과거이고 상태가 pending/ready_for_review인 세션 조회
 * 3. 상태를 'expired'로 변경
 * 4. 감사 로그 기록
 *
 * 보안:
 * - 만료된 세션은 더 이상 수정 불가
 * - 민감한 원본 데이터 접근 차단
 */

import { inngestClient } from '../client';
import { db } from '@/lib/db';
import { validationSessions, validationAuditLogs } from '@/drizzle/schema';
import { and, lt, inArray } from 'drizzle-orm';
import { logger } from '@/lib/logger';

/**
 * 검증 세션 만료 처리 함수
 *
 * 매일 새벽 4시(한국 시간)에 실행
 * 기본 만료 기간: 7일 (세션 생성 시 설정)
 */
export const expireValidationSessions = inngestClient.createFunction(
  {
    id: 'expire-validation-sessions',
    retries: 3,
    onFailure: async ({ error }) => {
      logger.error(
        'Validation session expiry job failed',
        error instanceof Error ? error : new Error(String(error))
      );
    },
  },
  { cron: 'TZ=Asia/Seoul 0 4 * * *' }, // 매일 새벽 4시 (KST)
  async ({ step }) => {
    const now = new Date();

    // Step 1: 만료 대상 세션 조회
    const expiredSessions = await step.run('find-expired-sessions', async () => {
      return db
        .select({
          id: validationSessions.id,
          tenantId: validationSessions.tenantId,
          chatbotId: validationSessions.chatbotId,
          status: validationSessions.status,
          expiresAt: validationSessions.expiresAt,
        })
        .from(validationSessions)
        .where(
          and(
            lt(validationSessions.expiresAt, now),
            // 아직 최종 결정되지 않은 세션만 만료 처리
            inArray(validationSessions.status, [
              'pending',
              'analyzing',
              'extracting_claims',
              'verifying',
              'ready_for_review',
              'reviewing',
            ])
          )
        );
    });

    if (expiredSessions.length === 0) {
      logger.info('[expire-validation-sessions] No sessions to expire');
      return { expiredCount: 0 };
    }

    logger.info('[expire-validation-sessions] Found expired sessions', {
      count: expiredSessions.length,
    });

    // Step 2: 세션 상태를 expired로 업데이트
    const updatedCount = await step.run('update-expired-sessions', async () => {
      const sessionIds = expiredSessions.map((s) => s.id);

      await db
        .update(validationSessions)
        .set({
          status: 'expired',
          reviewNote: '세션이 만료되었습니다. 다시 검증을 시작해주세요.',
          updatedAt: now,
        })
        .where(inArray(validationSessions.id, sessionIds));

      return sessionIds.length;
    });

    // Step 3: 감사 로그 기록
    await step.run('log-expirations', async () => {
      const auditLogs = expiredSessions.map((session) => ({
        sessionId: session.id,
        action: 'session_expired' as const,
        userId: null, // 시스템에 의한 자동 만료
        metadata: {
          previousStatus: session.status,
          expiresAt: session.expiresAt
            ? new Date(session.expiresAt).toISOString()
            : null,
          expiredAt: now.toISOString(),
        },
      }));

      await db.insert(validationAuditLogs).values(auditLogs);

      logger.info('[expire-validation-sessions] Audit logs recorded', {
        count: auditLogs.length,
      });
    });

    logger.info('[expire-validation-sessions] Session expiry completed', {
      expiredCount: updatedCount,
    });

    return { expiredCount: updatedCount };
  }
);
