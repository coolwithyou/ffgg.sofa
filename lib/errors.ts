/**
 * 에러 처리 표준화
 * [C-005] 민감정보 노출 방지
 */

// 에러 코드 정의
export const ErrorCode = {
  // 인증 관련 (1xxx)
  UNAUTHORIZED: 'AUTH_1001',
  INVALID_CREDENTIALS: 'AUTH_1002',
  SESSION_EXPIRED: 'AUTH_1003',
  ACCOUNT_LOCKED: 'AUTH_1004',
  EMAIL_NOT_VERIFIED: 'AUTH_1005',
  INVALID_TOKEN: 'AUTH_1006',
  EMAIL_ALREADY_EXISTS: 'AUTH_1007',

  // 권한 관련 (2xxx)
  FORBIDDEN: 'PERM_2001',
  TENANT_MISMATCH: 'PERM_2002',
  INSUFFICIENT_PERMISSIONS: 'PERM_2003',

  // 입력 검증 관련 (3xxx)
  VALIDATION_ERROR: 'VAL_3001',
  INVALID_INPUT: 'VAL_3002',
  MISSING_REQUIRED_FIELD: 'VAL_3003',

  // 리소스 관련 (4xxx)
  NOT_FOUND: 'RES_4001',
  ALREADY_EXISTS: 'RES_4002',
  CONFLICT: 'RES_4003',

  // 파일 관련 (5xxx)
  FILE_TOO_LARGE: 'FILE_5001',
  INVALID_FILE_TYPE: 'FILE_5002',
  FILE_UPLOAD_FAILED: 'FILE_5003',
  FILE_PROCESSING_FAILED: 'FILE_5004',

  // 외부 서비스 관련 (6xxx)
  OPENAI_ERROR: 'EXT_6001',
  STORAGE_ERROR: 'EXT_6002',
  DATABASE_ERROR: 'EXT_6003',

  // Rate Limiting (7xxx)
  RATE_LIMIT_EXCEEDED: 'RATE_7001',
  QUOTA_EXCEEDED: 'RATE_7002',

  // 서버 에러 (9xxx)
  INTERNAL_ERROR: 'SRV_9001',
  SERVICE_UNAVAILABLE: 'SRV_9002',
} as const;

export type ErrorCodeType = (typeof ErrorCode)[keyof typeof ErrorCode];

// HTTP 상태 코드 매핑
const httpStatusMap: Record<ErrorCodeType, number> = {
  [ErrorCode.UNAUTHORIZED]: 401,
  [ErrorCode.INVALID_CREDENTIALS]: 401,
  [ErrorCode.SESSION_EXPIRED]: 401,
  [ErrorCode.ACCOUNT_LOCKED]: 423,
  [ErrorCode.EMAIL_NOT_VERIFIED]: 403,
  [ErrorCode.INVALID_TOKEN]: 401,
  [ErrorCode.EMAIL_ALREADY_EXISTS]: 409,
  [ErrorCode.FORBIDDEN]: 403,
  [ErrorCode.TENANT_MISMATCH]: 403,
  [ErrorCode.INSUFFICIENT_PERMISSIONS]: 403,
  [ErrorCode.VALIDATION_ERROR]: 400,
  [ErrorCode.INVALID_INPUT]: 400,
  [ErrorCode.MISSING_REQUIRED_FIELD]: 400,
  [ErrorCode.NOT_FOUND]: 404,
  [ErrorCode.ALREADY_EXISTS]: 409,
  [ErrorCode.CONFLICT]: 409,
  [ErrorCode.FILE_TOO_LARGE]: 413,
  [ErrorCode.INVALID_FILE_TYPE]: 415,
  [ErrorCode.FILE_UPLOAD_FAILED]: 500,
  [ErrorCode.FILE_PROCESSING_FAILED]: 500,
  [ErrorCode.OPENAI_ERROR]: 502,
  [ErrorCode.STORAGE_ERROR]: 502,
  [ErrorCode.DATABASE_ERROR]: 500,
  [ErrorCode.RATE_LIMIT_EXCEEDED]: 429,
  [ErrorCode.QUOTA_EXCEEDED]: 429,
  [ErrorCode.INTERNAL_ERROR]: 500,
  [ErrorCode.SERVICE_UNAVAILABLE]: 503,
};

