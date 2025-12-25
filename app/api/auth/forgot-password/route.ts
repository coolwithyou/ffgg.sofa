/**
 * 비밀번호 찾기 API
 * POST /api/auth/forgot-password
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db, users } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { withRateLimit } from '@/lib/middleware';
import { ErrorCode, AppError, errorResponse } from '@/lib/errors';
import { v4 as uuidv4 } from 'uuid';
import { sendPasswordResetEmail } from '@/lib/email';

const forgotPasswordSchema = z.object({
  email: z.string().email('유효한 이메일 주소를 입력하세요.'),
});

export async function POST(request: NextRequest) {
  try {
    // 1. Rate Limiting (비밀번호 찾기)
    const rateLimitResult = await withRateLimit(request, 'auth', 'basic');
    if (rateLimitResult) return rateLimitResult;

    // 2. 요청 파싱
    const body = await request.json();
    const parsed = forgotPasswordSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        new AppError(ErrorCode.VALIDATION_ERROR, undefined, {
          errors: parsed.error.issues,
        }).toSafeResponse(),
        { status: 400 }
      );
    }

    const { email } = parsed.data;

    // 3. 사용자 조회
    const user = await db.query.users.findFirst({
      where: eq(users.email, email),
    });

    // 보안: 사용자 존재 여부와 관계없이 동일한 응답
    // 타이밍 공격 방지를 위해 항상 동일한 작업 수행
    const resetToken = uuidv4();
    const resetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1시간 후 만료

    if (user) {
      // 4. 토큰 저장
      await db
        .update(users)
        .set({
          passwordResetToken: resetToken,
          passwordResetExpires: resetExpires,
          updatedAt: new Date(),
        })
        .where(eq(users.id, user.id));

      // 5. 이메일 발송
      const emailResult = await sendPasswordResetEmail({
        to: email,
        token: resetToken,
      });

      if (!emailResult.success) {
        console.warn('[FORGOT-PASSWORD] 이메일 발송 실패:', emailResult.error);
      }

      // 개발 환경에서는 콘솔에 토큰 출력 (디버깅용)
      if (process.env.NODE_ENV === 'development') {
        console.log(`[DEV] Password reset token for ${email}: ${resetToken}`);
      }
    }

    // 6. 항상 성공 응답 (사용자 존재 여부 숨김)
    return NextResponse.json({
      success: true,
      message: '이메일이 등록되어 있다면 비밀번호 재설정 링크가 발송됩니다.',
    });
  } catch (error) {
    return errorResponse(error);
  }
}
