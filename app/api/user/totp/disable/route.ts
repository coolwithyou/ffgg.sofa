/**
 * TOTP 비활성화 API
 * POST /api/user/totp/disable - 2FA 비활성화
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateSession } from '@/lib/auth';
import { db, users } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { ErrorCode, AppError, errorResponse } from '@/lib/errors';
import { verifyPassword } from '@/lib/auth/password';
import { disableTotpForUser } from '@/lib/auth/totp';

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
    const { password } = body;

    // 비밀번호 필수
    if (!password) {
      return NextResponse.json(
        { error: '비밀번호를 입력해주세요' },
        { status: 400 }
      );
    }

    // 현재 사용자 조회
    const user = await db.query.users.findFirst({
      where: eq(users.id, session.userId),
      columns: {
        id: true,
        passwordHash: true,
        totpEnabled: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        new AppError(ErrorCode.NOT_FOUND, '사용자를 찾을 수 없습니다.').toSafeResponse(),
        { status: 404 }
      );
    }

    // 2FA가 활성화되지 않은 경우
    if (!user.totpEnabled) {
      return NextResponse.json(
        { error: '2FA가 활성화되어 있지 않습니다' },
        { status: 400 }
      );
    }

    // 비밀번호 확인
    const isPasswordValid = await verifyPassword(password, user.passwordHash);
    if (!isPasswordValid) {
      return NextResponse.json(
        { error: '비밀번호가 올바르지 않습니다' },
        { status: 400 }
      );
    }

    // TOTP 비활성화
    const success = await disableTotpForUser(session.userId);

    if (!success) {
      return NextResponse.json(
        { error: '2FA 비활성화에 실패했습니다' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: '2단계 인증이 비활성화되었습니다',
    });
  } catch (error) {
    return errorResponse(error);
  }
}
