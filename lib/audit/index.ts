/**
 * Audit 모듈 통합 export
 */

// F36 접속기록
export {
  AuditAction,
  TargetType,
  createAuditLog,
  createAuditLogFromRequest,
  logLoginSuccess,
  logLoginFailure,
  logPersonalDataAccess,
  verifyLogIntegrity,
  type AuditActionType,
  type TargetTypeValue,
  type AuditResult,
  type AuditLogInput,
} from './logger';

// 권한 변경 이력
export {
  recordPermissionChange,
  recordRoleChange,
  recordTenantAccessChange,
  cleanupExpiredPermissionLogs,
  getPermissionHistory,
  type PermissionAction,
  type PermissionChange,
} from './permission-audit';
