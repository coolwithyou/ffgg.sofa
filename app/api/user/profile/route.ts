/**
 * 사용자 프로필 API
 * GET /api/user/profile - 프로필 조회
 * PATCH /api/user/profile - 프로필 수정
 */

import { NextRequest, NextResponse } from 'next/server';
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

    const user = await db.query.users.findFirst({
      where: eq(users.id, session.userId),
      columns: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        new AppError(ErrorCode.NOT_FOUND, '사용자를 찾을 수 없습니다.').toSafeResponse(),
        { status: 404 }
      );
    }

    return NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await validateSession();

    if (!session) {
      return NextResponse.json(
        new AppError(ErrorCode.UNAUTHORIZED).toSafeResponse(),
        { status: 401 }
      );
    }

    const body = await request.json();
    const { name } = body;

    // 이름 검증
    if (typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { error: '이름을 입력해주세요' },
        { status: 400 }
      );
    }

    if (name.trim().length > 50) {
      return NextResponse.json(
        { error: '이름은 50자 이하로 입력해주세요' },
        { status: 400 }
      );
    }

    // 프로필 업데이트
    const [updatedUser] = await db
      .update(users)
      .set({
        name: name.trim(),
        updatedAt: new Date(),
      })
      .where(eq(users.id, session.userId))
      .returning({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        createdAt: users.createdAt,
      });

    if (!updatedUser) {
      return NextResponse.json(
        new AppError(ErrorCode.NOT_FOUND, '사용자를 찾을 수 없습니다.').toSafeResponse(),
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      user: updatedUser,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