// 사용자에게 보여줄 안전한 메시지 (민감정보 제외)
const safeMessages: Record<ErrorCodeType, string> = {
  [ErrorCode.UNAUTHORIZED]: '인증이 필요합니다.',
  [ErrorCode.INVALID_CREDENTIALS]: '이메일 또는 비밀번호가 올바르지 않습니다.',
  [ErrorCode.SESSION_EXPIRED]: '세션이 만료되었습니다. 다시 로그인해주세요.',
  [ErrorCode.ACCOUNT_LOCKED]: '계정이 잠겼습니다. 잠시 후 다시 시도해주세요.',
  [ErrorCode.EMAIL_NOT_VERIFIED]: '이메일 인증이 필요합니다.',
  [ErrorCode.INVALID_TOKEN]: '유효하지 않은 토큰입니다.',
  [ErrorCode.EMAIL_ALREADY_EXISTS]: '이미 등록된 이메일 주소입니다.',
  [ErrorCode.FORBIDDEN]: '접근 권한이 없습니다.',
  [ErrorCode.TENANT_MISMATCH]: '접근 권한이 없습니다.',
  [ErrorCode.INSUFFICIENT_PERMISSIONS]: '권한이 부족합니다.',
  [ErrorCode.VALIDATION_ERROR]: '입력값을 확인해주세요.',
  [ErrorCode.INVALID_INPUT]: '잘못된 입력입니다.',
  [ErrorCode.MISSING_REQUIRED_FIELD]: '필수 항목이 누락되었습니다.',
  [ErrorCode.NOT_FOUND]: '요청한 리소스를 찾을 수 없습니다.',
  [ErrorCode.ALREADY_EXISTS]: '이미 존재하는 항목입니다.',
  [ErrorCode.CONFLICT]: '충돌이 발생했습니다.',
  [ErrorCode.FILE_TOO_LARGE]: '파일 크기가 너무 큽니다.',
  [ErrorCode.INVALID_FILE_TYPE]: '지원하지 않는 파일 형식입니다.',
  [ErrorCode.FILE_UPLOAD_FAILED]: '파일 업로드에 실패했습니다.',
  [ErrorCode.FILE_PROCESSING_FAILED]: '파일 처리에 실패했습니다.',
  [ErrorCode.OPENAI_ERROR]: '외부 서비스 오류가 발생했습니다.',
  [ErrorCode.STORAGE_ERROR]: '저장소 오류가 발생했습니다.',
  [ErrorCode.DATABASE_ERROR]: '데이터베이스 오류가 발생했습니다.',
  [ErrorCode.RATE_LIMIT_EXCEEDED]: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.',
  [ErrorCode.QUOTA_EXCEEDED]: '사용량 한도를 초과했습니다.',
  [ErrorCode.INTERNAL_ERROR]: '서버 오류가 발생했습니다.',
  [ErrorCode.SERVICE_UNAVAILABLE]: '서비스를 일시적으로 사용할 수 없습니다.',
};

/**
 * 애플리케이션 커스텀 에러 클래스
 */
export class AppError extends Error {
  public readonly code: ErrorCodeType;
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly details?: Record<string, unknown>;

