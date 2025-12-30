/**
 * 프로필 이미지 API
 * POST /api/user/avatar - 이미지 업로드
 * DELETE /api/user/avatar - 이미지 삭제
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateSession } from '@/lib/auth';
import { db, users } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { ErrorCode, AppError, errorResponse } from '@/lib/errors';

// 최대 파일 크기 (2MB)
const MAX_FILE_SIZE = 2 * 1024 * 1024;

// 허용 MIME 타입
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

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
    const { imageData, mimeType } = body as {
      imageData: string; // Base64 데이터
      mimeType: string;
    };

    // 유효성 검사
    if (!imageData || !mimeType) {
      return NextResponse.json(
        { error: '이미지 데이터가 필요합니다.' },
        { status: 400 }
      );
    }

    // MIME 타입 검사
    if (!ALLOWED_TYPES.includes(mimeType)) {
      return NextResponse.json(
        { error: 'JPG, PNG, GIF, WebP 형식만 지원합니다.' },
        { status: 400 }
      );
    }

    // Base64 데이터 크기 검사 (Base64는 약 33% 더 크므로 보정)
    const base64Size = (imageData.length * 3) / 4;
    if (base64Size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: '파일 크기는 2MB를 초과할 수 없습니다.' },
        { status: 400 }
      );
    }

    // Data URL 생성
    const avatarUrl = `data:${mimeType};base64,${imageData}`;

    // DB 저장
    await db
      .update(users)
      .set({
        avatarUrl,
        updatedAt: new Date(),
      })
      .where(eq(users.id, session.userId));

    return NextResponse.json({
      success: true,
      avatarUrl,
      message: '프로필 이미지가 업데이트되었습니다.',
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE() {
  try {
    const session = await validateSession();

    if (!session) {
      return NextResponse.json(
        new AppError(ErrorCode.UNAUTHORIZED).toSafeResponse(),
        { status: 401 }
      );
    }

    // 이미지 삭제 (null로 설정)
    await db
      .update(users)
      .set({
        avatarUrl: null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, session.userId));

    return NextResponse.json({
      success: true,
      message: '프로필 이미지가 삭제되었습니다.',
    });
  } catch (error) {
    return errorResponse(error);
  }
}
