/**
 * TOTP 활성화 확인 API
 * POST /api/user/totp/verify - 코드 확인 후 활성화
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateSession } from '@/lib/auth';
import { db, users } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { ErrorCode, AppError, errorResponse } from '@/lib/errors';
import { enableTotpForUser } from '@/lib/auth/totp';

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
    const { secret, token, backupCodes } = body;

    // 필수 필드 검증
    if (!secret || !token || !backupCodes) {
      return NextResponse.json(
        { error: '필수 정보가 누락되었습니다' },
        { status: 400 }
      );
    }

    // 토큰 형식 검증 (6자리 숫자)
    if (!/^\d{6}$/.test(token)) {
      return NextResponse.json(
        { error: '인증 코드는 6자리 숫자여야 합니다' },
        { status: 400 }
      );
    }

    // 현재 사용자 조회
    const user = await db.query.users.findFirst({
      where: eq(users.id, session.userId),
      columns: {
        id: true,
        totpEnabled: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        new AppError(ErrorCode.NOT_FOUND, '사용자를 찾을 수 없습니다.').toSafeResponse(),
        { status: 404 }
      );
    }

    // 이미 활성화된 경우
    if (user.totpEnabled) {
      return NextResponse.json(
        { error: '2FA가 이미 활성화되어 있습니다' },
        { status: 400 }
      );
    }

    // TOTP 활성화
    const result = await enableTotpForUser(
      session.userId,
      secret,
      token,
      backupCodes
    );

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || '2FA 활성화에 실패했습니다' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: '2단계 인증이 활성화되었습니다',
    });
  } catch (error) {
    return errorResponse(error);
  }
}
