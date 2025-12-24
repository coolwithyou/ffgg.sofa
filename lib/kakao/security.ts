/**
 * 카카오 오픈빌더 보안 유틸리티
 * [Week 8] IP 화이트리스트 및 Rate Limiting
 */

import { NextRequest } from 'next/server';
import { checkRateLimit } from '@/lib/middleware/rate-limit';
import { logger } from '@/lib/logger';

/**
 * 카카오 오픈빌더 서버 IP 대역
 * https://i.kakao.com/docs/skill-response-format
 *
 * 주의: 카카오 문서에서 IP 대역이 변경될 수 있으므로 주기적 확인 필요
 */
const KAKAO_IP_RANGES = [
  // 카카오 오픈빌더 서버 IP 대역
  '203.133.167.',   // 203.133.167.0/24
  '27.0.236.',      // 27.0.236.0/24
  '27.0.237.',      // 27.0.237.0/24
  '27.0.238.',      // 27.0.238.0/24
  '27.0.239.',      // 27.0.239.0/24
  '211.231.99.',    // 211.231.99.0/24
  '211.231.100.',   // 211.231.100.0/24
  '211.231.101.',   // 211.231.101.0/24
  '211.231.102.',   // 211.231.102.0/24
  '211.231.103.',   // 211.231.103.0/24
];

// 개발 환경에서 허용할 IP (localhost)
const DEV_ALLOWED_IPS = ['127.0.0.1', '::1', 'localhost'];

/**
 * 요청에서 클라이언트 IP 추출
 */
export function getClientIp(request: NextRequest): string {
  // x-forwarded-for 헤더 (프록시/로드밸런서 뒤에 있는 경우)
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    // 첫 번째 IP가 원본 클라이언트 IP
    return forwardedFor.split(',')[0].trim();
  }

  // x-real-ip 헤더 (Nginx 등)
  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp.trim();
  }

  // 직접 연결 (Next.js에서 사용 불가, fallback)
  return 'unknown';
}

/**
 * 카카오 서버 IP 검증
 */
export function isKakaoServerIp(ip: string): boolean {
  // 개발 환경에서는 localhost 허용
  if (process.env.NODE_ENV === 'development') {
    if (DEV_ALLOWED_IPS.includes(ip)) {
      return true;
    }
  }

  // 카카오 IP 대역 확인
  return KAKAO_IP_RANGES.some((range) => ip.startsWith(range));
}

/**
 * IP 화이트리스트 검증 (환경변수로 비활성화 가능)
 */
export function validateKakaoIp(request: NextRequest): {
  valid: boolean;
  ip: string;
  reason?: string;
} {
  // 환경변수로 IP 검증 비활성화 가능 (테스트용)
  if (process.env.KAKAO_SKIP_IP_VALIDATION === 'true') {
    logger.warn('Kakao IP validation is disabled');
    return { valid: true, ip: 'skipped' };
  }

  const ip = getClientIp(request);

  if (ip === 'unknown') {
    return {
      valid: false,
      ip,
      reason: 'Unable to determine client IP',
    };
  }

  if (!isKakaoServerIp(ip)) {
    logger.warn('Kakao skill request from non-whitelisted IP', { ip });
    return {
      valid: false,
      ip,
      reason: `IP ${ip} is not in Kakao whitelist`,
    };
  }

  return { valid: true, ip };
}

/**
 * 카카오 스킬 Rate Limiting
 *
 * 카카오 오픈빌더는 동일 사용자의 연속 요청을 제한하지 않으므로
 * 봇 ID + 사용자 ID 조합으로 Rate Limiting 적용
 */
export async function checkKakaoRateLimit(
  botId: string,
  userId: string
): Promise<{
  allowed: boolean;
  remaining: number;
  retryAfter?: number;
}> {
  // 식별자: botId:userId
  const identifier = `kakao:${botId}:${userId}`;

  // chat 타입, basic 티어 사용 (일 100회)
  const result = await checkRateLimit(identifier, 'chat', 'basic');

  if (!result.success) {
    const retryAfter = Math.ceil((result.reset - Date.now()) / 1000);
    logger.warn('Kakao rate limit exceeded', {
      botId,
      userId: userId.slice(0, 8) + '...',
      limit: result.limit,
      retryAfter,
    });

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
}

/**
 * 카카오 스킬 요청 전체 보안 검증
 */
export async function validateKakaoRequest(
  request: NextRequest,
  botId?: string,
  userId?: string
): Promise<{
  valid: boolean;
  errorType?: 'ip_blocked' | 'rate_limited';
  message?: string;
  retryAfter?: number;
}> {
  // 1. IP 화이트리스트 검증
  const ipResult = validateKakaoIp(request);
  if (!ipResult.valid) {
    return {
      valid: false,
      errorType: 'ip_blocked',
      message: ipResult.reason,
    };
  }

  // 2. Rate Limiting (botId, userId가 있는 경우)
  if (botId && userId) {
    const rateResult = await checkKakaoRateLimit(botId, userId);
    if (!rateResult.allowed) {
      return {
        valid: false,
        errorType: 'rate_limited',
        message: 'Rate limit exceeded',
        retryAfter: rateResult.retryAfter,
      };
    }
  }

  return { valid: true };
}
