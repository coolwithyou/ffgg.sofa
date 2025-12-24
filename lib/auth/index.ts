/**
 * 인증 모듈 통합 export
 */

// 세션 관리
export {
  getSession,
  createSession,
  refreshSession,
  validateSession,
  destroySession,
  hasSession,
  getCurrentUserId,
  getCurrentTenantId,
  isAdmin,
  type SessionData,
} from './session';

// 비밀번호 처리
export {
  passwordSchema,
  validatePassword,
  hashPassword,
  verifyPassword,
  isPasswordChangeRequired,
  daysUntilPasswordExpiry,
  isWeakPassword,
  getPasswordStrength,
} from './password';

// 계정 잠금
export {
  canAttemptLogin,
  recordLoginAttempt,
  unlockAccount,
  isAccountLocked,
  getRemainingLockTime,
  cleanupOldLoginAttempts,
} from './account-lock';

// 2FA (TOTP)
export {
  generateTotpSecret,
  setupTotp,
  verifyTotpToken,
  enableTotpForUser,
  verifyUserTotp,
  disableTotpForUser,
  generateBackupCodes,
  requiresTotpForRole,
  type TotpSetupResult,
} from './totp';
