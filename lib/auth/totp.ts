/**
 * TOTP 2FA 인증
 * [W-002] 관리자 2FA 필수
 */

import { authenticator } from 'otplib';
import * as QRCode from 'qrcode';
import { db, users } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { logger } from '@/lib/logger';

// TOTP 설정
authenticator.options = {
  step: 30, // 30초 주기
  window: 1, // 앞뒤 1개 토큰 허용 (시간 오차 대응)
};

const APP_NAME = 'SOFA RAG';

export interface TotpSetupResult {
  secret: string;
  qrCodeDataUrl: string;
  otpauthUrl: string;
}

/**
 * TOTP 비밀키 생성
 */
export function generateTotpSecret(): string {
  return authenticator.generateSecret();
}

/**
 * TOTP 설정 정보 생성 (QR 코드 포함)
 */
export async function setupTotp(
  userId: string,
  email: string
): Promise<TotpSetupResult> {
  const secret = generateTotpSecret();

  // otpauth URL 생성
  const otpauthUrl = authenticator.keyuri(email, APP_NAME, secret);

  // QR 코드 생성
  const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl, {
    width: 256,
    margin: 2,
    color: {
      dark: '#000000',
      light: '#FFFFFF',
    },
  });

  logger.info('TOTP setup initiated', { userId });

  return {
    secret,
    qrCodeDataUrl,
    otpauthUrl,
  };
}

/**
 * TOTP 토큰 검증
 */
export function verifyTotpToken(secret: string, token: string): boolean {
  try {
    return authenticator.verify({ token, secret });
  } catch {
    return false;
  }
}

/**
 * 사용자 TOTP 활성화
 */
export async function enableTotpForUser(
  userId: string,
  secret: string,
  token: string,
  backupCodes: string[]
): Promise<{ success: boolean; error?: string }> {
  // 토큰 검증
  if (!verifyTotpToken(secret, token)) {
    return { success: false, error: '유효하지 않은 인증 코드입니다.' };
  }

  try {
    // DB에 TOTP 비밀키 저장
    // 주의: 실제로는 암호화해서 저장해야 함
    await db
      .update(users)
      .set({
        totpSecret: secret,
        totpEnabled: true,
        totpBackupCodes: backupCodes,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));

    logger.info('TOTP enabled for user', { userId });

    return { success: true };
  } catch (error) {
    logger.error('Failed to enable TOTP', error as Error, { userId });
    return { success: false, error: '2FA 활성화에 실패했습니다.' };
  }
}

/**
 * 사용자 TOTP 검증 (로그인 시)
 */
export async function verifyUserTotp(
  userId: string,
  token: string
): Promise<boolean> {
  try {
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: {
        id: true,
        totpSecret: true,
        totpEnabled: true,
      },
    });

    if (!user) {
      return false;
    }

    // TOTP가 활성화되지 않은 경우
    if (!user.totpEnabled || !user.totpSecret) {
      logger.warn('TOTP not enabled for user', { userId });
      return false;
    }

    // 토큰 검증
    const isValid = verifyTotpToken(user.totpSecret, token);
    logger.info('TOTP verification attempted', { userId, isValid });

    return isValid;
  } catch (error) {
    logger.error('TOTP verification failed', error as Error, { userId });
    return false;
  }
}

/**
 * 사용자 TOTP 비활성화
 */
export async function disableTotpForUser(userId: string): Promise<boolean> {
  try {
    await db
      .update(users)
      .set({
        totpSecret: null,
        totpEnabled: false,
        totpBackupCodes: null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));

    logger.info('TOTP disabled for user', { userId });
    return true;
  } catch (error) {
    logger.error('Failed to disable TOTP', error as Error, { userId });
    return false;
  }
}

/**
 * 백업 코드 생성 (TOTP 분실 시 사용)
 */
export function generateBackupCodes(count: number = 10): string[] {
  const codes: string[] = [];
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

  for (let i = 0; i < count; i++) {
    let code = '';
    for (let j = 0; j < 8; j++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    // 형식: XXXX-XXXX
    codes.push(`${code.slice(0, 4)}-${code.slice(4)}`);
  }

  return codes;
}

/**
 * 관리자 역할이 TOTP 필요한지 확인
 */
export function requiresTotpForRole(role: string): boolean {
  return role === 'admin' || role === 'internal_operator';
}
