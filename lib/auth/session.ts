/**
 * iron-session 기반 세션 관리
 * [C-006] 세션 타임아웃 30분 설정
 */

import { getIronSession, SessionOptions } from 'iron-session';
import { cookies } from 'next/headers';

// 세션 데이터 타입
export interface SessionData {
  userId: string;
  email: string;
  tenantId: string;
  role: 'user' | 'admin' | 'internal_operator';
  isLoggedIn: boolean;
  createdAt: number; // 세션 생성 시간 (timestamp)
  lastActivityAt: number; // 마지막 활동 시간
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
};

// 세션 설정
const SESSION_TTL = 30 * 60; // 30분 (초 단위)

// 개발용 기본 비밀번호 (32자 이상 필요)
const DEV_SESSION_PASSWORD = 'dev_session_password_must_be_32_chars_long';

// 세션 비밀번호 (빌드 시에는 기본값 사용)
const SESSION_PASSWORD = process.env.SESSION_SECRET || DEV_SESSION_PASSWORD;

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

/**
 * 세션 생성 (로그인 시)
 */
export async function createSession(data: Omit<SessionData, 'isLoggedIn' | 'createdAt' | 'lastActivityAt'>): Promise<void> {
  const cookieStore = await cookies();
  const session = await getIronSession<SessionData>(cookieStore, sessionOptions);

  const now = Date.now();

  session.userId = data.userId;
  session.email = data.email;
  session.tenantId = data.tenantId;
  session.role = data.role;
  session.isLoggedIn = true;
  session.createdAt = now;
  session.lastActivityAt = now;

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
 * [C-006] 30분 타임아웃 체크
 */
export async function validateSession(): Promise<SessionData | null> {
  const session = await getSession();

  if (!session.isLoggedIn) {
    return null;
  }

  const now = Date.now();
  const lastActivity = session.lastActivityAt;
  const sessionTimeout = SESSION_TTL * 1000; // ms로 변환

  // 30분 이상 비활성 시 세션 무효화
  if (now - lastActivity > sessionTimeout) {
    await destroySession();
    return null;
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
