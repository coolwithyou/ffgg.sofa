/**
 * 로그인 API
 * POST /api/auth/login
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db, users } from '@/lib/db';
import { eq } from 'drizzle-orm';
import {
  createSession,
  verifyPassword,
  canAttemptLogin,
  recordLoginAttempt,
  isPasswordChangeRequired,
} from '@/lib/auth';
import { withRateLimit } from '@/lib/middleware';
import { ErrorCode, AppError, errorResponse } from '@/lib/errors';
import { logLoginSuccess, logLoginFailure } from '@/lib/audit/logger';

const loginSchema = z.object({
  email: z.string().email('유효한 이메일 주소를 입력하세요.'),
  password: z.string().min(1, '비밀번호를 입력하세요.'),
});

export async function POST(request: NextRequest) {
  try {
    // 1. Rate Limiting
    const rateLimitResult = await withRateLimit(request, 'auth', 'basic');
    if (rateLimitResult) return rateLimitResult;

    // 2. 요청 파싱
    const body = await request.json();
    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        new AppError(ErrorCode.VALIDATION_ERROR, undefined, {
          errors: parsed.error.issues,
        }).toSafeResponse(),
        { status: 400 }
      );
    }

    const { email, password } = parsed.data;
    const ipAddress =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      undefined;

    // 3. 계정 잠금 상태 확인
    const lockStatus = await canAttemptLogin(email, ipAddress);

    if (!lockStatus.allowed) {
      await logLoginFailure(request, email, 'account_locked');

      return NextResponse.json(
        new AppError(
          ErrorCode.ACCOUNT_LOCKED,
          `계정이 잠겼습니다. ${lockStatus.lockDurationMinutes}분 후 다시 시도하세요.`
        ).toSafeResponse(),
        { status: 423 }
      );
    }

    // 4. 사용자 조회
    const user = await db.query.users.findFirst({
      where: eq(users.email, email),
    });

    if (!user) {
      // 타이밍 공격 방지: 존재하지 않는 사용자도 동일한 시간 소요
      await verifyPassword(password, '$2b$12$dummy.hash.for.timing.attack');
      await recordLoginAttempt(email, false, ipAddress);
      await logLoginFailure(request, email, 'user_not_found');

      return NextResponse.json(
        new AppError(ErrorCode.INVALID_CREDENTIALS).toSafeResponse(),
        { status: 401 }
      );
    }

    // 5. 비밀번호 검증
    const isValid = await verifyPassword(password, user.passwordHash);

    if (!isValid) {
      await recordLoginAttempt(email, false, ipAddress);
      await logLoginFailure(request, email, 'invalid_password');

      return NextResponse.json(
        new AppError(ErrorCode.INVALID_CREDENTIALS).toSafeResponse(),
        {
          status: 401,
          headers: {
            'X-Remaining-Attempts': lockStatus.remainingAttempts.toString(),
          },
        }
      );
    }

    // 6. 이메일 인증 확인
    if (!user.emailVerified) {
      await logLoginFailure(request, email, 'email_not_verified');

      return NextResponse.json(
        new AppError(ErrorCode.EMAIL_NOT_VERIFIED).toSafeResponse(),
        { status: 403 }
      );
    }

    // 7. 로그인 성공 처리
    await recordLoginAttempt(email, true, ipAddress);

    // 8. 세션 생성
    await createSession({
      userId: user.id,
      email: user.email,
      tenantId: user.tenantId || '',
      role: (user.role || 'user') as 'user' | 'admin' | 'internal_operator',
    });

    // 9. 접속기록 로깅
    await logLoginSuccess(request, user.id, user.tenantId || undefined);

    // 10. 비밀번호 변경 필요 여부 확인
    const passwordChangeRequired = isPasswordChangeRequired(user.passwordChangedAt);

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        tenantId: user.tenantId,
      },
      passwordChangeRequired,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
