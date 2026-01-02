# Phase 4: 보안 및 Rate Limiting

> 예상 기간: 2-3일

## 목표

공개 페이지 전용 보안 강화 및 남용 방지

## 선행 조건

- [Phase 1: DB 스키마 및 기반 인프라](./phase-1-db-schema.md) 완료
- [Phase 2: 라우팅 및 공개 페이지 렌더링](./phase-2-routing.md) 완료
- [Phase 3: 포탈 관리 UI](./phase-3-portal-ui.md) 완료

## 작업 내용

### 4.1 Rate Limit 설정 확장

**파일**: `lib/middleware/rate-limit.ts`

공개 페이지 전용 rate limit 규칙을 추가합니다.

```typescript
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv();

/**
 * Rate Limit 설정
 */
export const rateLimitConfigs = {
  // 기존 설정...
  widget: {
    chat: new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(60, '1 h'),  // 시간당 60개
      analytics: true,
      prefix: 'ratelimit:widget:chat',
    }),
  },

  // 공개 페이지 전용 (신규)
  publicPage: {
    // 시간당 채팅 제한
    chat: new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(30, '1 h'),
      analytics: true,
      prefix: 'ratelimit:public-page:chat',
    }),

    // 일일 채팅 제한
    chatDaily: new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(200, '1 d'),
      analytics: true,
      prefix: 'ratelimit:public-page:chat-daily',
    }),

    // 분당 요청 제한 (버스트 방지)
    burst: new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(10, '1 m'),
      analytics: true,
      prefix: 'ratelimit:public-page:burst',
    }),
  },
};

/**
 * 공개 페이지 Rate Limit 체크
 */
export async function checkPublicPageRateLimit(
  ip: string,
  chatbotId: string
): Promise<{ success: boolean; remaining?: number; reset?: number; error?: string }> {
  const identifier = `${ip}:${chatbotId}`;

  // 버스트 제한 체크
  const burstResult = await rateLimitConfigs.publicPage.burst.limit(identifier);
  if (!burstResult.success) {
    return {
      success: false,
      remaining: burstResult.remaining,
      reset: burstResult.reset,
      error: '요청이 너무 빠릅니다. 잠시 후 다시 시도해주세요.',
    };
  }

  // 시간당 제한 체크
  const hourlyResult = await rateLimitConfigs.publicPage.chat.limit(identifier);
  if (!hourlyResult.success) {
    return {
      success: false,
      remaining: hourlyResult.remaining,
      reset: hourlyResult.reset,
      error: '시간당 메시지 한도에 도달했습니다. 나중에 다시 시도해주세요.',
    };
  }

  // 일일 제한 체크
  const dailyResult = await rateLimitConfigs.publicPage.chatDaily.limit(identifier);
  if (!dailyResult.success) {
    return {
      success: false,
      remaining: dailyResult.remaining,
      reset: dailyResult.reset,
      error: '일일 메시지 한도에 도달했습니다. 내일 다시 시도해주세요.',
    };
  }

  return {
    success: true,
    remaining: Math.min(hourlyResult.remaining, dailyResult.remaining),
  };
}
```

### 4.2 서버 액션에 Rate Limit 적용

**파일**: `app/[slug]/actions.ts` (수정)

