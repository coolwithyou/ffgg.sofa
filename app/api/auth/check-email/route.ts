/**
 * 이메일 중복 확인 API
 * GET /api/auth/check-email?email=xxx
 *
 * 회원가입 폼에서 실시간으로 이메일 중복을 확인할 때 사용
 */

import { NextRequest, NextResponse } from 'next/server';
import { db, users } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { withRateLimit } from '@/lib/middleware';

export async function GET(request: NextRequest) {
  try {
    // Rate Limiting (너무 많은 요청 방지)
    const rateLimitResult = await withRateLimit(request, 'auth', 'basic');
    if (rateLimitResult) return rateLimitResult;

    const { searchParams } = new URL(request.url);
    const email = searchParams.get('email');

    if (!email) {
      return NextResponse.json(
        { error: 'email 파라미터가 필요합니다.' },
        { status: 400 }
      );
    }

    // 이메일 형식 검증
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: '유효한 이메일 형식이 아닙니다.' },
        { status: 400 }
      );
    }

    // 이메일 존재 여부 확인
    const existingUser = await db.query.users.findFirst({
      where: eq(users.email, email.toLowerCase()),
      columns: { id: true },
    });

    return NextResponse.json({
      exists: !!existingUser,
      // 보안을 위해 추가 정보는 제공하지 않음
    });
  } catch (error) {
    console.error('[CHECK_EMAIL]', error);
    return NextResponse.json(
      { error: '이메일 확인 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
