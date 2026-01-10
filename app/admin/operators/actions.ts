'use server';

/**
 * 플랫폼 관리자 계정 관리 서버 액션
 * Admin 콘솔 접근 권한을 가진 관리자 CRUD
 */

import { db, users } from '@/lib/db';
import { sql, eq, desc, and, isNotNull } from 'drizzle-orm';
import { logger } from '@/lib/logger';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { hash } from 'bcryptjs';
import {
  requireOperator,
  requireSuperAdmin,
  requireAdminRole,
  generateTemporaryPassword,
  type AdminRole,
  ADMIN_ROLE_LABELS,
  isValidAdminRole,
  PermissionError,
} from '@/lib/auth/admin-permissions';

// ============================================
// 스키마 정의
// ============================================

const uuidSchema = z.string().uuid('유효한 UUID 형식이 아닙니다.');

const createOperatorSchema = z.object({
  email: z.string().email('유효한 이메일 주소를 입력하세요.'),
  name: z.string().min(1, '이름을 입력하세요.').max(100),
  adminRole: z.enum(['SUPER_ADMIN', 'ADMIN', 'SUPPORT', 'VIEWER']),
  adminNotes: z.string().max(500).optional(),
});

const updateOperatorRoleSchema = z.object({
  operatorId: z.string().uuid(),
  newRole: z.enum(['SUPER_ADMIN', 'ADMIN', 'SUPPORT', 'VIEWER']),
});

// ============================================
// 타입 정의
// ============================================

export interface OperatorListItem {
  id: string;
  email: string;
  name: string;
  adminRole: AdminRole;
  isPlatformAdmin: boolean;
  isActive: boolean;
  has2FA: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  invitedBy: string | null;
  invitedByEmail: string | null;
  mustChangePassword: boolean;
}

export interface OperatorStats {
  total: number;
  byRole: Record<AdminRole, number>;
  active: number;
  inactive: number;
  with2FA: number;
  without2FA: number;
}

export interface ActionResult<T = void> {
  success: boolean;
  error?: string;
  data?: T;
}

// ============================================
// 조회 액션
// ============================================

/**
 * 플랫폼 관리자 목록 조회
 * 권한: ADMIN 이상
 */
export async function getOperatorList(): Promise<OperatorListItem[]> {
  try {
    await requireAdminRole('ADMIN');

    const result = await db.execute(sql`
      SELECT
        u.id,
        u.email,
        u.name,
        u.admin_role,
        u.is_platform_admin,
        u.deleted_at,
        u.totp_enabled,
        u.last_login_at,
        u.created_at,
        u.invited_by,
        u.must_change_password,
        inviter.email as invited_by_email
      FROM users u
      LEFT JOIN users inviter ON inviter.id = u.invited_by
      WHERE u.is_platform_admin = true
         OR u.admin_role IS NOT NULL
      ORDER BY u.created_at DESC
    `);

    return (result as unknown as Array<{
      id: string;
      email: string;
      name: string | null;
      admin_role: string | null;
      is_platform_admin: boolean | null;
      deleted_at: Date | string | null;
      totp_enabled: boolean | null;
      last_login_at: Date | string | null;
      created_at: Date | string;
      invited_by: string | null;
      invited_by_email: string | null;
      must_change_password: boolean | null;
    }>).map((row) => ({
      id: row.id,
      email: row.email,
      name: row.name || row.email.split('@')[0],
      adminRole: (row.admin_role as AdminRole) || 'VIEWER',
      isPlatformAdmin: row.is_platform_admin ?? false,
      isActive: row.deleted_at === null,
      has2FA: row.totp_enabled ?? false,
      lastLoginAt: row.last_login_at
        ? (row.last_login_at instanceof Date
          ? row.last_login_at.toISOString()
          : String(row.last_login_at))
        : null,
      createdAt: row.created_at instanceof Date
        ? row.created_at.toISOString()
        : String(row.created_at),
      invitedBy: row.invited_by,
      invitedByEmail: row.invited_by_email,
      mustChangePassword: row.must_change_password ?? false,
    }));
  } catch (error) {
    if (error instanceof PermissionError) {
      logger.warn('Permission denied for getOperatorList');
      return [];
    }
    logger.error('Failed to fetch operator list', error as Error);
    return [];
  }
}

/**
 * 플랫폼 관리자 통계 조회
 * 권한: ADMIN 이상
 */
