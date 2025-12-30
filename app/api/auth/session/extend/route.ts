/**
 * 세션 연장 API
 * POST /api/auth/session/extend
 */

import { NextResponse } from 'next/server';
import { extendSession } from '@/lib/auth';

export async function POST() {
  try {
    const result = await extendSession();

    if (!result) {
      return NextResponse.json(
        { error: '세션이 만료되었거나 유효하지 않습니다.' },
        { status: 401 }
      );
    }

    return NextResponse.json({
      success: true,
      expiresAt: result.expiresAt,
    });
  } catch (error) {
    console.error('Session extend error:', error);
    return NextResponse.json(
      { error: '세션 연장 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
