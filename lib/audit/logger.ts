/**
 * F36 접속기록 로거
 * [C-001] 개인정보보호법 고시 제8조 준수
 *
 * 기록 항목:
 * - 누가 (userId)
 * - 언제 (timestamp)
 * - 어디서 (ipAddress)
 * - 무엇을 (action, targetType, targetId)
 * - 결과 (result)
 *
 * 보관 기간: 최소 1년 (개인정보 접근 기록은 2년)
 */

import { db, accessLogs } from '@/lib/db';
import { createHash } from 'crypto';

// 액션 타입 정의
export const AuditAction = {
  // 인증 관련
  LOGIN_SUCCESS: 'login_success',
  LOGIN_FAILURE: 'login_failure',
  LOGOUT: 'logout',
  PASSWORD_CHANGE: 'password_change',
  PASSWORD_RESET_REQUEST: 'password_reset_request',
  PASSWORD_RESET_COMPLETE: 'password_reset_complete',
  SESSION_CREATED: 'session_created',
  SESSION_EXPIRED: 'session_expired',

  // 개인정보 접근
  USER_VIEW: 'user_view',
  USER_LIST: 'user_list',
  USER_CREATE: 'user_create',
  USER_UPDATE: 'user_update',
  USER_DELETE: 'user_delete',
  USER_EXPORT: 'user_export',

  // 문서 관련
  DOCUMENT_VIEW: 'document_view',
  DOCUMENT_LIST: 'document_list',
  DOCUMENT_CREATE: 'document_create',
  DOCUMENT_UPDATE: 'document_update',
  DOCUMENT_DELETE: 'document_delete',
  DOCUMENT_DOWNLOAD: 'document_download',

  // 청크 관련
  CHUNK_APPROVE: 'chunk_approve',
  CHUNK_REJECT: 'chunk_reject',
  CHUNK_MODIFY: 'chunk_modify',

  // 대화 관련
  CONVERSATION_VIEW: 'conversation_view',
  CONVERSATION_DELETE: 'conversation_delete',

  // 설정 관련
  SETTINGS_VIEW: 'settings_view',
  SETTINGS_UPDATE: 'settings_update',

  // 권한 관련
  PERMISSION_GRANT: 'permission_grant',
  PERMISSION_REVOKE: 'permission_revoke',
  PERMISSION_MODIFY: 'permission_modify',

  // 테넌트 관련
  TENANT_VIEW: 'tenant_view',
  TENANT_CREATE: 'tenant_create',
  TENANT_UPDATE: 'tenant_update',
  TENANT_DELETE: 'tenant_delete',
} as const;

export type AuditActionType = (typeof AuditAction)[keyof typeof AuditAction];

// 대상 타입 정의
export const TargetType = {
  USER: 'user',
  DOCUMENT: 'document',
  CHUNK: 'chunk',
  CONVERSATION: 'conversation',
  TENANT: 'tenant',
  SETTINGS: 'settings',
  SESSION: 'session',
} as const;

export type TargetTypeValue = (typeof TargetType)[keyof typeof TargetType];

// 결과 타입
export type AuditResult = 'success' | 'failure';

// 접속기록 입력 인터페이스
export interface AuditLogInput {
  userId: string;
  tenantId?: string;
  action: AuditActionType;
  targetType?: TargetTypeValue;
  targetId?: string;
  ipAddress?: string;
  userAgent?: string;
  result: AuditResult;
  details?: Record<string, unknown>;
}

/**
 * 로그 무결성 검증용 해시 생성
 * 이전 로그의 해시를 포함하여 체인 형성
 */
function generateIntegrityHash(
  data: Omit<AuditLogInput, 'details'> & { timestamp: string },
  previousHash?: string
): string {
  const payload = JSON.stringify({
    ...data,
    previousHash: previousHash || 'GENESIS',
  });

  return createHash('sha256').update(payload).digest('hex');
}

/**
 * 마지막 로그의 무결성 해시 조회
 */
async function getLastIntegrityHash(tenantId?: string): Promise<string | null> {
  try {
    // 가장 최근 로그의 해시 조회
    const result = await db.query.accessLogs.findFirst({
      where: tenantId
        ? (logs, { eq }) => eq(logs.tenantId, tenantId)
        : undefined,
      orderBy: (logs, { desc }) => [desc(logs.createdAt)],
      columns: { integrityHash: true },
    });

    return result?.integrityHash || null;
  } catch {
    // 첫 로그인 경우 null 반환
    return null;
  }
}

