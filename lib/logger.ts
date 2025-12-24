/**
 * 안전한 로거
 * [C-005] 민감정보 콘솔 로깅 방지
 *
 * 프로덕션에서는 console.log 대신 이 로거를 사용
 * 민감정보 자동 마스킹 및 구조화된 로깅 제공
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  [key: string]: unknown;
}

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: LogContext;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

// 민감한 필드 패턴
const SENSITIVE_PATTERNS = [
  /password/i,
  /secret/i,
  /token/i,
  /api[_-]?key/i,
  /authorization/i,
  /cookie/i,
  /session/i,
  /credential/i,
  /private/i,
  /bearer/i,
  /auth/i,
  /hash/i,
  /salt/i,
  /ssn/i, // 주민등록번호
  /phone/i, // 전화번호
  /email/i, // 이메일 (로그에는 마스킹)
  /card/i, // 카드번호
  /account/i, // 계좌번호
];

// 민감한 값 패턴 (값 자체를 검사)
const SENSITIVE_VALUE_PATTERNS = [
  /^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*$/, // JWT
  /^[A-Za-z0-9+/]{40,}={0,2}$/, // Base64 encoded secrets
  /^\d{6}-?\d{7}$/, // 주민등록번호
  /^\d{3}-?\d{4}-?\d{4}$/, // 전화번호
  /^\d{4}-?\d{4}-?\d{4}-?\d{4}$/, // 카드번호
];

/**
 * 값이 민감한 데이터인지 확인
 */
function isSensitiveValue(value: unknown): boolean {
  if (typeof value !== 'string') return false;

  return SENSITIVE_VALUE_PATTERNS.some((pattern) => pattern.test(value));
}

/**
 * 키가 민감한 필드인지 확인
 */
function isSensitiveKey(key: string): boolean {
  return SENSITIVE_PATTERNS.some((pattern) => pattern.test(key));
}

/**
 * 문자열 마스킹
 */
function maskString(value: string): string {
  if (value.length <= 4) return '****';
  return value.slice(0, 2) + '****' + value.slice(-2);
}

/**
 * 객체에서 민감한 정보 마스킹
 */
function sanitizeObject(obj: unknown, depth = 0): unknown {
  // 깊이 제한 (무한 재귀 방지)
  if (depth > 10) return '[MAX_DEPTH]';

  if (obj === null || obj === undefined) return obj;

  if (typeof obj === 'string') {
    return isSensitiveValue(obj) ? maskString(obj) : obj;
  }

  if (typeof obj !== 'object') return obj;

  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeObject(item, depth + 1));
  }

  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (isSensitiveKey(key)) {
      sanitized[key] =
        typeof value === 'string' ? maskString(value) : '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeObject(value, depth + 1);
    } else if (typeof value === 'string' && isSensitiveValue(value)) {
      sanitized[key] = maskString(value);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * 에러 객체를 안전한 형태로 변환
 */
function sanitizeError(
  error: Error
): { name: string; message: string; stack?: string } {
  return {
    name: error.name,
    message: error.message,
    // 스택 트레이스는 개발 환경에서만 포함
    ...(process.env.NODE_ENV !== 'production' && { stack: error.stack }),
  };
}

/**
 * 로그 레벨별 활성화 여부
 */
function isLevelEnabled(level: LogLevel): boolean {
  const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
  const configuredLevel = (process.env.LOG_LEVEL as LogLevel) || 'info';
  const configuredIndex = levels.indexOf(configuredLevel);
  const currentIndex = levels.indexOf(level);

  return currentIndex >= configuredIndex;
}

/**
 * 로그 엔트리 포맷팅
 */
function formatLogEntry(entry: LogEntry): string {
  if (process.env.NODE_ENV === 'production') {
    // 프로덕션: JSON 형식 (로그 수집 시스템용)
    return JSON.stringify(entry);
  }

  // 개발: 가독성 좋은 형식
  const { timestamp, level, message, context, error } = entry;
  const levelColor = {
    debug: '\x1b[36m', // cyan
    info: '\x1b[32m', // green
    warn: '\x1b[33m', // yellow
    error: '\x1b[31m', // red
  };
  const reset = '\x1b[0m';

  let output = `${levelColor[level]}[${level.toUpperCase()}]${reset} ${timestamp} - ${message}`;

  if (context && Object.keys(context).length > 0) {
    output += `\n  Context: ${JSON.stringify(context, null, 2)}`;
  }

  if (error) {
    output += `\n  Error: ${error.name}: ${error.message}`;
    if (error.stack) {
      output += `\n  Stack: ${error.stack}`;
    }
  }

  return output;
}

/**
 * 실제 로그 출력
 */
function writeLog(entry: LogEntry): void {
  const formatted = formatLogEntry(entry);

  switch (entry.level) {
    case 'error':
      console.error(formatted);
      break;
    case 'warn':
      console.warn(formatted);
      break;
    default:
      // 이 파일은 유일하게 console.log를 사용하는 파일
      // eslint-disable-next-line no-console
      console.log(formatted);
  }
}

/**
 * 메인 로거 클래스
 */
class Logger {
  private createEntry(
    level: LogLevel,
    message: string,
    context?: LogContext,
    error?: Error
  ): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...(context && { context: sanitizeObject(context) as LogContext }),
      ...(error && { error: sanitizeError(error) }),
    };
  }

  debug(message: string, context?: LogContext): void {
    if (!isLevelEnabled('debug')) return;
    writeLog(this.createEntry('debug', message, context));
  }

  info(message: string, context?: LogContext): void {
    if (!isLevelEnabled('info')) return;
    writeLog(this.createEntry('info', message, context));
  }

  warn(message: string, context?: LogContext, error?: Error): void {
    if (!isLevelEnabled('warn')) return;
    writeLog(this.createEntry('warn', message, context, error));
  }

  error(message: string, error?: Error, context?: LogContext): void {
    if (!isLevelEnabled('error')) return;
    writeLog(this.createEntry('error', message, context, error));
  }

  /**
   * 요청 로깅 (API Route용)
   */
  request(
    method: string,
    path: string,
    statusCode: number,
    durationMs: number,
    context?: LogContext
  ): void {
    const level: LogLevel = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';
    if (!isLevelEnabled(level)) return;

    writeLog(
      this.createEntry(level, `${method} ${path} ${statusCode} ${durationMs}ms`, {
        method,
        path,
        statusCode,
        durationMs,
        ...context,
      })
    );
  }
}

// 싱글톤 인스턴스
export const logger = new Logger();

// 유틸리티 함수 export
export { sanitizeObject, isSensitiveKey, isSensitiveValue };
