/**
 * TOTP 상태 조회 API
 * GET /api/user/totp/status - 2FA 활성화 상태 확인
 */

import { NextResponse } from 'next/server';
import { validateSession } from '@/lib/auth';
import { db, users } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { ErrorCode, AppError, errorResponse } from '@/lib/errors';

export async function GET() {
  try {
    const session = await validateSession();

    if (!session) {
      return NextResponse.json(
        new AppError(ErrorCode.UNAUTHORIZED).toSafeResponse(),
        { status: 401 }
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

    return NextResponse.json({
      enabled: user.totpEnabled || false,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
