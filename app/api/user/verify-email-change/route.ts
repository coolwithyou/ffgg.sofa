/**
 * 이메일 변경 인증 API
 * POST /api/user/verify-email-change - 토큰 검증 후 이메일 변경
 */

import { NextRequest, NextResponse } from 'next/server';
import { db, users } from '@/lib/db';
import { eq, and, gt } from 'drizzle-orm';
import { errorResponse } from '@/lib/errors';
import { sendEmailChangeNotification } from '@/lib/email';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token } = body;

    if (!token) {
      return NextResponse.json(
        { error: '인증 토큰이 필요합니다.' },
        { status: 400 }
      );
    }

    // 토큰으로 사용자 조회
    const user = await db.query.users.findFirst({
      where: and(
        eq(users.newEmailToken, token),
        gt(users.newEmailExpires, new Date())
      ),
    });

    if (!user) {
      return NextResponse.json(
        { error: '유효하지 않거나 만료된 인증 링크입니다.' },
        { status: 400 }
      );
    }

    if (!user.newEmail) {
      return NextResponse.json(
        { error: '변경할 이메일 정보가 없습니다.' },
        { status: 400 }
      );
    }

    // 이메일 중복 재확인 (동시 요청 대비)
    const existingUser = await db.query.users.findFirst({
      where: eq(users.email, user.newEmail),
    });

    if (existingUser) {
      return NextResponse.json(
        { error: '이미 사용 중인 이메일입니다.' },
        { status: 409 }
      );
    }

    const oldEmail = user.email;
    const newEmail = user.newEmail;

    // 이메일 변경 적용
    await db
      .update(users)
      .set({
        email: newEmail,
        newEmail: null,
        newEmailToken: null,
        newEmailExpires: null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));

    // 기존 이메일로 변경 알림 발송
    await sendEmailChangeNotification({
      to: oldEmail,
      newEmail,
      userName: user.name || undefined,
    });

    return NextResponse.json({
      success: true,
      message: '이메일이 성공적으로 변경되었습니다.',
      newEmail,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
