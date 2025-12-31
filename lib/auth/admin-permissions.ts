/**
 * 플랫폼 관리자 권한 관리 (서버 전용)
 * Admin 콘솔 접근 권한 및 역할 체계 정의
 */

import { validateSession, type SessionData } from './session';

// 타입과 상수는 admin-types.ts에서 re-export
export {
  type AdminRole,
  ADMIN_ROLE_LABELS,
  ADMIN_ROLE_DESCRIPTIONS,
  ADMIN_ROLE_HIERARCHY,
  ALL_ADMIN_ROLES,
  getRoleLevel,
  hasRoleOrHigher,
  isValidAdminRole,
  generateTemporaryPassword,
} from './admin-types';

// ============================================
// 권한 체크 함수 (서버 전용)
// ============================================

/**
 * 세션이 플랫폼 관리자인지 확인
 */
export function isOperator(session: SessionData | null): boolean {
  if (!session?.isLoggedIn) return false;
  return session.isPlatformAdmin === true || session.adminRole != null;
}

// ============================================
// 권한 검증 헬퍼 (서버 액션용)
// ============================================

export class PermissionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PermissionError';
  }
}

/**
 * 플랫폼 관리자 권한 필수 체크
 * @throws PermissionError 관리자가 아닌 경우
 */
export async function requireOperator(): Promise<SessionData> {
  const session = await validateSession();

  if (!session) {
    throw new PermissionError('로그인이 필요합니다.');
  }

  if (!isOperator(session)) {
    throw new PermissionError('관리자 권한이 필요합니다.');
  }

  return session;
}

/**
 * SUPER_ADMIN 권한 필수 체크
 * @throws PermissionError SUPER_ADMIN이 아닌 경우
 */
export async function requireSuperAdmin(): Promise<SessionData> {
  const session = await requireOperator();

  if (session.adminRole !== 'SUPER_ADMIN') {
    throw new PermissionError('슈퍼 관리자 권한이 필요합니다.');
  }

  return session;
}

/**
 * 특정 역할 이상 권한 필수 체크
 * @param minRole 최소 필요 역할
 * @throws PermissionError 권한 부족 시
 */
export async function requireAdminRole(minRole: import('./admin-types').AdminRole): Promise<SessionData> {
  const { hasRoleOrHigher, ADMIN_ROLE_LABELS } = await import('./admin-types');
  const session = await requireOperator();

  if (!hasRoleOrHigher(session.adminRole, minRole)) {
    throw new PermissionError(`${ADMIN_ROLE_LABELS[minRole]} 이상 권한이 필요합니다.`);
  }

  return session;
}
