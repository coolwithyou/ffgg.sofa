/**
 * 비밀번호 재설정 API
 * POST /api/auth/reset-password
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db, users } from '@/lib/db';
import { eq, and, gt } from 'drizzle-orm';
import { hashPassword, passwordSchema } from '@/lib/auth';
import { withRateLimit } from '@/lib/middleware';
import { ErrorCode, AppError, errorResponse } from '@/lib/errors';

const resetPasswordSchema = z.object({
  token: z.string().uuid('유효하지 않은 토큰입니다.'),
  password: passwordSchema,
});

export async function POST(request: NextRequest) {
  try {
    // 1. Rate Limiting
    const rateLimitResult = await withRateLimit(request, 'auth', 'basic');
    if (rateLimitResult) return rateLimitResult;

    // 2. 요청 파싱
    const body = await request.json();
    const parsed = resetPasswordSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        new AppError(ErrorCode.VALIDATION_ERROR, undefined, {
          errors: parsed.error.issues,
        }).toSafeResponse(),
        { status: 400 }
      );
    }

    const { token, password } = parsed.data;

    // 3. 토큰으로 사용자 조회 (만료되지 않은 토큰)
    const user = await db.query.users.findFirst({
      where: and(
        eq(users.passwordResetToken, token),
        gt(users.passwordResetExpires, new Date())
      ),
    });

    if (!user) {
      return NextResponse.json(
        new AppError(ErrorCode.INVALID_TOKEN, '유효하지 않거나 만료된 토큰입니다.').toSafeResponse(),
        { status: 400 }
      );
    }

    // 4. 비밀번호 업데이트
    const passwordHash = await hashPassword(password);

    await db
      .update(users)
      .set({
        passwordHash,
        passwordResetToken: null,
        passwordResetExpires: null,
        passwordChangedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));

    return NextResponse.json({
      success: true,
      message: '비밀번호가 성공적으로 변경되었습니다.',
    });
  } catch (error) {
    return errorResponse(error);
  }
}
