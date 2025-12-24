/**
 * 채팅 API 라우트
 * POST /api/chat - 채팅 메시지 처리
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { processChat } from '@/lib/chat';
import { validateTenantAccessSimple, getTenantId } from '@/lib/middleware/tenant';
import { checkRateLimitWithConfig, RATE_LIMIT_CONFIGS } from '@/lib/middleware/rate-limit';
import { ErrorCode, AppError, ValidationError, handleApiError } from '@/lib/errors';

// 요청 스키마
const chatRequestSchema = z.object({
  message: z.string().min(1, '메시지를 입력하세요').max(4000, '메시지가 너무 깁니다'),
  sessionId: z.string().uuid().optional(),
  channel: z.enum(['web', 'kakao']).default('web'),
});

export async function POST(request: NextRequest) {
  try {
    // 1. 테넌트 검증
    const tenantValidation = await validateTenantAccessSimple(request);
    if (!tenantValidation.valid) {
      return NextResponse.json({ error: tenantValidation.error }, { status: 401 });
    }

    const tenantId = tenantValidation.tenantId;
    if (!tenantId) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, '테넌트 ID가 필요합니다');
    }

    // 2. Rate Limiting
    const rateLimitResult = await checkRateLimitWithConfig(
      `chat:${tenantId}`,
      RATE_LIMIT_CONFIGS.chat
    );

    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        {
          error: '요청 한도를 초과했습니다',
          retryAfter: rateLimitResult.retryAfter,
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(rateLimitResult.retryAfter || 60),
            'X-RateLimit-Remaining': String(rateLimitResult.remaining),
          },
        }
      );
    }

    // 3. 요청 파싱 및 검증
    const body = await request.json();
    const parseResult = chatRequestSchema.safeParse(body);

    if (!parseResult.success) {
      const errors = parseResult.error.issues.map((issue) => ({
        path: issue.path.map((p) => (typeof p === 'symbol' ? String(p) : p)),
        message: issue.message,
      }));
      throw new ValidationError('잘못된 요청 형식', errors);
    }

    const { message, sessionId, channel } = parseResult.data;

    // 4. 채팅 처리
    const response = await processChat(tenantId, { message, sessionId, channel });

    // 5. 응답 반환
    return NextResponse.json(response, {
      headers: {
        'X-RateLimit-Remaining': String(rateLimitResult.remaining),
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * OPTIONS - CORS 지원
 */
export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get('origin') || '';
  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [];

  // 허용된 출처 확인 (개발 환경에서는 localhost 허용)
  const isAllowed =
    allowedOrigins.includes(origin) ||
    (process.env.NODE_ENV === 'development' && origin.startsWith('http://localhost'));

  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': isAllowed ? origin : '',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Tenant-ID',
      'Access-Control-Max-Age': '86400',
    },
  });
}
