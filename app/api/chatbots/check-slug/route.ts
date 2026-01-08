/**
 * 슬러그 중복 체크 API
 *
 * GET /api/chatbots/check-slug?slug=xxx&excludeId=xxx
 * 공개 페이지 URL 슬러그의 사용 가능 여부를 확인합니다.
 */

import { NextRequest, NextResponse } from 'next/server';
import { eq, and, ne } from 'drizzle-orm';
import { db } from '@/lib/db';
import { chatbots } from '@/drizzle/schema';
import { validateSession } from '@/lib/auth/session';
import { validateSlugAsync } from '@/lib/public-page/reserved-slugs';

/**
 * GET /api/chatbots/check-slug
 *
 * Query Parameters:
 * - slug: 확인할 슬러그 (필수)
 * - excludeId: 중복 체크에서 제외할 챗봇 ID (수정 시 자기 자신 제외용)
 *
 * Response:
 * - valid: 슬러그 형식이 유효한지 (예약어, 형식 검사)
 * - available: 사용 가능한지 (DB 중복 체크)
 * - error: 오류 메시지 (valid가 false일 때)
 */
export async function GET(request: NextRequest) {
  try {
    // 인증 확인
    const session = await validateSession();
    if (!session) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const slug = searchParams.get('slug');
    const excludeId = searchParams.get('excludeId');

    // 슬러그 필수 검사
    if (!slug) {
      return NextResponse.json(
        { valid: false, available: false, error: '슬러그를 입력해주세요.' },
        { status: 400 }
      );
    }

    // 슬러그 형식, 시스템 예약어, DB 예약어 검사
    const validation = await validateSlugAsync(slug);
    if (!validation.valid) {
      return NextResponse.json({
        valid: false,
        available: false,
        // 중복/예약 구분 없이 통합 메시지
        error: '사용할 수 없는 키워드입니다',
      });
    }

    // DB에서 중복 체크 (다른 챗봇이 사용 중인지)
    const existingChatbot = await db.query.chatbots.findFirst({
      where: excludeId
        ? and(eq(chatbots.slug, slug), ne(chatbots.id, excludeId))
        : eq(chatbots.slug, slug),
      columns: { id: true },
    });

    const available = !existingChatbot;

    return NextResponse.json({
      valid: true,
      available,
      // 중복/예약 구분 없이 통합 메시지
      error: available ? null : '사용할 수 없는 키워드입니다',
    });
  } catch (error) {
    console.error('Check slug error:', error);
    return NextResponse.json(
      { valid: false, available: false, error: '슬러그 확인 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