export async function getOperatorStats(): Promise<OperatorStats | null> {
  try {
    await requireAdminRole('ADMIN');

    const result = await db.execute(sql`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE admin_role = 'SUPER_ADMIN') as super_admin_count,
        COUNT(*) FILTER (WHERE admin_role = 'ADMIN') as admin_count,
        COUNT(*) FILTER (WHERE admin_role = 'SUPPORT') as support_count,
        COUNT(*) FILTER (WHERE admin_role = 'VIEWER') as viewer_count,
        COUNT(*) FILTER (WHERE deleted_at IS NULL) as active_count,
        COUNT(*) FILTER (WHERE deleted_at IS NOT NULL) as inactive_count,
        COUNT(*) FILTER (WHERE totp_enabled = true) as with_2fa,
        COUNT(*) FILTER (WHERE totp_enabled = false OR totp_enabled IS NULL) as without_2fa
      FROM users
      WHERE is_platform_admin = true OR admin_role IS NOT NULL
    `);

    const row = result[0] as {
      total: string;
      super_admin_count: string;
      admin_count: string;
      support_count: string;
      viewer_count: string;
      active_count: string;
      inactive_count: string;
      with_2fa: string;
      without_2fa: string;
    };

    return {
      total: parseInt(row.total) || 0,
      byRole: {
        SUPER_ADMIN: parseInt(row.super_admin_count) || 0,
        ADMIN: parseInt(row.admin_count) || 0,
        SUPPORT: parseInt(row.support_count) || 0,
        VIEWER: parseInt(row.viewer_count) || 0,
      },
      active: parseInt(row.active_count) || 0,
      inactive: parseInt(row.inactive_count) || 0,
      with2FA: parseInt(row.with_2fa) || 0,
      without2FA: parseInt(row.without_2fa) || 0,
    };
  } catch (error) {
    if (error instanceof PermissionError) {
      logger.warn('Permission denied for getOperatorStats');
      return null;
    }
    logger.error('Failed to fetch operator stats', error as Error);
    return null;
  }
}

// ============================================
// 생성/수정 액션
// ============================================

/**
 * 플랫폼 관리자 생성
 * 권한: SUPER_ADMIN만
 * @returns 생성된 계정 정보 및 임시 비밀번호
 */
export async function createOperator(formData: FormData): Promise<ActionResult<{
  operatorId: string;
  email: string;
  temporaryPassword: string;
}>> {
  try {
    const session = await requireSuperAdmin();

    const rawData = {
      email: formData.get('email') as string,
      name: formData.get('name') as string,
      adminRole: formData.get('adminRole') as string,
      adminNotes: formData.get('adminNotes') as string | undefined,
    };

    const parseResult = createOperatorSchema.safeParse(rawData);
    if (!parseResult.success) {
      return {
        success: false,
        error: parseResult.error.issues[0]?.message || '입력값이 올바르지 않습니다.',
      };
    }

    const { email, name, adminRole, adminNotes } = parseResult.data;

    // 이메일 중복 확인
    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existing.length > 0) {
      return { success: false, error: '이미 등록된 이메일입니다.' };
    }

    // 임시 비밀번호 생성
    const temporaryPassword = generateTemporaryPassword();
    const hashedPassword = await hash(temporaryPassword, 12);

    // 사용자 생성
    const [newOperator] = await db
      .insert(users)
      .values({
        email,
        name,
        passwordHash: hashedPassword,
        adminRole: adminRole as AdminRole,
        isPlatformAdmin: true,
        invitedBy: session.userId,
        invitedAt: new Date(),
        adminNotes: adminNotes || null,
        mustChangePassword: true,
        role: 'admin', // 기본 역할
      })
      .returning({ id: users.id });

    logger.info('Platform operator created', {
      operatorId: newOperator.id,
      email,
      adminRole,
      createdBy: session.userId,
    });

    revalidatePath('/admin/operators');

    return {
      success: true,
      data: {
        operatorId: newOperator.id,
        email,
        temporaryPassword,
      },
    };
  } catch (error) {
    if (error instanceof PermissionError) {
      return { success: false, error: error.message };
    }
    logger.error('Failed to create operator', error as Error);
    return { success: false, error: '관리자 생성에 실패했습니다.' };
  }
}

/**
 * 관리자 역할 변경
 * 권한: SUPER_ADMIN만
 */