/**
 * 접속기록 생성
 */
export async function createAuditLog(input: AuditLogInput): Promise<void> {
  const timestamp = new Date().toISOString();

  // 이전 해시 조회 (체인 형성)
  const previousHash = await getLastIntegrityHash(input.tenantId);

  // 무결성 해시 생성
  const integrityHash = generateIntegrityHash(
    {
      userId: input.userId,
      tenantId: input.tenantId,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
      result: input.result,
      timestamp,
    },
    previousHash || undefined
  );

  // DB에 기록
  await db.insert(accessLogs).values({
    userId: input.userId,
    tenantId: input.tenantId,
    action: input.action,
    targetType: input.targetType,
    targetId: input.targetId,
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
    result: input.result,
    details: input.details || {},
    integrityHash,
  });
}

/**
 * 요청 컨텍스트에서 접속기록 생성 (헬퍼)
 */
export function createAuditLogFromRequest(
  request: Request,
  input: Omit<AuditLogInput, 'ipAddress' | 'userAgent'>
): Promise<void> {
  const headers = request.headers;

  // IP 주소 추출 (프록시 환경 고려)
  const ipAddress =
    headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    headers.get('x-real-ip') ||
    'unknown';

  const userAgent = headers.get('user-agent') || undefined;

  return createAuditLog({
    ...input,
    ipAddress,
    userAgent,
  });
}

/**
 * 로그인 성공 기록 (헬퍼)
 */
export function logLoginSuccess(
  request: Request,
  userId: string,
  tenantId?: string
): Promise<void> {
  return createAuditLogFromRequest(request, {
    userId,
    tenantId,
    action: AuditAction.LOGIN_SUCCESS,
    targetType: TargetType.SESSION,
    result: 'success',
  });
}

/**
 * 로그인 실패 기록 (헬퍼)
 */
export function logLoginFailure(
  request: Request,
  email: string,
  reason?: string
): Promise<void> {
  // 실패 시에도 기록 (userId는 이메일로 대체)
  return createAuditLogFromRequest(request, {
    userId: email, // 존재하지 않는 사용자일 수 있음
    action: AuditAction.LOGIN_FAILURE,
    targetType: TargetType.SESSION,
    result: 'failure',
    details: reason ? { reason } : undefined,
  });
}

/**
 * 개인정보 접근 기록 (헬퍼)
 * 개인정보 접근 기록은 2년 보관 필요
 */
export function logPersonalDataAccess(
  request: Request,
  userId: string,
  tenantId: string,
  action: AuditActionType,
  targetUserId: string
): Promise<void> {
  return createAuditLogFromRequest(request, {
    userId,
    tenantId,
    action,
    targetType: TargetType.USER,
    targetId: targetUserId,
    result: 'success',
    details: {
      isPersonalDataAccess: true, // 2년 보관 플래그
    },
  });
}

/**
 * 로그 무결성 검증
 */
export async function verifyLogIntegrity(
  tenantId?: string,
  limit = 100
): Promise<{
  valid: boolean;
  checkedCount: number;
  invalidLogs: string[];
}> {
  const logs = await db.query.accessLogs.findMany({
    where: tenantId
      ? (accessLogs, { eq }) => eq(accessLogs.tenantId, tenantId)
      : undefined,
    orderBy: (logs, { asc }) => [asc(logs.createdAt)],
    limit,
  });

  const invalidLogs: string[] = [];
  let previousHash: string | null = null;

  for (const log of logs) {
    const expectedHash = generateIntegrityHash(
      {
        userId: log.userId,
        tenantId: log.tenantId ?? undefined,
        action: log.action as AuditActionType,
        targetType: log.targetType as TargetTypeValue | undefined,
        targetId: log.targetId ?? undefined,
        ipAddress: log.ipAddress ?? undefined,
        userAgent: log.userAgent ?? undefined,
        result: log.result as AuditResult,
        timestamp: log.createdAt?.toISOString() || '',
      },
      previousHash || undefined
    );

    if (log.integrityHash !== expectedHash) {
      invalidLogs.push(log.id);
    }

    previousHash = log.integrityHash;
  }

  return {
    valid: invalidLogs.length === 0,
    checkedCount: logs.length,
    invalidLogs,
  };
}
