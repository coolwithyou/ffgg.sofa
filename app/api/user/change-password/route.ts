/**
 * 비밀번호 변경 API
 * POST /api/user/change-password
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateSession } from '@/lib/auth';
import { db, users } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { ErrorCode, AppError, errorResponse } from '@/lib/errors';
import { hashPassword, verifyPassword, validatePassword } from '@/lib/auth/password';

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
    const { currentPassword, newPassword, confirmPassword } = body;

    // 필수 필드 검증
    if (!currentPassword || !newPassword || !confirmPassword) {
      return NextResponse.json(
        { error: '모든 필드를 입력해주세요' },
        { status: 400 }
      );
    }

    // 새 비밀번호 확인
    if (newPassword !== confirmPassword) {
      return NextResponse.json(
        { error: '새 비밀번호가 일치하지 않습니다' },
        { status: 400 }
      );
    }

    // 비밀번호 복잡성 검증
    const validation = validatePassword(newPassword);
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.errors.join(', ') || '비밀번호 복잡성 요건을 충족하지 않습니다' },
        { status: 400 }
      );
    }

    // 현재 사용자 조회
    const user = await db.query.users.findFirst({
      where: eq(users.id, session.userId),
      columns: {
        id: true,
        passwordHash: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        new AppError(ErrorCode.NOT_FOUND, '사용자를 찾을 수 없습니다.').toSafeResponse(),
        { status: 404 }
      );
    }

    // 현재 비밀번호 확인
    const isCurrentPasswordValid = await verifyPassword(currentPassword, user.passwordHash);
    if (!isCurrentPasswordValid) {
      return NextResponse.json(
        { error: '현재 비밀번호가 올바르지 않습니다' },
        { status: 400 }
      );
    }

    // 새 비밀번호 해시
    const newPasswordHash = await hashPassword(newPassword);

    // 비밀번호 업데이트
    await db
      .update(users)
      .set({
        passwordHash: newPasswordHash,
        passwordChangedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(users.id, session.userId));

    return NextResponse.json({
      success: true,
      message: '비밀번호가 변경되었습니다',
    });
  } catch (error) {
    return errorResponse(error);
  }
}
