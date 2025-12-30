/**
 * 로그인 기록 조회 API
 * GET /api/user/login-history - 최근 로그인 기록 조회
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { loginAttempts } from '@/drizzle/schema';
import { eq, desc } from 'drizzle-orm';
import { ErrorCode, AppError, errorResponse } from '@/lib/errors';

export async function GET(request: NextRequest) {
  try {
    const session = await validateSession();

    if (!session) {
      return NextResponse.json(
        new AppError(ErrorCode.UNAUTHORIZED).toSafeResponse(),
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50);

    // 로그인 시도 기록 조회 (이메일 기준)
    const history = await db
      .select({
        id: loginAttempts.id,
        ipAddress: loginAttempts.ipAddress,
        success: loginAttempts.success,
        createdAt: loginAttempts.createdAt,
      })
      .from(loginAttempts)
      .where(eq(loginAttempts.email, session.email))
      .orderBy(desc(loginAttempts.createdAt))
      .limit(limit);

    return NextResponse.json({
      history: history.map((item) => ({
        id: item.id,
        ipAddress: item.ipAddress,
        success: item.success,
        createdAt: item.createdAt,
      })),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