export async function updateOperatorRole(
  operatorId: string,
  newRole: AdminRole
): Promise<ActionResult> {
  try {
    const session = await requireSuperAdmin();

    // 입력값 검증
    const parseResult = updateOperatorRoleSchema.safeParse({ operatorId, newRole });
    if (!parseResult.success) {
      return { success: false, error: '입력값이 올바르지 않습니다.' };
    }

    // 자기 자신의 역할 변경 방지
    if (operatorId === session.userId) {
      return { success: false, error: '자신의 역할은 변경할 수 없습니다.' };
    }

    // 대상 확인
    const [target] = await db
      .select({ adminRole: users.adminRole, email: users.email })
      .from(users)
      .where(eq(users.id, operatorId))
      .limit(1);

    if (!target) {
      return { success: false, error: '관리자를 찾을 수 없습니다.' };
    }

    // SUPER_ADMIN 최소 1명 유지 확인 (역할 하향 시)
    if (target.adminRole === 'SUPER_ADMIN' && newRole !== 'SUPER_ADMIN') {
      const superAdminCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(users)
        .where(eq(users.adminRole, 'SUPER_ADMIN'));

      if (parseInt(String(superAdminCount[0]?.count)) <= 1) {
        return { success: false, error: '최소 1명의 슈퍼 관리자가 필요합니다.' };
      }
    }

    await db
      .update(users)
      .set({
        adminRole: newRole,
        updatedAt: new Date(),
      })
      .where(eq(users.id, operatorId));

    logger.info('Operator role updated', {
      operatorId,
      oldRole: target.adminRole,
      newRole,
      updatedBy: session.userId,
    });

    revalidatePath('/admin/operators');

    return { success: true };
  } catch (error) {
    if (error instanceof PermissionError) {
      return { success: false, error: error.message };
    }
    logger.error('Failed to update operator role', error as Error);
    return { success: false, error: '역할 변경에 실패했습니다.' };
  }
}

// ============================================
// 상태 변경 액션
// ============================================

/**
 * 관리자 비활성화
 * 권한: SUPER_ADMIN만
 */
