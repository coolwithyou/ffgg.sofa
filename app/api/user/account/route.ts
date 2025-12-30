/**
 * 계정 삭제 API
 * DELETE /api/user/account - 계정 삭제 요청 (30일 유예)
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateSession, destroySession } from '@/lib/auth';
import { db, users } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { ErrorCode, AppError, errorResponse } from '@/lib/errors';
import { verifyPassword } from '@/lib/auth/password';

const DELETION_GRACE_DAYS = 30;

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
    const { password, confirmText } = body;

    // 비밀번호 필수
    if (!password) {
      return NextResponse.json(
        { error: '비밀번호를 입력해주세요' },
        { status: 400 }
      );
    }

    // 탈퇴 확인 문구 검증
    if (confirmText !== '탈퇴합니다') {
      return NextResponse.json(
        { error: '"탈퇴합니다"를 정확히 입력해주세요' },
        { status: 400 }
      );
    }

    // 사용자 조회
    const user = await db.query.users.findFirst({
      where: eq(users.id, session.userId),
      columns: {
        id: true,
        passwordHash: true,
        deleteScheduledAt: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        new AppError(ErrorCode.NOT_FOUND, '사용자를 찾을 수 없습니다.').toSafeResponse(),
        { status: 404 }
      );
    }

    // 이미 삭제 예정인 경우
    if (user.deleteScheduledAt) {
      return NextResponse.json(
        { error: '이미 계정 삭제가 예정되어 있습니다' },
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

    // 30일 후 삭제 예정일 설정
    const deleteScheduledAt = new Date();
    deleteScheduledAt.setDate(deleteScheduledAt.getDate() + DELETION_GRACE_DAYS);

    // 삭제 예정 상태로 업데이트
    await db
      .update(users)
      .set({
        deleteScheduledAt,
        updatedAt: new Date(),
      })
      .where(eq(users.id, session.userId));

    // 세션 삭제 (로그아웃)
    await destroySession();

    return NextResponse.json({
      success: true,
      message: `${DELETION_GRACE_DAYS}일 후 계정이 삭제됩니다. 삭제 취소는 이 기간 내에 다시 로그인하면 가능합니다.`,
      deleteScheduledAt: deleteScheduledAt.toISOString(),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
