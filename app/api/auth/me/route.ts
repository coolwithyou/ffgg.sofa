/**
 * 현재 사용자 정보 API
 * GET /api/auth/me
 */

import { NextResponse } from 'next/server';
import { validateSession, refreshSession, daysUntilPasswordExpiry } from '@/lib/auth';
import { db, users } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { ErrorCode, AppError, errorResponse } from '@/lib/errors';

export async function GET() {
  try {
    // 1. 세션 검증 및 갱신
    const session = await validateSession();

    if (!session) {
      return NextResponse.json(
        new AppError(ErrorCode.UNAUTHORIZED).toSafeResponse(),
        { status: 401 }
      );
    }

    // 2. 세션 활동 시간 갱신
    await refreshSession();

    // 3. 사용자 정보 조회
    const user = await db.query.users.findFirst({
      where: eq(users.id, session.userId),
      columns: {
        id: true,
        email: true,
        role: true,
        tenantId: true,
        emailVerified: true,
        passwordChangedAt: true,
        createdAt: true,
        isPlatformAdmin: true,
        adminRole: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        new AppError(ErrorCode.NOT_FOUND, '사용자를 찾을 수 없습니다.').toSafeResponse(),
        { status: 404 }
      );
    }

    // 4. 비밀번호 만료까지 남은 일수
    const passwordExpiryDays = daysUntilPasswordExpiry(user.passwordChangedAt);

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        tenantId: user.tenantId,
        emailVerified: user.emailVerified,
        createdAt: user.createdAt,
        isPlatformAdmin: user.isPlatformAdmin ?? false,
        adminRole: user.adminRole ?? null,
      },
      session: {
        expiresIn: 30 * 60, // 30분 (초)
      },
      passwordExpiryDays,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
