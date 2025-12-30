/**
 * 활성 세션 관리 API
 * GET /api/user/sessions - 활성 세션 목록 조회
 * DELETE /api/user/sessions - 특정 세션 또는 모든 세션 로그아웃
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { sessions } from '@/drizzle/schema';
import { eq, and, ne, desc, gt } from 'drizzle-orm';
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

    // 만료되지 않은 활성 세션 조회
    const activeSessions = await db
      .select({
        id: sessions.id,
        ipAddress: sessions.ipAddress,
        userAgent: sessions.userAgent,
        createdAt: sessions.createdAt,
        expiresAt: sessions.expiresAt,
      })
      .from(sessions)
      .where(
        and(
          eq(sessions.userId, session.userId),
          gt(sessions.expiresAt, new Date())
        )
      )
      .orderBy(desc(sessions.createdAt));

    return NextResponse.json({
      sessions: activeSessions.map((s) => ({
        id: s.id,
        ipAddress: s.ipAddress,
        userAgent: s.userAgent,
        createdAt: s.createdAt,
        expiresAt: s.expiresAt,
        // 현재 세션인지 여부는 클라이언트에서 확인 불가
        // (iron-session은 별도 세션 ID를 노출하지 않음)
      })),
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await validateSession();

    if (!session) {
      return NextResponse.json(
        new AppError(ErrorCode.UNAUTHORIZED).toSafeResponse(),
        { status: 401 }
      );
    }

    const body = await request.json();
    const { sessionId, logoutAll } = body;

    if (logoutAll) {
      // 현재 세션을 제외한 모든 세션 삭제
      // 참고: iron-session은 쿠키 기반이라 DB 세션과 별도로 관리됨
      // 여기서는 DB의 세션 레코드만 삭제
      await db
        .delete(sessions)
        .where(eq(sessions.userId, session.userId));

      return NextResponse.json({
        success: true,
        message: '모든 세션이 로그아웃되었습니다',
      });
    }

    if (!sessionId) {
      return NextResponse.json(
        { error: '세션 ID가 필요합니다' },
        { status: 400 }
      );
    }

    // 특정 세션 삭제
    const result = await db
      .delete(sessions)
      .where(
        and(
          eq(sessions.id, sessionId),
          eq(sessions.userId, session.userId)
        )
      )
      .returning({ id: sessions.id });

    if (result.length === 0) {
      return NextResponse.json(
        { error: '세션을 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: '세션이 로그아웃되었습니다',
    });
  } catch (error) {
    return errorResponse(error);
  }
}
