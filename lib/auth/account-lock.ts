/**
 * 계정 잠금 관리
 * [C-003] 5회 실패 시 30분 잠금
 */

import { db, loginAttempts, users } from '@/lib/db';
import { eq, and, gte, sql } from 'drizzle-orm';

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_DURATION_MINUTES = 30;

interface LoginAttemptResult {
  allowed: boolean;
  remainingAttempts: number;
  lockedUntil: Date | null;
  lockDurationMinutes: number;
}

/**
 * 로그인 시도 가능 여부 확인
 */
export async function canAttemptLogin(
  email: string,
  _ipAddress?: string
): Promise<LoginAttemptResult> {
  const now = new Date();

  // 1. 사용자 계정 잠금 상태 확인
  const user = await db.query.users.findFirst({
    where: eq(users.email, email),
    columns: {
      id: true,
      lockedUntil: true,
      failedLoginCount: true,
    },
  });

  // 사용자가 존재하고 잠금 상태인 경우
  if (user?.lockedUntil && user.lockedUntil > now) {
    return {
      allowed: false,
      remainingAttempts: 0,
      lockedUntil: user.lockedUntil,
      lockDurationMinutes: LOCK_DURATION_MINUTES,
    };
  }

  // 2. 최근 로그인 시도 횟수 확인 (IP 기반)
  const windowStart = new Date(now.getTime() - LOCK_DURATION_MINUTES * 60 * 1000);

  const recentAttempts = await db
    .select({ count: sql<number>`count(*)` })
    .from(loginAttempts)
    .where(
      and(
        eq(loginAttempts.email, email),
        eq(loginAttempts.success, false),
        gte(loginAttempts.createdAt, windowStart)
      )
    );

  const failedCount = Number(recentAttempts[0]?.count || 0);
  const remainingAttempts = Math.max(0, MAX_FAILED_ATTEMPTS - failedCount);

  // 이미 최대 시도 횟수 초과
  if (failedCount >= MAX_FAILED_ATTEMPTS) {
    const lockedUntil = new Date(now.getTime() + LOCK_DURATION_MINUTES * 60 * 1000);

    // 사용자 계정 잠금 업데이트
    if (user) {
      await db
        .update(users)
        .set({
          lockedUntil,
          failedLoginCount: failedCount,
        })
        .where(eq(users.id, user.id));
    }

    return {
      allowed: false,
      remainingAttempts: 0,
      lockedUntil,
      lockDurationMinutes: LOCK_DURATION_MINUTES,
    };
  }

  return {
    allowed: true,
    remainingAttempts,
    lockedUntil: null,
    lockDurationMinutes: LOCK_DURATION_MINUTES,
  };
}

/**
 * 로그인 시도 기록
 */
export async function recordLoginAttempt(
  email: string,
  success: boolean,
  ipAddress?: string
): Promise<void> {
  const now = new Date();

  // 로그인 시도 기록
  await db.insert(loginAttempts).values({
    email,
    ipAddress: ipAddress || null,
    success,
    createdAt: now,
  });

  // 성공 시 실패 카운트 리셋
  if (success) {
    await db
      .update(users)
      .set({
        failedLoginCount: 0,
        lockedUntil: null,
        lastLoginAt: now,
      })
      .where(eq(users.email, email));
  } else {
    // 실패 시 카운트 증가
    await db
      .update(users)
      .set({
        failedLoginCount: sql`${users.failedLoginCount} + 1`,
      })
      .where(eq(users.email, email));
  }
}

/**
 * 계정 잠금 해제 (관리자용)
 */
export async function unlockAccount(userId: string): Promise<void> {
  await db
    .update(users)
    .set({
      failedLoginCount: 0,
      lockedUntil: null,
    })
    .where(eq(users.id, userId));
}

/**
 * 계정 잠금 상태 확인
 */
export async function isAccountLocked(email: string): Promise<boolean> {
  const result = await canAttemptLogin(email);
  return !result.allowed;
}

/**
 * 남은 잠금 시간 (분)
 */
export async function getRemainingLockTime(email: string): Promise<number> {
  const user = await db.query.users.findFirst({
    where: eq(users.email, email),
    columns: { lockedUntil: true },
  });

  if (!user?.lockedUntil) {
    return 0;
  }

  const now = new Date();
  const remaining = user.lockedUntil.getTime() - now.getTime();

  return remaining > 0 ? Math.ceil(remaining / (60 * 1000)) : 0;
}

/**
 * 오래된 로그인 시도 기록 정리 (배치 작업용)
 * 30일 이상 된 기록 삭제
 */
export async function cleanupOldLoginAttempts(): Promise<number> {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const result = await db
    .delete(loginAttempts)
    .where(sql`${loginAttempts.createdAt} < ${thirtyDaysAgo}`);

  return result.rowCount || 0;
}
