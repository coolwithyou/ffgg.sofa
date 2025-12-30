/**
 * TOTP 설정 시작 API
 * POST /api/user/totp/setup - QR 코드 생성
 */

import { NextResponse } from 'next/server';
import { validateSession } from '@/lib/auth';
import { db, users } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { ErrorCode, AppError, errorResponse } from '@/lib/errors';
import { setupTotp, generateBackupCodes } from '@/lib/auth/totp';

export async function POST() {
  try {
    const session = await validateSession();

    if (!session) {
      return NextResponse.json(
        new AppError(ErrorCode.UNAUTHORIZED).toSafeResponse(),
        { status: 401 }
      );
    }

    // 현재 사용자 조회
    const user = await db.query.users.findFirst({
      where: eq(users.id, session.userId),
      columns: {
        id: true,
        email: true,
        totpEnabled: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        new AppError(ErrorCode.NOT_FOUND, '사용자를 찾을 수 없습니다.').toSafeResponse(),
        { status: 404 }
      );
    }

    // 이미 2FA가 활성화된 경우
    if (user.totpEnabled) {
      return NextResponse.json(
        { error: '2FA가 이미 활성화되어 있습니다. 먼저 비활성화하세요.' },
        { status: 400 }
      );
    }

    // TOTP 설정 정보 생성
    const totpSetup = await setupTotp(user.id, user.email);

    // 백업 코드 생성
    const backupCodes = generateBackupCodes(10);

    return NextResponse.json({
      success: true,
      setup: {
        qrCodeDataUrl: totpSetup.qrCodeDataUrl,
        secret: totpSetup.secret, // 수동 입력용
        backupCodes, // 백업 코드 (사용자가 저장해야 함)
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
