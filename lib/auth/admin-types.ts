/**
 * 플랫폼 관리자 타입 및 상수 정의
 * 클라이언트/서버 양쪽에서 안전하게 import 가능
 */

// ============================================
// 타입 정의
// ============================================

/** 플랫폼 관리자 역할 */
export type AdminRole = 'SUPER_ADMIN' | 'ADMIN' | 'SUPPORT' | 'VIEWER';

// ============================================
// 상수 정의
// ============================================

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
// 순수 함수 (서버 의존성 없음)
// ============================================

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

/**
 * 관리자 역할 유효성 검사
 */
export function isValidAdminRole(role: string): role is AdminRole {
  return ALL_ADMIN_ROLES.includes(role as AdminRole);
}

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
