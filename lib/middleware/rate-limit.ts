/**
 * Rate Limiting 미들웨어
 * [W-003] Upstash Redis 기반 Rate Limiting
 */

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { NextRequest, NextResponse } from 'next/server';
import { ErrorCode, AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';

// Redis 클라이언트 (환경변수 필요)
let redis: Redis | null = null;
let redisCheckDone = false;

/**
 * Redis가 제대로 설정되어 있는지 확인
 */
function isRedisConfigured(): boolean {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  // 플레이스홀더 값 체크
  const isPlaceholder = (value: string | undefined) =>
    !value ||
    value.startsWith('your-') ||
    value.startsWith('https://your-') ||
    value === 'your-upstash-token';

  return !isPlaceholder(url) && !isPlaceholder(token);
}

function getRedis(): Redis | null {
  if (!isRedisConfigured()) {
    if (!redisCheckDone) {
      logger.info('[DEV] Rate limiting disabled (Upstash Redis not configured)');
      redisCheckDone = true;
    }
    return null;
  }

  if (!redis) {
    redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    });
  }

  return redis;
}

// 티어별 Rate Limit 설정
export const RATE_LIMITS = {
  // API 요청 제한 (분당)
  api: {
    basic: { requests: 60, window: '1m' },
    standard: { requests: 300, window: '1m' },
    premium: { requests: 1000, window: '1m' },
  },
  // 인증 요청 제한 (더 엄격)
  auth: {
    login: { requests: 5, window: '15m' },
    register: { requests: 3, window: '1h' },
    passwordReset: { requests: 3, window: '1h' },
  },
  // 파일 업로드 제한
  upload: {
    basic: { requests: 10, window: '1h' },
    standard: { requests: 50, window: '1h' },
    premium: { requests: 200, window: '1h' },
  },
  // 챗봇 요청 제한
  chat: {
    basic: { requests: 100, window: '1d' },
    standard: { requests: 1000, window: '1d' },
    premium: { requests: 10000, window: '1d' },
  },
  // 공개 페이지 요청 제한 (IP 기반)
  publicPage: {
    chat: { requests: 30, window: '1h' }, // 시간당 30개 메시지
    chatDaily: { requests: 200, window: '1d' }, // 일일 200개 메시지
  },
} as const;

type WindowString = '1m' | '15m' | '1h' | '1d';

function parseWindow(window: WindowString): Parameters<typeof Ratelimit.slidingWindow>[1] {
  const mapping: Record<WindowString, Parameters<typeof Ratelimit.slidingWindow>[1]> = {
    '1m': '1 m',
    '15m': '15 m',
    '1h': '1 h',
    '1d': '1 d',
  };
  return mapping[window];
}

// Rate Limiter 인스턴스 캐시
const limiters = new Map<string, Ratelimit>();

function getRateLimiter(
  prefix: string,
  requests: number,
  window: WindowString
): Ratelimit | null {
  const redisClient = getRedis();
  if (!redisClient) {
    // Redis가 없으면 rate limiting 비활성화 (개발 환경)
    return null;
  }

  const key = `${prefix}:${requests}:${window}`;

  if (!limiters.has(key)) {
    limiters.set(
      key,
      new Ratelimit({
        redis: redisClient,
        limiter: Ratelimit.slidingWindow(requests, parseWindow(window)),
        prefix: `ratelimit:${prefix}`,
        analytics: true,
      })
    );
  }

  return limiters.get(key)!;
}

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}

/**
 * Rate Limit 체크
 */
export async function checkRateLimit(
  identifier: string,
  type: 'api' | 'auth' | 'upload' | 'chat',
  tier: 'basic' | 'standard' | 'premium' | 'login' | 'register' | 'passwordReset' = 'basic'
): Promise<RateLimitResult> {
  const config = (RATE_LIMITS[type] as Record<string, { requests: number; window: WindowString }>)[tier];

  if (!config) {
    logger.warn('Unknown rate limit config', { type, tier });
    return { success: true, limit: 0, remaining: 0, reset: 0 };
  }

  const limiter = getRateLimiter(`${type}:${tier}`, config.requests, config.window);

  if (!limiter) {
    // Redis 없으면 항상 허용 (개발 환경)
    return { success: true, limit: config.requests, remaining: config.requests, reset: 0 };
  }

  try {
    const result = await limiter.limit(identifier);

    return {
      success: result.success,
      limit: result.limit,
      remaining: result.remaining,
      reset: result.reset,
    };
  } catch (error) {
    logger.error('Rate limit check failed', error as Error, { identifier, type, tier });
    // 에러 시 허용 (fail-open)
    return { success: true, limit: config.requests, remaining: config.requests, reset: 0 };
  }
}

/**
 * Rate Limit 미들웨어 헬퍼
 */
