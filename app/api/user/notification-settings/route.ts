/**
 * 알림 설정 API
 * GET /api/user/notification-settings - 설정 조회
 * PATCH /api/user/notification-settings - 설정 업데이트
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateSession } from '@/lib/auth';
import { db, users } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { ErrorCode, AppError, errorResponse } from '@/lib/errors';

export interface NotificationSettings {
  security: boolean; // 보안 관련 알림 (로그인, 비밀번호 변경 등)
  usage: boolean; // 사용량 관련 알림 (한도 초과 임박 등)
  marketing: boolean; // 마케팅/프로모션 알림
}

const DEFAULT_SETTINGS: NotificationSettings = {
  security: true,
  usage: true,
  marketing: false,
};

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
        notificationSettings: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        new AppError(ErrorCode.NOT_FOUND, '사용자를 찾을 수 없습니다.').toSafeResponse(),
        { status: 404 }
      );
    }

    // 설정이 없으면 기본값 반환
    const settings = (user.notificationSettings as NotificationSettings) || DEFAULT_SETTINGS;

    return NextResponse.json({
      success: true,
      settings,
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
    const { settings } = body as { settings: Partial<NotificationSettings> };

    if (!settings || typeof settings !== 'object') {
      return NextResponse.json(
        { error: '유효하지 않은 설정입니다.' },
        { status: 400 }
      );
    }

    // 현재 설정 조회
    const user = await db.query.users.findFirst({
      where: eq(users.id, session.userId),
      columns: {
        notificationSettings: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        new AppError(ErrorCode.NOT_FOUND, '사용자를 찾을 수 없습니다.').toSafeResponse(),
        { status: 404 }
      );
    }

    const currentSettings = (user.notificationSettings as NotificationSettings) || DEFAULT_SETTINGS;

    // 새 설정 병합 (boolean 값만 허용)
    const newSettings: NotificationSettings = {
      security:
        typeof settings.security === 'boolean'
          ? settings.security
          : currentSettings.security,
      usage:
        typeof settings.usage === 'boolean'
          ? settings.usage
          : currentSettings.usage,
      marketing:
        typeof settings.marketing === 'boolean'
          ? settings.marketing
          : currentSettings.marketing,
    };

    // 설정 저장
    await db
      .update(users)
      .set({
        notificationSettings: newSettings,
        updatedAt: new Date(),
      })
      .where(eq(users.id, session.userId));

    return NextResponse.json({
      success: true,
      settings: newSettings,
      message: '알림 설정이 저장되었습니다.',
    });
  } catch (error) {
    return errorResponse(error);
  }
}
