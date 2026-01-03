/**
 * 계정 삭제 관련 Inngest 함수
 * [Account Management] 유예 기간 경과 후 계정 영구 삭제 처리
 *
 * 워크플로우:
 * 1. 사용자가 계정 삭제 요청 → deleteScheduledAt 설정 (30일 후)
 * 2. 유예 기간 내 로그인 → 자동 재활성화 (로그인 API에서 처리)
 * 3. 매일 새벽 3시 → processScheduledDeletions 실행
 *    - deleteScheduledAt이 지난 계정 조회
 *    - 개인정보 익명화 및 deletedAt 설정
 *    - 관련 데이터 정리
 */

import { inngestClient } from '../client';
import { db } from '@/lib/db';
import { users, sessions, accessLogs } from '@/drizzle/schema';
import { eq, and, lt, isNull, isNotNull } from 'drizzle-orm';
import { logger } from '@/lib/logger';

/**
 * 예약된 계정 삭제 처리 함수 (Cron)
 *
 * 매일 새벽 3시(한국 시간)에 실행
 * deleteScheduledAt이 현재 시간보다 과거인 계정을 삭제 처리
 */
export const processScheduledDeletions = inngestClient.createFunction(
  {
    id: 'process-scheduled-deletions',
    retries: 3,
    onFailure: async ({ error }) => {
      logger.error(
        'Scheduled account deletion job failed',
        error instanceof Error ? error : new Error(String(error))
      );
    },
  },
  { cron: 'TZ=Asia/Seoul 0 3 * * *' }, // 매일 새벽 3시 (KST)
  async ({ step }) => {
    const now = new Date();

    // Step 1: 삭제 대상 계정 조회
    const usersToDelete = await step.run('find-users-to-delete', async () => {
      return db.query.users.findMany({
        where: and(
          isNotNull(users.deleteScheduledAt),
          lt(users.deleteScheduledAt, now),
          isNull(users.deletedAt)
        ),
        columns: {
          id: true,
          email: true,
          tenantId: true,
          deleteScheduledAt: true,
          deleteReason: true,
        },
      });
    });

    if (usersToDelete.length === 0) {
      logger.info('No accounts scheduled for deletion');
      return { processed: 0 };
    }

    logger.info(`Found ${usersToDelete.length} accounts to delete`, {
      userIds: usersToDelete.map((u) => u.id),
    });

    // Step 2: 각 사용자에 대해 삭제 처리
    let processedCount = 0;
    let failedCount = 0;

    for (const user of usersToDelete) {
      try {
        await step.run(`delete-user-${user.id}`, async () => {
          // 2.1 관련 세션 삭제
          await db
            .delete(sessions)
            .where(eq(sessions.userId, user.id));

          // 2.2 접근 로그 익명화 (감사 추적 유지)
          // accessLogs는 userId를 통해 참조하며, 삭제된 사용자의 로그는 유지하되
          // 사용자 정보 조회 시 '삭제된 사용자'로 표시됨 (별도 익명화 불필요)

          // 2.3 사용자 개인정보 익명화 및 삭제 완료 처리
          const anonymizedEmail = `deleted_${user.id}@anonymized.local`;
          const anonymizedName = '삭제된 사용자';

          await db
            .update(users)
            .set({
              email: anonymizedEmail,
              name: anonymizedName,
              passwordHash: 'DELETED',
              totpSecret: null,
              totpBackupCodes: null,
              totpEnabled: false,
              googleId: null,
              kakaoId: null,
              avatarUrl: null,
              notificationSettings: null,
              deletedAt: now,
              updatedAt: now,
            })
            .where(eq(users.id, user.id));

          logger.info('Account permanently deleted', {
            userId: user.id,
            originalEmail: user.email,
            tenantId: user.tenantId,
            deleteReason: user.deleteReason,
            scheduledAt: user.deleteScheduledAt,
          });
        });

        processedCount++;
      } catch (error) {
        failedCount++;
        logger.error(
          `Failed to delete account ${user.id}`,
          error instanceof Error ? error : new Error(String(error)),
          { userId: user.id, email: user.email }
        );
      }
    }

    // Step 3: 결과 요약 로깅
    logger.info('Scheduled deletion job completed', {
      total: usersToDelete.length,
      processed: processedCount,
      failed: failedCount,
    });

    return {
      total: usersToDelete.length,
      processed: processedCount,
      failed: failedCount,
    };
  }
);
