/**
 * 이메일 변경 요청 API
 * POST /api/user/change-email - 새 이메일로 인증 메일 발송
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateSession, verifyPassword } from '@/lib/auth';
import { db, users } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { ErrorCode, AppError, errorResponse } from '@/lib/errors';
import { sendEmailChangeVerification } from '@/lib/email';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  try {
    const session = await validateSession();

    if (!session) {
      return NextResponse.json(
        new AppError(ErrorCode.UNAUTHORIZED).toSafeResponse(),
        { status: 401 }
      );
    }

    const body = await request.json();
    const { newEmail, password } = body;

    // 필수 필드 검증
    if (!newEmail || !password) {
      return NextResponse.json(
        { error: '새 이메일과 비밀번호를 입력해주세요.' },
        { status: 400 }
      );
    }

    // 이메일 형식 검증
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail)) {
      return NextResponse.json(
        { error: '유효한 이메일 주소를 입력해주세요.' },
        { status: 400 }
      );
    }

    // 현재 사용자 조회
    const user = await db.query.users.findFirst({
      where: eq(users.id, session.userId),
    });

    if (!user) {
      return NextResponse.json(
        new AppError(ErrorCode.NOT_FOUND, '사용자를 찾을 수 없습니다.').toSafeResponse(),
        { status: 404 }
      );
    }

    // 동일한 이메일인지 확인
    if (user.email === newEmail) {
      return NextResponse.json(
        { error: '현재 이메일과 동일합니다.' },
        { status: 400 }
      );
    }

    // 비밀번호 확인
    const isValidPassword = await verifyPassword(password, user.passwordHash);
    if (!isValidPassword) {
      return NextResponse.json(
        { error: '비밀번호가 올바르지 않습니다.' },
        { status: 401 }
      );
    }

    // 이메일 중복 확인
    const existingUser = await db.query.users.findFirst({
      where: eq(users.email, newEmail),
    });

    if (existingUser) {
      return NextResponse.json(
        { error: '이미 사용 중인 이메일입니다.' },
        { status: 409 }
      );
    }

    // 인증 토큰 생성 (24시간 유효)
    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24시간

    // 새 이메일 정보 저장
    await db
      .update(users)
      .set({
        newEmail,
        newEmailToken: token,
        newEmailExpires: expires,
        updatedAt: new Date(),
      })
      .where(eq(users.id, session.userId));

    // 인증 이메일 발송
    await sendEmailChangeVerification({
      to: newEmail,
      token,
      userName: user.name || undefined,
      oldEmail: user.email,
    });

    return NextResponse.json({
      success: true,
      message: '인증 이메일이 발송되었습니다. 24시간 내에 인증을 완료해주세요.',
    });
  } catch (error) {
    return errorResponse(error);
  }
}