```typescript
'use server';

import { headers } from 'next/headers';
import { processChat } from '@/lib/chat/service';
import { checkPublicPageRateLimit } from '@/lib/middleware/rate-limit';

interface ChatResponse {
  message: string;
  sessionId?: string;
  error?: string;
}

/**
 * 클라이언트 IP 추출
 */
async function getClientIp(): Promise<string> {
  const headersList = await headers();

  // Vercel/Cloudflare 헤더 우선
  const forwardedFor = headersList.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }

  const realIp = headersList.get('x-real-ip');
  if (realIp) {
    return realIp;
  }

  // 폴백
  return '127.0.0.1';
}

/**
 * 공개 페이지 채팅 메시지 전송
 */
export async function sendPublicPageMessage(
  chatbotId: string,
  tenantId: string,
  message: string,
  sessionId?: string
): Promise<ChatResponse> {
  try {
    // Rate Limit 체크
    const clientIp = await getClientIp();
    const rateLimitResult = await checkPublicPageRateLimit(clientIp, chatbotId);

    if (!rateLimitResult.success) {
      return {
        message: '',
        error: rateLimitResult.error,
      };
    }

    // 메시지 길이 제한
    if (message.length > 2000) {
      return {
        message: '',
        error: '메시지가 너무 깁니다. (최대 2000자)',
      };
    }

    // 채팅 처리
    const result = await processChat({
      chatbotId,
      tenantId,
      message: message.trim(),
      sessionId,
      channel: 'public_page',
      metadata: {
        clientIp,
        timestamp: new Date().toISOString(),
      },
    });

    return {
      message: result.response,
      sessionId: result.sessionId,
    };
  } catch (error) {
    console.error('[PublicPage] Chat error:', error);
    return {
      message: '',
      error: '메시지 처리 중 오류가 발생했습니다.',
    };
  }
}
```

### 4.3 보안 헤더 설정

**파일**: `next.config.ts` (수정)

```typescript
import type { NextConfig } from 'next';

const securityHeaders = [
  // 클릭재킹 방지
  {
    key: 'X-Frame-Options',
    value: 'DENY',
  },
  // XSS 방지
  {
    key: 'X-XSS-Protection',
    value: '1; mode=block',
  },
  // MIME 타입 스니핑 방지
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  // Referrer 정책
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
  // 권한 정책 (민감한 API 제한)
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=()',
  },
];

const nextConfig: NextConfig = {
  // 기존 설정...

  async headers() {
    return [
      // 공개 페이지 보안 헤더 (슬러그 패턴)
      {
        source: '/:slug((?!api|_next|widget|admin|static).*)',
        headers: [
          ...securityHeaders,
          // 공개 페이지는 iframe 임베드 차단
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          // CSP 설정
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: https: blob:",
              "font-src 'self' data:",
              "connect-src 'self' https:",
              "frame-ancestors 'none'",  // iframe 차단
            ].join('; '),
          },
        ],
      },

      // Widget은 기존대로 iframe 허용
      {
        source: '/widget/:path*',
        headers: [
          ...securityHeaders.filter(h => h.key !== 'X-Frame-Options'),
          // Widget은 iframe 허용
          {
            key: 'X-Frame-Options',
            value: 'ALLOWALL',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
```

### 4.4 입력 검증 강화

**파일**: `lib/public-page/validation.ts` (신규)

```typescript
/**
 * 공개 페이지 입력 검증 유틸리티
 */

/**
 * 메시지 검증
 */
export function validateMessage(message: string): { valid: boolean; error?: string } {
  if (!message || typeof message !== 'string') {
    return { valid: false, error: '메시지가 비어있습니다.' };
  }

  const trimmed = message.trim();

  if (trimmed.length === 0) {
    return { valid: false, error: '메시지가 비어있습니다.' };
  }

  if (trimmed.length > 2000) {
    return { valid: false, error: '메시지가 너무 깁니다. (최대 2000자)' };
  }

  // 악의적인 패턴 차단 (선택적)
  const suspiciousPatterns = [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi,
  ];

  for (const pattern of suspiciousPatterns) {
    if (pattern.test(trimmed)) {
      return { valid: false, error: '허용되지 않는 내용이 포함되어 있습니다.' };
    }
  }

  return { valid: true };
}

/**
 * 세션 ID 검증
 */
export function validateSessionId(sessionId: string): boolean {
  // UUID v4 형식 체크
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidPattern.test(sessionId);
}

/**
 * Chatbot ID 검증
 */
export function validateChatbotId(chatbotId: string): boolean {
  // CUID2 또는 UUID 형식
  return /^[a-z0-9]{24,32}$/i.test(chatbotId) ||
         /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(chatbotId);
}
```

### 4.5 에러 로깅 및 모니터링

**파일**: `lib/public-page/monitoring.ts` (신규)

