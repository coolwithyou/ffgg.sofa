/**
 * 환경변수 검증
 * [Week 11] 보안 강화 - 프로덕션 필수 환경변수 체크
 */

interface EnvConfig {
  name: string;
  required: boolean;
  minLength?: number;
  description: string;
}

const requiredEnvVars: EnvConfig[] = [
  {
    name: 'SESSION_SECRET',
    required: true,
    minLength: 32,
    description: '세션 암호화 키 (32자 이상)',
  },
  {
    name: 'DATABASE_URL',
    required: true,
    description: 'PostgreSQL 연결 문자열',
  },
  {
    name: 'UPSTASH_REDIS_REST_URL',
    required: false, // Rate limiting용, 선택적
    description: 'Upstash Redis REST URL',
  },
  {
    name: 'UPSTASH_REDIS_REST_TOKEN',
    required: false,
    description: 'Upstash Redis REST 토큰',
  },
  {
    name: 'OPENAI_API_KEY',
    required: true,
    description: 'OpenAI API 키',
  },
  {
    name: 'S3_ENDPOINT',
    required: false,
    description: 'S3 호환 스토리지 엔드포인트',
  },
  {
    name: 'S3_ACCESS_KEY_ID',
    required: false,
    description: 'S3 액세스 키',
  },
  {
    name: 'S3_SECRET_ACCESS_KEY',
    required: false,
    description: 'S3 시크릿 키',
  },
];

export interface EnvCheckResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * 환경변수 검증 실행
 */
export function checkEnvironmentVariables(): EnvCheckResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  for (const config of requiredEnvVars) {
    const value = process.env[config.name];

    if (config.required && !value) {
      errors.push(`[필수] ${config.name}: ${config.description}`);
    } else if (!config.required && !value) {
      warnings.push(`[선택] ${config.name}: ${config.description} - 미설정`);
    } else if (value && config.minLength && value.length < config.minLength) {
      errors.push(`${config.name}: 최소 ${config.minLength}자 이상 필요 (현재 ${value.length}자)`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * 앱 시작 시 환경변수 검증 및 로깅
 * (API 라우트 또는 미들웨어에서 호출)
 */
let checked = false;

export function ensureEnvironmentVariables(): void {
  // 한 번만 체크
  if (checked) return;
  checked = true;

  // 개발 환경에서는 경고만
  if (process.env.NODE_ENV === 'development') {
    return;
  }

  const result = checkEnvironmentVariables();

  if (result.errors.length > 0) {
    console.error('========================================');
    console.error('[SECURITY] 필수 환경변수 누락:');
    result.errors.forEach((err) => console.error(`  - ${err}`));
    console.error('========================================');
  }

  if (result.warnings.length > 0) {
    console.warn('[CONFIG] 선택적 환경변수 미설정:');
    result.warnings.forEach((warn) => console.warn(`  - ${warn}`));
  }
}

/**
 * 특정 환경변수 값 가져오기 (타입 안전)
 */
export function getEnvVar(name: string, fallback?: string): string {
  const value = process.env[name];
  if (value) return value;
  if (fallback !== undefined) return fallback;
  throw new Error(`환경변수 ${name}이(가) 설정되지 않았습니다.`);
}

/**
 * 프로덕션 환경 여부
 */
export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

/**
 * 개발 환경 여부
 */
export function isDevelopment(): boolean {
  return process.env.NODE_ENV === 'development';
}
