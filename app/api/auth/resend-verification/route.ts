/**
 * 인증 이메일 재발송 API
 * POST /api/auth/resend-verification
 *
 * 로그인한 사용자가 이메일 인증을 요청할 때 사용합니다.
 * Delayed Verification 전략: 핵심 기능(발행 등) 사용 시점에 호출됩니다.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db, users } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { getSession } from '@/lib/auth';
import { withRateLimit } from '@/lib/middleware';
import { sendVerificationEmail } from '@/lib/email';
import { v4 as uuidv4 } from 'uuid';

export async function POST(request: NextRequest) {
  try {
    // 1. Rate Limiting (이메일 발송 남용 방지)
    const rateLimitResult = await withRateLimit(request, 'auth', 'basic');
    if (rateLimitResult) return rateLimitResult;

    // 2. 세션 확인
    const session = await getSession();
    if (!session || !session.userId) {
      return NextResponse.json(
        { error: '로그인이 필요합니다.' },
        { status: 401 }
      );
    }

    // 3. 사용자 조회
    const user = await db.query.users.findFirst({
      where: eq(users.id, session.userId),
    });

    if (!user) {
      return NextResponse.json(
        { error: '사용자를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 4. 이미 인증된 경우
    if (user.emailVerified) {
      return NextResponse.json({
        success: true,
        message: '이미 이메일 인증이 완료되었습니다.',
        alreadyVerified: true,
      });
    }

    // 5. 새 토큰 생성 (기존 토큰이 없거나 재발송 시)
    let token = user.emailVerificationToken;
    if (!token) {
      token = uuidv4();
      await db
        .update(users)
        .set({ emailVerificationToken: token })
        .where(eq(users.id, user.id));
    }

    // 6. 인증 이메일 발송
    const emailResult = await sendVerificationEmail({
      to: user.email,
      token,
      userName: user.name || undefined,
    });

    if (!emailResult.success) {
      console.error('[RESEND_VERIFICATION]', emailResult.error);
      return NextResponse.json(
        { error: '이메일 발송 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: '인증 이메일이 발송되었습니다. 메일함을 확인해주세요.',
    });
  } catch (error) {
    console.error('[RESEND_VERIFICATION]', error);
    return NextResponse.json(
      { error: '이메일 발송 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