```typescript
/**
 * 공개 페이지 모니터링 유틸리티
 */

interface SecurityEvent {
  type: 'rate_limit' | 'validation_error' | 'suspicious_activity';
  chatbotId: string;
  ip: string;
  message?: string;
  timestamp: Date;
}

/**
 * 보안 이벤트 로깅
 */
export function logSecurityEvent(event: SecurityEvent): void {
  // 콘솔 로깅 (프로덕션에서는 외부 서비스로 전송)
  console.warn('[Security Event]', {
    ...event,
    timestamp: event.timestamp.toISOString(),
  });

  // TODO: Sentry, Datadog 등 외부 모니터링 서비스 연동
  // Sentry.captureMessage('Security event', { extra: event });
}

/**
 * Rate limit 초과 로깅
 */
export function logRateLimitExceeded(
  chatbotId: string,
  ip: string,
  limitType: 'burst' | 'hourly' | 'daily'
): void {
  logSecurityEvent({
    type: 'rate_limit',
    chatbotId,
    ip,
    message: `Rate limit exceeded: ${limitType}`,
    timestamp: new Date(),
  });
}

/**
 * 의심스러운 활동 감지
 */
export function detectSuspiciousActivity(
  chatbotId: string,
  ip: string,
  indicators: string[]
): boolean {
  // 의심스러운 지표가 임계값 초과 시
  if (indicators.length >= 3) {
    logSecurityEvent({
      type: 'suspicious_activity',
      chatbotId,
      ip,
      message: `Suspicious indicators: ${indicators.join(', ')}`,
      timestamp: new Date(),
    });
    return true;
  }
  return false;
}
```

## Rate Limit 정책 요약

| 제한 유형 | 제한 값 | 적용 대상 |
|----------|--------|----------|
| 버스트 제한 | 10 req/분 | IP + Chatbot |
| 시간당 제한 | 30 msg/시 | IP + Chatbot |
| 일일 제한 | 200 msg/일 | IP + Chatbot |
| 메시지 길이 | 2000자 | 개별 메시지 |

## 보안 헤더 적용

| 헤더 | 값 | 목적 |
|-----|---|------|
| X-Frame-Options | DENY | 클릭재킹 방지 |
| X-XSS-Protection | 1; mode=block | XSS 공격 방지 |
| X-Content-Type-Options | nosniff | MIME 스니핑 방지 |
| Referrer-Policy | strict-origin-when-cross-origin | 리퍼러 정보 보호 |
| Permissions-Policy | camera=(), microphone=() | 민감 API 제한 |
| Content-Security-Policy | frame-ancestors 'none' | iframe 임베드 차단 |

## 테스트 체크리스트

### Rate Limit 테스트

- [ ] 분당 10개 초과 요청 시 429 응답
- [ ] 시간당 30개 초과 메시지 시 제한 메시지
- [ ] 일일 200개 초과 메시지 시 제한 메시지
- [ ] Rate limit 후 reset 시간 경과 시 재개

### 보안 헤더 테스트

- [ ] 공개 페이지 X-Frame-Options: DENY 적용
- [ ] Widget 페이지 iframe 임베드 허용 유지
- [ ] CSP 헤더 정상 적용

### 입력 검증 테스트

- [ ] 빈 메시지 거부
- [ ] 2000자 초과 메시지 거부
- [ ] XSS 패턴 포함 메시지 거부
- [ ] 정상 메시지 통과

### 모니터링 테스트

- [ ] Rate limit 초과 시 로그 기록
- [ ] 의심스러운 활동 감지 및 로깅

## 롤백 절차

1. Rate limit 설정 제거 또는 완화
2. 보안 헤더 설정 원복
3. 서버 액션에서 rate limit 체크 제거

```bash
# next.config.ts에서 보안 헤더 제거
# lib/middleware/rate-limit.ts에서 publicPage 설정 제거
# app/[slug]/actions.ts에서 rate limit 관련 코드 제거
```

## 완료 조건

- [ ] Rate limit 정책 적용
- [ ] 보안 헤더 설정
- [ ] 입력 검증 강화
- [ ] 모니터링 로깅 구현
- [ ] 기존 widget 기능 정상 동작

## 다음 단계

Phase 4 완료 후 → [Phase 5: 통합 테스트 및 배포](./phase-5-deployment.md)
