/**
 * 빌링키 암호화/복호화
 * [Billing System] PIPA 준수를 위한 AES-256-GCM 암호화
 *
 * 빌링키는 결제 실행이 가능한 민감 정보이므로 DB 저장 시 암호화 필수
 *
 * @see Gordon PIPA Review - billingKey 암호화 필수
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { billingEnv } from '@/lib/config/billing-env';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // 128 bits
const AUTH_TAG_LENGTH = 16; // 128 bits

/**
 * 암호화 키를 Buffer로 변환
 * 환경변수는 64자 hex string (32바이트)
 */
function getEncryptionKey(): Buffer {
  const keyHex = billingEnv.encryption.billingKeySecret;
  if (!keyHex || keyHex.length < 64) {
    throw new Error(
      'BILLING_ENCRYPTION_KEY must be at least 64 hex characters (32 bytes)'
    );
  }
  return Buffer.from(keyHex.slice(0, 64), 'hex');
}

/**
 * 빌링키 암호화
 *
 * @param billingKey 평문 빌링키
 * @returns 암호화된 문자열 (iv:authTag:encrypted 형식)
 *
 * @example
 * const encrypted = encryptBillingKey('billingkey_xxxxx');
 * // "a1b2c3...:d4e5f6...:g7h8i9..."
 */
export function encryptBillingKey(billingKey: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);

  const cipher = createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(billingKey, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  // iv:authTag:encrypted 형태로 저장
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/**
 * 빌링키 복호화
 *
 * @param encryptedData 암호화된 문자열 (iv:authTag:encrypted 형식)
 * @returns 평문 빌링키
 *
 * @throws 복호화 실패 시 에러
 */
export function decryptBillingKey(encryptedData: string): string {
  const parts = encryptedData.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted billing key format');
  }

  const [ivHex, authTagHex, encrypted] = parts;
  const key = getEncryptionKey();

  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * 암호화된 빌링키인지 확인
 * (iv:authTag:encrypted 형식인지 체크)
 */
export function isEncryptedBillingKey(value: string): boolean {
  const parts = value.split(':');
  if (parts.length !== 3) return false;

  const [iv, authTag] = parts;
  // IV는 32 hex chars (16 bytes), authTag도 32 hex chars
  return iv.length === 32 && authTag.length === 32;
}

/**
 * 빌링키 마스킹 (로그용)
 *
 * @param billingKey 빌링키 (암호화/평문 모두 가능)
 * @returns 마스킹된 문자열
 *
 * @example
 * maskBillingKey('billingkey_abc123xyz') // "bil***xyz"
 */
export function maskBillingKey(billingKey: string): string {
  if (!billingKey) return '***';

  // 암호화된 형태면 첫 부분만 표시
  if (isEncryptedBillingKey(billingKey)) {
    return `enc:${billingKey.slice(0, 8)}***`;
  }

  // 평문이면 앞 3자 + *** + 뒤 3자
  if (billingKey.length <= 6) {
    return '***';
  }

  return `${billingKey.slice(0, 3)}***${billingKey.slice(-3)}`;
}
