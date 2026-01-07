/**
 * 빌링 환경변수 설정 및 검증
 * [Billing System] PortOne V2 연동을 위한 환경변수 관리
 */

/**
 * 개발자 테스트 모드 여부 확인
 * PORTONE_STORE_ID가 'test'일 때 활성화
 * - 포트원 SDK/API 호출 없이 가상 결제 처리
 * - 실제 결제가 발생하지 않음
 */
export function isDevTestMode(): boolean {
  return process.env.PORTONE_STORE_ID === 'test';
}

interface BillingEnvConfig {
  name: string;
  required: boolean;
  minLength?: number;
  description: string;
}

const billingEnvVars: BillingEnvConfig[] = [
  {
    name: 'PORTONE_STORE_ID',
    required: true,
    description: 'PortOne 스토어 ID (store-xxxxx)',
  },
  {
    name: 'PORTONE_CHANNEL_KEY',
    required: true,
    description: 'PortOne 채널 키 (토스페이먼츠 채널)',
  },
  {
    name: 'PORTONE_API_SECRET',
    required: true,
    minLength: 32,
    description: 'PortOne V2 API Secret',
  },
  {
    name: 'PORTONE_WEBHOOK_SECRET',
    required: true,
    minLength: 16,
    description: 'PortOne 웹훅 시크릿',
  },
  {
    name: 'BILLING_ENCRYPTION_KEY',
    required: true,
    minLength: 64, // 32바이트 = 64 hex chars
    description: '빌링키 암호화 키 (AES-256, 64 hex chars)',
  },
  {
    name: 'CRON_SECRET',
    required: true,
    minLength: 16,
    description: 'Cron 작업 인증 시크릿',
  },
];

export interface BillingEnvCheckResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * 빌링 환경변수 검증
 */
export function validateBillingEnv(): BillingEnvCheckResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  for (const config of billingEnvVars) {
    const value = process.env[config.name];

    if (config.required && !value) {
      errors.push(`[필수] ${config.name}: ${config.description}`);
    } else if (value && config.minLength && value.length < config.minLength) {
      errors.push(
        `${config.name}: 최소 ${config.minLength}자 이상 필요 (현재 ${value.length}자)`
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * 빌링 환경변수 객체
 * - 런타임에 접근 시 환경변수 값 반환
 * - 프로덕션에서 필수 값 누락 시 에러 throw
 */
export const billingEnv = {
  // PortOne V2 설정
  portone: {
    get storeId(): string {
      const value = process.env.PORTONE_STORE_ID;
      if (!value && process.env.NODE_ENV === 'production') {
        throw new Error('PORTONE_STORE_ID is required');
      }
      return value || '';
    },
    get channelKey(): string {
      const value = process.env.PORTONE_CHANNEL_KEY;
      if (!value && process.env.NODE_ENV === 'production') {
        throw new Error('PORTONE_CHANNEL_KEY is required');
      }
      return value || '';
    },
    get apiSecret(): string {
      const value = process.env.PORTONE_API_SECRET;
      if (!value && process.env.NODE_ENV === 'production') {
        throw new Error('PORTONE_API_SECRET is required');
      }
      return value || '';
    },
    get webhookSecret(): string {
      const value = process.env.PORTONE_WEBHOOK_SECRET;
      if (!value && process.env.NODE_ENV === 'production') {
        throw new Error('PORTONE_WEBHOOK_SECRET is required');
      }
      return value || '';
    },
  },

  // 암호화 설정
  encryption: {
    get billingKeySecret(): string {
      const value = process.env.BILLING_ENCRYPTION_KEY;
      if (!value && process.env.NODE_ENV === 'production') {
        throw new Error('BILLING_ENCRYPTION_KEY is required');
      }
      return value || '';
    },
  },

  // Cron 설정
  cron: {
    get secret(): string {
      const value = process.env.CRON_SECRET;
      if (!value && process.env.NODE_ENV === 'production') {
        throw new Error('CRON_SECRET is required');
      }
      return value || '';
    },
  },

  // 결제 정책 설정 (하드코딩 - 필요 시 환경변수로 변경)
  billing: {
    retryAttempts: 3,
    retryDelayDays: [1, 3, 7] as const, // 재시도 간격 (일)
    gracePeriodDays: 7, // 유예 기간
  },
} as const;

/**
 * 빌링 환경변수 검증 및 로깅 (앱 시작 시 호출)
 */
let billingEnvChecked = false;

export function ensureBillingEnv(): void {
  if (billingEnvChecked) return;
  billingEnvChecked = true;

  // 개발 환경에서는 검증만 하고 에러 throw하지 않음
  if (process.env.NODE_ENV === 'development') {
    const result = validateBillingEnv();
    if (result.errors.length > 0) {
      console.warn('[BILLING] 개발 환경 - 빌링 환경변수 미설정:');
      result.errors.forEach((err) => console.warn(`  - ${err}`));
    }
    return;
  }

  const result = validateBillingEnv();

  if (!result.valid) {
    console.error('========================================');
    console.error('[BILLING] 필수 환경변수 누락:');
    result.errors.forEach((err) => console.error(`  - ${err}`));
    console.error('========================================');
    throw new Error('빌링 환경변수 설정이 불완전합니다.');
  }
}
