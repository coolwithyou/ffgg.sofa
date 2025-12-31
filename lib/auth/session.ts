/**
 * iron-session 기반 세션 관리
 * [C-006] 세션 타임아웃 300분 설정 (5시간)
 */

import { getIronSession, SessionOptions } from 'iron-session';
import { cookies } from 'next/headers';

// 플랫폼 관리자 역할 타입 (admin-permissions.ts에서 재정의)
export type AdminRole = 'SUPER_ADMIN' | 'ADMIN' | 'SUPPORT' | 'VIEWER';

// 세션 데이터 타입
export interface SessionData {
  userId: string;
  email: string;
  tenantId: string;
  role: 'user' | 'admin' | 'internal_operator';
  isLoggedIn: boolean;
  createdAt: number; // 세션 생성 시간 (timestamp)
  lastActivityAt: number; // 마지막 활동 시간
  expiresAt: number; // 세션 만료 시간 (Unix timestamp, 초 단위)
  // 플랫폼 관리자 필드
  adminRole?: AdminRole; // 플랫폼 관리자 역할
  isPlatformAdmin?: boolean; // 플랫폼 관리자 여부
  mustChangePassword?: boolean; // 임시 비밀번호 변경 필요
}

// 세션 기본값
const defaultSession: SessionData = {
  userId: '',
  email: '',
  tenantId: '',
  role: 'user',
  isLoggedIn: false,
  createdAt: 0,
  lastActivityAt: 0,
  expiresAt: 0,
};

// 세션 설정
const SESSION_TTL = 300 * 60; // 300분 (5시간, 초 단위)
const SESSION_EXTEND_AMOUNT = 60 * 60; // 60분 연장 (초 단위)

// 외부에서 TTL 조회용 export
export { SESSION_TTL, SESSION_EXTEND_AMOUNT };

// 개발용 기본 비밀번호 (32자 이상 필요)
const DEV_SESSION_PASSWORD = 'dev_session_password_must_be_32_chars_long';

// 세션 비밀번호 - 프로덕션에서는 환경변수 필수
const SESSION_PASSWORD = (() => {
  const secret = process.env.SESSION_SECRET;

  // 환경변수가 설정되어 있으면 사용
  if (secret) {
    return secret;
  }

  // 개발 환경에서는 기본값 사용
  if (process.env.NODE_ENV !== 'production') {
    console.warn('[SECURITY] SESSION_SECRET이 설정되지 않았습니다. 개발용 기본값을 사용합니다.');
    return DEV_SESSION_PASSWORD;
  }

  // 프로덕션에서 미설정 시 에러 로그
  // Vercel에서는 환경변수가 런타임에 주입되므로 빌드 시점에서는 확인 불가
  // 앱 크래시 방지를 위해 기본값 사용하지만 반드시 환경변수 설정 필요
  console.error('[SECURITY CRITICAL] SESSION_SECRET이 프로덕션에서 설정되지 않았습니다!');
  return DEV_SESSION_PASSWORD;
})();

export const sessionOptions: SessionOptions = {
  password: SESSION_PASSWORD,
  cookieName: 'sofa_session',
  ttl: SESSION_TTL,
  cookieOptions: {
    // 프로덕션에서는 secure: true
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
  },
};

/**
 * 현재 세션 가져오기
 */
export async function getSession(): Promise<SessionData> {
  const cookieStore = await cookies();
  const session = await getIronSession<SessionData>(cookieStore, sessionOptions);

  // 기본값 병합
  return {
    ...defaultSession,
    ...session,
  };
}

/** 세션 생성에 필요한 데이터 타입 */
export type CreateSessionData = Omit<
  SessionData,
  'isLoggedIn' | 'createdAt' | 'lastActivityAt' | 'expiresAt'
>;

/**
 * 세션 생성 (로그인 시)
 */
export async function createSession(data: CreateSessionData): Promise<void> {
  const cookieStore = await cookies();
  const session = await getIronSession<SessionData>(cookieStore, sessionOptions);

  const now = Date.now();
  const nowSeconds = Math.floor(now / 1000);

  session.userId = data.userId;
  session.email = data.email;
  session.tenantId = data.tenantId;
  session.role = data.role;
  session.isLoggedIn = true;
  session.createdAt = now;
  session.lastActivityAt = now;
  session.expiresAt = nowSeconds + SESSION_TTL; // 300분 후 만료

  // 플랫폼 관리자 필드
  session.adminRole = data.adminRole;
  session.isPlatformAdmin = data.isPlatformAdmin;
  session.mustChangePassword = data.mustChangePassword;

  await session.save();
}

/**
 * 세션 갱신 (활동 시)
 */
export async function refreshSession(): Promise<SessionData | null> {
  const cookieStore = await cookies();
  const session = await getIronSession<SessionData>(cookieStore, sessionOptions);

  if (!session.isLoggedIn) {
    return null;
  }

  // 마지막 활동 시간 업데이트
  session.lastActivityAt = Date.now();
  await session.save();

  return session;
}

/**
 * 세션 유효성 검사
 * [C-006] expiresAt 기준 만료 체크
 */
export async function validateSession(): Promise<SessionData | null> {
  const session = await getSession();

  if (!session.isLoggedIn) {
    return null;
  }

  const nowSeconds = Math.floor(Date.now() / 1000);

  // expiresAt 기준 만료 체크
  if (session.expiresAt && nowSeconds >= session.expiresAt) {
    await destroySession();
    return null;
  }

  // 기존 세션 호환성: expiresAt이 없는 경우 lastActivityAt 기반 체크
  if (!session.expiresAt) {
    const lastActivity = session.lastActivityAt;
    const sessionTimeout = SESSION_TTL * 1000; // ms로 변환
    if (Date.now() - lastActivity > sessionTimeout) {
      await destroySession();
      return null;
    }
  }

  return session;
}

/**
 * 세션 삭제 (로그아웃 시)
 */
export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  const session = await getIronSession<SessionData>(cookieStore, sessionOptions);

  session.destroy();
}

/**
 * 세션이 있는지 빠르게 확인
 */
export async function hasSession(): Promise<boolean> {
  const session = await getSession();
  return session.isLoggedIn;
}

/**
 * 세션에서 사용자 ID 가져오기
 */
export async function getCurrentUserId(): Promise<string | null> {
  const session = await validateSession();
  return session?.userId || null;
}

/**
 * 세션에서 테넌트 ID 가져오기
 */
export async function getCurrentTenantId(): Promise<string | null> {
  const session = await validateSession();
  return session?.tenantId || null;
}

/**
 * 관리자 권한 확인
 */
export async function isAdmin(): Promise<boolean> {
  const session = await validateSession();
  return session?.role === 'admin' || session?.role === 'internal_operator';
}

/**
 * 세션 연장 (60분 추가)
 * @returns 새로운 만료 시간 또는 null (세션 없음)
 */
export async function extendSession(): Promise<{ expiresAt: number } | null> {
  const cookieStore = await cookies();
  const session = await getIronSession<SessionData>(cookieStore, sessionOptions);

  if (!session.isLoggedIn) {
    return null;
  }

  const nowSeconds = Math.floor(Date.now() / 1000);

  // 이미 만료된 세션은 연장 불가
  if (session.expiresAt && nowSeconds >= session.expiresAt) {
    return null;
  }

  // 60분 연장
  session.expiresAt = (session.expiresAt || nowSeconds) + SESSION_EXTEND_AMOUNT;
  session.lastActivityAt = Date.now();

  await session.save();

  return { expiresAt: session.expiresAt };
}