export async function deactivateOperator(operatorId: string): Promise<ActionResult> {
  try {
    const session = await requireSuperAdmin();

    const parseResult = uuidSchema.safeParse(operatorId);
    if (!parseResult.success) {
      return { success: false, error: '유효하지 않은 ID입니다.' };
    }

    // 자기 자신 비활성화 방지
    if (operatorId === session.userId) {
      return { success: false, error: '자신의 계정은 비활성화할 수 없습니다.' };
    }

    // 대상 확인
    const [target] = await db
      .select({ adminRole: users.adminRole, deletedAt: users.deletedAt })
      .from(users)
      .where(eq(users.id, operatorId))
      .limit(1);

    if (!target) {
      return { success: false, error: '관리자를 찾을 수 없습니다.' };
    }

    // SUPER_ADMIN 최소 1명 유지 확인
    if (target.adminRole === 'SUPER_ADMIN') {
      const activeSuperAdmins = await db.execute(sql`
        SELECT COUNT(*) as count FROM users
        WHERE admin_role = 'SUPER_ADMIN' AND deleted_at IS NULL
      `);
      const count = parseInt(String((activeSuperAdmins[0] as { count: string }).count));

      if (count <= 1) {
        return { success: false, error: '최소 1명의 활성 슈퍼 관리자가 필요합니다.' };
      }
    }

    await db
      .update(users)
      .set({
        deletedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(users.id, operatorId));

    logger.info('Operator deactivated', {
      operatorId,
      deactivatedBy: session.userId,
    });

    revalidatePath('/admin/operators');

    return { success: true };
  } catch (error) {
    if (error instanceof PermissionError) {
      return { success: false, error: error.message };
    }
    logger.error('Failed to deactivate operator', error as Error);
    return { success: false, error: '비활성화에 실패했습니다.' };
  }
}

/**
 * 관리자 재활성화
 * 권한: SUPER_ADMIN만
 */
export async function reactivateOperator(operatorId: string): Promise<ActionResult> {
  try {
    const session = await requireSuperAdmin();

    const parseResult = uuidSchema.safeParse(operatorId);
    if (!parseResult.success) {
      return { success: false, error: '유효하지 않은 ID입니다.' };
    }

    await db
      .update(users)
      .set({
        deletedAt: null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, operatorId));

    logger.info('Operator reactivated', {
      operatorId,
      reactivatedBy: session.userId,
    });

    revalidatePath('/admin/operators');

    return { success: true };
  } catch (error) {
    if (error instanceof PermissionError) {
      return { success: false, error: error.message };
    }
    logger.error('Failed to reactivate operator', error as Error);
    return { success: false, error: '재활성화에 실패했습니다.' };
  }
}

/**
 * 관리자 계정 삭제
 * 권한: SUPER_ADMIN만
 * 주의: 완전 삭제이므로 신중히 사용
 */
export async function deleteOperator(operatorId: string): Promise<ActionResult> {
  try {
    const session = await requireSuperAdmin();

    const parseResult = uuidSchema.safeParse(operatorId);
    if (!parseResult.success) {
      return { success: false, error: '유효하지 않은 ID입니다.' };
    }

    // 자기 자신 삭제 방지
    if (operatorId === session.userId) {
      return { success: false, error: '자신의 계정은 삭제할 수 없습니다.' };
    }

    // 대상 확인
    const [target] = await db
      .select({ adminRole: users.adminRole, email: users.email })
      .from(users)
      .where(eq(users.id, operatorId))
      .limit(1);

    if (!target) {
      return { success: false, error: '관리자를 찾을 수 없습니다.' };
    }

    // SUPER_ADMIN 최소 1명 유지 확인
    if (target.adminRole === 'SUPER_ADMIN') {
      const superAdminCount = await db.execute(sql`
        SELECT COUNT(*) as count FROM users WHERE admin_role = 'SUPER_ADMIN'
      `);
      const count = parseInt(String((superAdminCount[0] as { count: string }).count));

      if (count <= 1) {
        return { success: false, error: '최소 1명의 슈퍼 관리자가 필요합니다.' };
      }
    }

    await db.delete(users).where(eq(users.id, operatorId));

    logger.warn('Operator deleted', {
      operatorId,
      operatorEmail: target.email,
      deletedBy: session.userId,
    });

    revalidatePath('/admin/operators');

    return { success: true };
  } catch (error) {
    if (error instanceof PermissionError) {
      return { success: false, error: error.message };
    }
    logger.error('Failed to delete operator', error as Error);
    return { success: false, error: '삭제에 실패했습니다.' };
  }
}

// ============================================
// 비밀번호 관리
// ============================================

/**
 * 관리자 비밀번호 초기화
 * 권한: SUPER_ADMIN만
 * @returns 새 임시 비밀번호
 */
export async function resetOperatorPassword(operatorId: string): Promise<ActionResult<{
  temporaryPassword: string;
}>> {
  try {
    const session = await requireSuperAdmin();

    const parseResult = uuidSchema.safeParse(operatorId);
    if (!parseResult.success) {
      return { success: false, error: '유효하지 않은 ID입니다.' };
    }

    // 대상 확인
    const [target] = await db
      .select({ email: users.email })
      .from(users)
      .where(eq(users.id, operatorId))
      .limit(1);

    if (!target) {
      return { success: false, error: '관리자를 찾을 수 없습니다.' };
    }

    // 새 임시 비밀번호 생성
    const temporaryPassword = generateTemporaryPassword();
    const hashedPassword = await hash(temporaryPassword, 12);

    await db
      .update(users)
      .set({
        passwordHash: hashedPassword,
        mustChangePassword: true,
        updatedAt: new Date(),
      })
      .where(eq(users.id, operatorId));

    logger.info('Operator password reset', {
      operatorId,
      resetBy: session.userId,
    });

    return {
      success: true,
      data: { temporaryPassword },
    };
  } catch (error) {
    if (error instanceof PermissionError) {
      return { success: false, error: error.message };
    }
    logger.error('Failed to reset operator password', error as Error);
    return { success: false, error: '비밀번호 초기화에 실패했습니다.' };
  }
}

// ============================================
// 활동 로그 조회
// ============================================

/**
 * 관리자 활동 로그 조회
 * 권한: ADMIN 이상
 */
export async function getOperatorActivityLog(operatorId: string): Promise<Array<{
  id: string;
  action: string;
  details: string | null;
  createdAt: string;
  ipAddress: string | null;
}>> {
  try {
    await requireAdminRole('ADMIN');

    const parseResult = uuidSchema.safeParse(operatorId);
    if (!parseResult.success) {
      return [];
    }

    // accessLogs 테이블에서 해당 사용자의 로그 조회
    const result = await db.execute(sql`
      SELECT
        id,
        action,
        details,
        created_at,
        ip_address
      FROM access_logs
      WHERE user_id = ${operatorId}
      ORDER BY created_at DESC
      LIMIT 50
    `);

    return (result as unknown as Array<{
      id: string;
      action: string;
      details: string | null;
      created_at: Date | string;
      ip_address: string | null;
    }>).map((row) => ({
      id: row.id,
      action: row.action,
      details: row.details,
      createdAt: row.created_at instanceof Date
        ? row.created_at.toISOString()
        : String(row.created_at),
      ipAddress: row.ip_address,
    }));
  } catch (error) {
    if (error instanceof PermissionError) {
      return [];
    }
    logger.error('Failed to fetch operator activity log', error as Error);
    return [];
  }
}
