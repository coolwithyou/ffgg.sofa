/**
 * 플랫폼 관리자 권한 관리
 * Admin 콘솔 접근 권한 및 역할 체계 정의
 */

import { validateSession, type SessionData } from './session';

// ============================================
// 타입 정의
// ============================================

/** 플랫폼 관리자 역할 */
export type AdminRole = 'SUPER_ADMIN' | 'ADMIN' | 'SUPPORT' | 'VIEWER';

/** 관리자 역할 한글 라벨 */
export const ADMIN_ROLE_LABELS: Record<AdminRole, string> = {
  SUPER_ADMIN: '슈퍼 관리자',
  ADMIN: '관리자',
  SUPPORT: '지원 담당자',
  VIEWER: '뷰어',
};

/** 관리자 역할 설명 */
export const ADMIN_ROLE_DESCRIPTIONS: Record<AdminRole, string> = {
  SUPER_ADMIN: '모든 권한 + 관리자 관리',
  ADMIN: '테넌트/챗봇/문서 관리',
  SUPPORT: '읽기 + 제한적 수정',
  VIEWER: '읽기 전용',
};

/** 관리자 역할 계층 (숫자가 높을수록 상위 권한) */
export const ADMIN_ROLE_HIERARCHY: Record<AdminRole, number> = {
  SUPER_ADMIN: 100,
  ADMIN: 75,
  SUPPORT: 50,
  VIEWER: 25,
};

/** 모든 관리자 역할 배열 (계층 순) */
export const ALL_ADMIN_ROLES: AdminRole[] = ['SUPER_ADMIN', 'ADMIN', 'SUPPORT', 'VIEWER'];

// ============================================
// 권한 체크 함수
// ============================================

/**
 * 세션이 플랫폼 관리자인지 확인
 */
export function isOperator(session: SessionData | null): boolean {
  if (!session?.isLoggedIn) return false;
  return session.isPlatformAdmin === true || session.adminRole != null;
}

/**
 * 특정 역할의 권한 레벨 반환
 */
export function getRoleLevel(role: AdminRole | null | undefined): number {
  if (!role) return 0;
  return ADMIN_ROLE_HIERARCHY[role] ?? 0;
}

/**
 * 역할 A가 역할 B 이상의 권한을 가지는지 확인
 */
export function hasRoleOrHigher(
  currentRole: AdminRole | null | undefined,
  requiredRole: AdminRole
): boolean {
  return getRoleLevel(currentRole) >= getRoleLevel(requiredRole);
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
export async function requireAdminRole(minRole: AdminRole): Promise<SessionData> {
  const session = await requireOperator();

  if (!hasRoleOrHigher(session.adminRole, minRole)) {
    throw new PermissionError(`${ADMIN_ROLE_LABELS[minRole]} 이상 권한이 필요합니다.`);
  }

  return session;
}

// ============================================
// 유틸리티 함수
// ============================================

/**
 * 임시 비밀번호 생성 (8자리 영숫자)
 */
export function generateTemporaryPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let password = '';
  for (let i = 0; i < 8; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

/**
 * 관리자 역할 유효성 검사
 */
export function isValidAdminRole(role: string): role is AdminRole {
  return ALL_ADMIN_ROLES.includes(role as AdminRole);
}