  constructor(
    code: ErrorCodeType,
    message?: string,
    details?: Record<string, unknown>
  ) {
    super(message || safeMessages[code]);
    this.code = code;
    this.statusCode = httpStatusMap[code];
    this.isOperational = true;
    this.details = details;

    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * 클라이언트에 반환할 안전한 응답 생성
   * 민감한 내부 정보는 제외
   */
  toSafeResponse(): {
    error: {
      code: string;
      message: string;
      details?: Record<string, unknown>;
    };
  } {
    return {
      error: {
        code: this.code,
        message: safeMessages[this.code],
        // details는 validation 에러 등에서만 포함 (민감정보 제외 확인 필요)
        ...(this.details && { details: this.sanitizeDetails(this.details) }),
      },
    };
  }

  /**
   * details에서 민감한 정보 제거
   */
  private sanitizeDetails(
    details: Record<string, unknown>
  ): Record<string, unknown> {
    const sensitiveKeys = [
      'password',
      'passwordHash',
      'token',
      'secret',
      'apiKey',
      'authorization',
      'cookie',
      'session',
    ];

    const sanitized: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(details)) {
      if (sensitiveKeys.some((sk) => key.toLowerCase().includes(sk))) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = this.sanitizeDetails(value as Record<string, unknown>);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }
}

/**
 * 알 수 없는 에러를 AppError로 변환
 */
export function normalizeError(error: unknown): AppError {
  if (error instanceof AppError) {
    return error;
  }

  if (error instanceof Error) {
    // 프로덕션에서는 원본 메시지를 숨기고 일반적인 메시지만 반환
    const isProduction = process.env.NODE_ENV === 'production';
    return new AppError(
      ErrorCode.INTERNAL_ERROR,
      isProduction ? undefined : error.message
    );
  }

  return new AppError(ErrorCode.INTERNAL_ERROR);
}

/**
 * API Route에서 사용할 에러 응답 헬퍼
 */
export function errorResponse(error: unknown): Response {
  const appError = normalizeError(error);

  return Response.json(appError.toSafeResponse(), {
    status: appError.statusCode,
  });
}

/**
 * 자주 사용하는 에러 생성 헬퍼
 */
export const Errors = {
  unauthorized: (message?: string) =>
    new AppError(ErrorCode.UNAUTHORIZED, message),
  invalidCredentials: () => new AppError(ErrorCode.INVALID_CREDENTIALS),
  sessionExpired: () => new AppError(ErrorCode.SESSION_EXPIRED),
  accountLocked: (minutes?: number) =>
    new AppError(
      ErrorCode.ACCOUNT_LOCKED,
      minutes ? `계정이 ${minutes}분간 잠겼습니다.` : undefined
    ),
  forbidden: () => new AppError(ErrorCode.FORBIDDEN),
  tenantMismatch: () => new AppError(ErrorCode.TENANT_MISMATCH),
  notFound: (resource?: string) =>
    new AppError(
      ErrorCode.NOT_FOUND,
      resource ? `${resource}을(를) 찾을 수 없습니다.` : undefined
    ),
  validationError: (details?: Record<string, unknown>) =>
    new AppError(ErrorCode.VALIDATION_ERROR, undefined, details),
  rateLimitExceeded: () => new AppError(ErrorCode.RATE_LIMIT_EXCEEDED),
  internalError: () => new AppError(ErrorCode.INTERNAL_ERROR),
};

/**
 * Validation 에러 클래스
 */
export class ValidationError extends AppError {
  public readonly validationErrors: Array<{ path: string; message: string }>;

  constructor(
    message: string,
    errors: Array<{ path?: (string | number)[]; message: string }> = []
  ) {
    super(ErrorCode.VALIDATION_ERROR, message, {
      errors: errors.map((e) => ({
        path: e.path?.join('.') || '',
        message: e.message,
      })),
    });
    this.validationErrors = errors.map((e) => ({
      path: e.path?.join('.') || '',
      message: e.message,
    }));
  }
}

/**
 * API Route에서 사용할 에러 핸들러
 */
export function handleApiError(error: unknown): Response {
  const appError = normalizeError(error);

  return Response.json(appError.toSafeResponse(), {
    status: appError.statusCode,
  });
}
