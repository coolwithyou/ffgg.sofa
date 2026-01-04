/**
 * 공개 페이지 이미지 업로드 API
 *
 * POST /api/chatbots/:id/public-page/image
 * - Base64 인코딩된 이미지를 R2에 업로드
 * - 테넌트 격리 및 챗봇 소유권 검증
 */

import { NextRequest, NextResponse } from 'next/server';
import { eq, and } from 'drizzle-orm';
import { db } from '@/lib/db';
import { chatbots } from '@/drizzle/schema';
import { validateSession } from '@/lib/auth/session';
import { uploadFile } from '@/lib/upload/storage';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// 최대 파일 크기 (5MB)
const MAX_FILE_SIZE = 5 * 1024 * 1024;

// 허용 MIME 타입
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

/**
 * POST /api/chatbots/:id/public-page/image
 * 이미지 업로드
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await validateSession();
    if (!session) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 });
    }

    const { id } = await params;
    const tenantId = session.tenantId;

    // 챗봇 소유권 검증
    const [chatbot] = await db
      .select({ id: chatbots.id })
      .from(chatbots)
      .where(and(eq(chatbots.id, id), eq(chatbots.tenantId, tenantId)));

    if (!chatbot) {
      return NextResponse.json(
        { error: '챗봇을 찾을 수 없습니다' },
        { status: 404 }
      );
    }

    // 요청 파싱
    const body = await request.json();
    const { imageData, mimeType, filename = 'image.jpg' } = body as {
      imageData: string;
      mimeType: string;
      filename?: string;
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

    // Base64 디코딩
    const buffer = Buffer.from(imageData, 'base64');

    // 파일 크기 검사
    if (buffer.length > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: '파일 크기는 5MB를 초과할 수 없습니다.' },
        { status: 400 }
      );
    }

    // 파일 확장자 결정
    const ext = mimeType.split('/')[1] === 'jpeg' ? 'jpg' : mimeType.split('/')[1];
    const safeFilename = filename.replace(/\.[^/.]+$/, '') + '.' + ext;

    // R2에 파일 업로드
    const result = await uploadFile(buffer, {
      tenantId,
      folder: 'public-page',
      filename: safeFilename,
      contentType: mimeType,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || '업로드에 실패했습니다.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      url: result.url,
    });
  } catch (error) {
    console.error('Image upload error:', error);
    return NextResponse.json(
      { error: '이미지 업로드 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