export async function withRateLimit(
  request: NextRequest,
  type: 'api' | 'auth' | 'upload' | 'chat',
  tier: 'basic' | 'standard' | 'premium' = 'basic',
  identifier?: string
): Promise<NextResponse | null> {
  // 식별자: IP 또는 사용자 ID
  const id =
    identifier ||
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown';

  const result = await checkRateLimit(id, type, tier);

  if (!result.success) {
    logger.warn('Rate limit exceeded', {
      identifier: id,
      type,
      tier,
      limit: result.limit,
      reset: result.reset,
    });

    return NextResponse.json(
      new AppError(ErrorCode.RATE_LIMIT_EXCEEDED).toSafeResponse(),
      {
        status: 429,
        headers: {
          'X-RateLimit-Limit': result.limit.toString(),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': result.reset.toString(),
          'Retry-After': Math.ceil((result.reset - Date.now()) / 1000).toString(),
        },
      }
    );
  }

  return null; // 허용됨
}

/**
 * API Route에서 사용하는 Rate Limit 데코레이터
 */
export function rateLimitHeaders(result: RateLimitResult): HeadersInit {
  return {
    'X-RateLimit-Limit': result.limit.toString(),
    'X-RateLimit-Remaining': result.remaining.toString(),
    'X-RateLimit-Reset': result.reset.toString(),
  };
}

/**
 * Rate Limit 설정 타입
 */
export interface RateLimitConfig {
  requests: number;
  window: WindowString;
}

/**
 * 사전 정의된 Rate Limit 설정
 */
export const RATE_LIMIT_CONFIGS = {
  chat: { requests: 100, window: '1d' as const },
  chatPremium: { requests: 10000, window: '1d' as const },
  api: { requests: 60, window: '1m' as const },
  apiPremium: { requests: 1000, window: '1m' as const },
  upload: { requests: 10, window: '1h' as const },
  login: { requests: 5, window: '15m' as const },
  // 공개 페이지 전용
  publicPageChat: { requests: 30, window: '1h' as const },
  publicPageChatDaily: { requests: 200, window: '1d' as const },
} as const;

/**
 * 간소화된 Rate Limit 체크 (config 기반)
 */
export async function checkRateLimitWithConfig(
  identifier: string,
  config: RateLimitConfig
): Promise<{
  allowed: boolean;
  remaining: number;
  retryAfter?: number;
}> {
  const limiter = getRateLimiter('custom', config.requests, config.window);

  if (!limiter) {
    // Redis 없으면 항상 허용 (개발 환경)
    return { allowed: true, remaining: config.requests };
  }

  try {
    const result = await limiter.limit(identifier);

    if (!result.success) {
      const retryAfter = Math.ceil((result.reset - Date.now()) / 1000);
      return {
        allowed: false,
        remaining: 0,
        retryAfter,
      };
    }

    return {
      allowed: true,
      remaining: result.remaining,
    };
  } catch (error) {
    logger.error('Rate limit check failed', error as Error, { identifier });
    return { allowed: true, remaining: config.requests };
  }
}

/**
 * 공개 페이지 전용 Rate Limit 체크
 * 시간당 + 일일 제한을 동시에 체크합니다.
 *
 * @param ip - 클라이언트 IP 주소
 * @returns 허용 여부 및 남은 요청 수
 */
export async function checkPublicPageRateLimit(ip: string): Promise<{
  allowed: boolean;
  remaining: number;
  retryAfter?: number;
  reason?: 'hourly' | 'daily';
}> {
  // 시간당 제한 체크
  const hourlyLimiter = getRateLimiter(
    'publicPage:chat',
    RATE_LIMIT_CONFIGS.publicPageChat.requests,
    RATE_LIMIT_CONFIGS.publicPageChat.window
  );

  // 일일 제한 체크
  const dailyLimiter = getRateLimiter(
    'publicPage:chatDaily',
    RATE_LIMIT_CONFIGS.publicPageChatDaily.requests,
    RATE_LIMIT_CONFIGS.publicPageChatDaily.window
  );

  // Redis 없으면 항상 허용 (개발 환경)
  if (!hourlyLimiter || !dailyLimiter) {
    return { allowed: true, remaining: RATE_LIMIT_CONFIGS.publicPageChat.requests };
  }

  try {
    // 두 제한을 병렬로 체크
    const [hourlyResult, dailyResult] = await Promise.all([
      hourlyLimiter.limit(ip),
      dailyLimiter.limit(ip),
    ]);

    // 시간당 제한 초과
    if (!hourlyResult.success) {
      const retryAfter = Math.ceil((hourlyResult.reset - Date.now()) / 1000);
      logger.warn('Public page hourly rate limit exceeded', { ip, reset: hourlyResult.reset });
      return {
        allowed: false,
        remaining: 0,
        retryAfter,
        reason: 'hourly',
      };
    }

    // 일일 제한 초과
    if (!dailyResult.success) {
      const retryAfter = Math.ceil((dailyResult.reset - Date.now()) / 1000);
      logger.warn('Public page daily rate limit exceeded', { ip, reset: dailyResult.reset });
      return {
        allowed: false,
        remaining: 0,
        retryAfter,
        reason: 'daily',
      };
    }

    return {
      allowed: true,
      remaining: Math.min(hourlyResult.remaining, dailyResult.remaining),
    };
  } catch (error) {
    logger.error('Public page rate limit check failed', error as Error, { ip });
    // 에러 시 허용 (fail-open)
    return { allowed: true, remaining: RATE_LIMIT_CONFIGS.publicPageChat.requests };
  }
}

