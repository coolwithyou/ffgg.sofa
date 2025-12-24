/**
 * 비밀번호 처리 유틸리티
 * [W-001] 비밀번호 복잡성 정책
 * [W-008] 비밀번호 변경 주기 관리
 */

import bcrypt from 'bcrypt';
import { z } from 'zod';

const SALT_ROUNDS = 12;
const PASSWORD_CHANGE_DAYS = 90; // 90일 주기

/**
 * 비밀번호 복잡성 검증 스키마
 * - 최소 8자리
 * - 영문 대문자 1개 이상
 * - 영문 소문자 1개 이상
 * - 숫자 1개 이상
 * - 특수문자 1개 이상
 */
export const passwordSchema = z
  .string()
  .min(8, '비밀번호는 최소 8자리 이상이어야 합니다.')
  .max(128, '비밀번호는 최대 128자리까지 가능합니다.')
  .regex(/[A-Z]/, '영문 대문자를 1개 이상 포함해야 합니다.')
  .regex(/[a-z]/, '영문 소문자를 1개 이상 포함해야 합니다.')
  .regex(/[0-9]/, '숫자를 1개 이상 포함해야 합니다.')
  .regex(
    /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/,
    '특수문자를 1개 이상 포함해야 합니다.'
  );

/**
 * 비밀번호 복잡성 검증
 */
export function validatePassword(password: string): {
  valid: boolean;
  errors: string[];
} {
  const result = passwordSchema.safeParse(password);

  if (result.success) {
    return { valid: true, errors: [] };
  }

  return {
    valid: false,
    errors: result.error.issues.map((e) => e.message),
  };
}

/**
 * 비밀번호 해시 생성
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * 비밀번호 검증
 */
export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * 비밀번호 변경 필요 여부 확인
 * [W-008] 90일 주기
 */
export function isPasswordChangeRequired(lastChangedAt: Date | null): boolean {
  if (!lastChangedAt) {
    return true; // 변경 기록 없으면 변경 필요
  }

  const now = new Date();
  const daysSinceChange = Math.floor(
    (now.getTime() - lastChangedAt.getTime()) / (1000 * 60 * 60 * 24)
  );

  return daysSinceChange >= PASSWORD_CHANGE_DAYS;
}

/**
 * 비밀번호 변경까지 남은 일수
 */
export function daysUntilPasswordExpiry(
  lastChangedAt: Date | null
): number | null {
  if (!lastChangedAt) {
    return 0;
  }

  const now = new Date();
  const daysSinceChange = Math.floor(
    (now.getTime() - lastChangedAt.getTime()) / (1000 * 60 * 60 * 24)
  );

  const daysRemaining = PASSWORD_CHANGE_DAYS - daysSinceChange;
  return daysRemaining > 0 ? daysRemaining : 0;
}

/**
 * 일반적인 취약한 비밀번호 패턴 체크
 */
export function isWeakPassword(password: string): boolean {
  const weakPatterns = [
    /^(.)\1+$/, // 같은 문자 반복 (aaaaaaaa)
    /^(012345|123456|234567|345678|456789|567890)/, // 연속 숫자
    /^(abcdef|bcdefg|qwerty|asdfgh|zxcvbn)/i, // 연속 문자
    /^password/i,
    /^admin/i,
    /^user/i,
    /^guest/i,
  ];

  return weakPatterns.some((pattern) => pattern.test(password));
}

/**
 * 비밀번호 강도 점수 (0-100)
 */
export function getPasswordStrength(password: string): number {
  let score = 0;

  // 길이 점수
  if (password.length >= 8) score += 20;
  if (password.length >= 12) score += 10;
  if (password.length >= 16) score += 10;

  // 문자 종류 점수
  if (/[a-z]/.test(password)) score += 15;
  if (/[A-Z]/.test(password)) score += 15;
  if (/[0-9]/.test(password)) score += 15;
  if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) score += 15;

  // 약한 패턴 감점
  if (isWeakPassword(password)) score -= 30;

  return Math.max(0, Math.min(100, score));
}
