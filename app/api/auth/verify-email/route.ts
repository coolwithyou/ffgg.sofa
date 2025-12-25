/**
 * 이메일 인증 API
 * POST /api/auth/verify-email
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db, users } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { withRateLimit } from '@/lib/middleware';
import { ErrorCode, AppError, errorResponse } from '@/lib/errors';

const verifyEmailSchema = z.object({
  token: z.string().uuid('유효하지 않은 토큰입니다.'),
});

export async function POST(request: NextRequest) {
  try {
    // 1. Rate Limiting
    const rateLimitResult = await withRateLimit(request, 'auth', 'basic');
    if (rateLimitResult) return rateLimitResult;

    // 2. 요청 파싱
    const body = await request.json();
    const parsed = verifyEmailSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        new AppError(ErrorCode.VALIDATION_ERROR, undefined, {
          errors: parsed.error.issues,
        }).toSafeResponse(),
        { status: 400 }
      );
    }

    const { token } = parsed.data;

    // 3. 토큰으로 사용자 조회
    const user = await db.query.users.findFirst({
      where: eq(users.emailVerificationToken, token),
    });

    if (!user) {
      return NextResponse.json(
        new AppError(ErrorCode.INVALID_TOKEN, '유효하지 않거나 이미 사용된 토큰입니다.').toSafeResponse(),
        { status: 400 }
      );
    }

    // 4. 이미 인증된 경우
    if (user.emailVerified) {
      return NextResponse.json({
        success: true,
        message: '이미 인증이 완료된 이메일입니다.',
      });
    }

    // 5. 이메일 인증 처리
    await db
      .update(users)
      .set({
        emailVerified: true,
        emailVerificationToken: null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));

    return NextResponse.json({
      success: true,
      message: '이메일이 성공적으로 인증되었습니다.',
    });
  } catch (error) {
    return errorResponse(error);
  }
}
