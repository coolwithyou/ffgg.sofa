/**
 * 권한 변경 이력 관리
 * [C-004] 권한 변경 이력 3년 보관
 */

import { db, permissionAuditLog } from '@/lib/db';
import { sql, lt } from 'drizzle-orm';
import { logger } from '@/lib/logger';

export type PermissionAction = 'grant' | 'modify' | 'revoke';

export interface PermissionChange {
  targetUserId: string;
  actorUserId: string;
  action: PermissionAction;
  permissionType: string;
  oldValue?: Record<string, unknown> | null;
  newValue?: Record<string, unknown> | null;
  reason?: string;
  ipAddress?: string;
}

/**
 * 권한 변경 이력 기록
 */
export async function recordPermissionChange(
  change: PermissionChange
): Promise<void> {
  try {
    await db.insert(permissionAuditLog).values({
      targetUserId: change.targetUserId,
      actorUserId: change.actorUserId,
      action: change.action,
      permissionType: change.permissionType,
      oldValue: change.oldValue || null,
      newValue: change.newValue || null,
      reason: change.reason,
      ipAddress: change.ipAddress,
    });

    logger.info('Permission change recorded', {
      targetUserId: change.targetUserId,
      actorUserId: change.actorUserId,
      action: change.action,
      permissionType: change.permissionType,
    });
  } catch (error) {
    logger.error('Failed to record permission change', error as Error, {
      targetUserId: change.targetUserId,
      action: change.action,
    });
    throw error;
  }
}

/**
 * 역할 변경 기록 헬퍼
 */
export async function recordRoleChange(
  targetUserId: string,
  actorUserId: string,
  oldRole: string,
  newRole: string,
  reason?: string,
  ipAddress?: string
): Promise<void> {
  await recordPermissionChange({
    targetUserId,
    actorUserId,
    action: oldRole === 'user' && newRole !== 'user' ? 'grant' : 'modify',
    permissionType: 'role',
    oldValue: { role: oldRole },
    newValue: { role: newRole },
    reason,
    ipAddress,
  });
}

/**
 * 테넌트 접근 권한 변경 기록
 */
export async function recordTenantAccessChange(
  targetUserId: string,
  actorUserId: string,
  action: PermissionAction,
  tenantId: string,
  reason?: string,
  ipAddress?: string
): Promise<void> {
  await recordPermissionChange({
    targetUserId,
    actorUserId,
    action,
    permissionType: 'tenant_access',
    oldValue: action === 'grant' ? null : { tenantId },
    newValue: action === 'revoke' ? null : { tenantId },
    reason,
    ipAddress,
  });
}

/**
 * 3년 경과 로그 삭제 (배치 작업용)
 * 개인정보보호법 준수: 최소 3년 보관 후 삭제 가능
 */
export async function cleanupExpiredPermissionLogs(): Promise<number> {
  const threeYearsAgo = new Date();
  threeYearsAgo.setFullYear(threeYearsAgo.getFullYear() - 3);

  try {
    const result = await db
      .delete(permissionAuditLog)
      .where(lt(permissionAuditLog.createdAt, threeYearsAgo));

    const deletedCount = result.count || 0;

    if (deletedCount > 0) {
      logger.info('Expired permission logs cleaned up', {
        deletedCount,
        olderThan: threeYearsAgo.toISOString(),
      });
    }

    return deletedCount;
  } catch (error) {
    logger.error('Failed to cleanup permission logs', error as Error);
    throw error;
  }
}

/**
 * 특정 사용자의 권한 변경 이력 조회
 */
export async function getPermissionHistory(
  targetUserId: string,
  limit: number = 50
): Promise<typeof permissionAuditLog.$inferSelect[]> {
  return db.query.permissionAuditLog.findMany({
    where: sql`${permissionAuditLog.targetUserId} = ${targetUserId}`,
    orderBy: sql`${permissionAuditLog.createdAt} DESC`,
    limit,
  });
}
