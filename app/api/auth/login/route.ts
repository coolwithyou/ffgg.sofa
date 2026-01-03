/**
 * 로그인 API
 * POST /api/auth/login
 *
 * 2FA 지원:
 * - totpRequired: true 반환 시 클라이언트가 TOTP 코드 재요청
 * - totpToken 포함 시 2FA 검증 후 세션 생성
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db, users } from '@/lib/db';
import { eq } from 'drizzle-orm';
import {
  createSession,
  verifyPassword,
  canAttemptLogin,
  recordLoginAttempt,
  isPasswordChangeRequired,
} from '@/lib/auth';
import { verifyTotpToken } from '@/lib/auth/totp';
import { withRateLimit } from '@/lib/middleware';
import { ErrorCode, AppError, errorResponse } from '@/lib/errors';
import { logLoginSuccess, logLoginFailure } from '@/lib/audit/logger';

const loginSchema = z.object({
  email: z.string().email('유효한 이메일 주소를 입력하세요.'),
  password: z.string().min(1, '비밀번호를 입력하세요.'),
  totpToken: z.string().optional(), // 2FA 코드 (선택)
  useBackupCode: z.boolean().optional(), // 백업 코드 사용 여부
});

export async function POST(request: NextRequest) {
  try {
    // 1. Rate Limiting
    const rateLimitResult = await withRateLimit(request, 'auth', 'login');
    if (rateLimitResult) return rateLimitResult;

    // 2. 요청 파싱
    const body = await request.json();
    const parsed = loginSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        new AppError(ErrorCode.VALIDATION_ERROR, undefined, {
          errors: parsed.error.issues,
        }).toSafeResponse(),
        { status: 400 }
      );
    }

    const { email, password, totpToken, useBackupCode } = parsed.data;
    const ipAddress =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      undefined;

    // 3. 계정 잠금 상태 확인
    const lockStatus = await canAttemptLogin(email, ipAddress);

    if (!lockStatus.allowed) {
      await logLoginFailure(request, email, 'account_locked');

      return NextResponse.json(
        new AppError(
          ErrorCode.ACCOUNT_LOCKED,
          `계정이 잠겼습니다. ${lockStatus.lockDurationMinutes}분 후 다시 시도하세요.`
        ).toSafeResponse(),
        { status: 423 }
      );
    }

    // 4. 사용자 조회
    const user = await db.query.users.findFirst({
      where: eq(users.email, email),
    });

    if (!user) {
      // 타이밍 공격 방지: 존재하지 않는 사용자도 동일한 시간 소요
      await verifyPassword(password, '$2b$12$dummy.hash.for.timing.attack');
      await recordLoginAttempt(email, false, ipAddress);
      await logLoginFailure(request, email, 'user_not_found');

      return NextResponse.json(
        new AppError(ErrorCode.INVALID_CREDENTIALS).toSafeResponse(),
        { status: 401 }
      );
    }

    // 5. 비밀번호 검증
    const isValid = await verifyPassword(password, user.passwordHash);

    if (!isValid) {
      await recordLoginAttempt(email, false, ipAddress);
      await logLoginFailure(request, email, 'invalid_password');

      return NextResponse.json(
        new AppError(ErrorCode.INVALID_CREDENTIALS).toSafeResponse(),
        {
          status: 401,
          headers: {
            'X-Remaining-Attempts': lockStatus.remainingAttempts.toString(),
          },
        }
      );
    }

    // 6. 이메일 인증 확인
    if (!user.emailVerified) {
      await logLoginFailure(request, email, 'email_not_verified');

      return NextResponse.json(
        new AppError(ErrorCode.EMAIL_NOT_VERIFIED).toSafeResponse(),
        { status: 403 }
      );
    }

    // 6.5. 삭제 예정 계정 확인 (유예 기간 처리)
    let accountReactivated = false;
    if (user.deleteScheduledAt) {
      const now = new Date();
      const scheduledDeletion = new Date(user.deleteScheduledAt);

      if (scheduledDeletion <= now) {
        // 유예 기간이 지난 경우 - 계정 삭제됨으로 처리
        await logLoginFailure(request, email, 'account_deleted');

        return NextResponse.json(
          new AppError(
            ErrorCode.ACCOUNT_DELETED,
            '계정이 삭제되었습니다. 새 계정을 만들어주세요.'
          ).toSafeResponse(),
          { status: 410 } // Gone
        );
      }

      // 유예 기간 내 로그인 - 자동 재활성화
      await db
        .update(users)
        .set({
          deleteScheduledAt: null,
          deleteReason: null,
          updatedAt: new Date(),
        })
        .where(eq(users.id, user.id));

      accountReactivated = true;
    }

    // 7. 2FA 검증 (활성화된 경우)
    if (user.totpEnabled && user.totpSecret) {
      // TOTP 코드가 제공되지 않은 경우 - 2FA 필요 응답
      if (!totpToken) {
        return NextResponse.json({
          success: false,
          totpRequired: true,
          message: '2단계 인증 코드를 입력해주세요.',
        });
      }

      // 백업 코드 사용
      if (useBackupCode && user.totpBackupCodes) {
        const backupCodes = user.totpBackupCodes as string[];
        const codeIndex = backupCodes.indexOf(totpToken);

        if (codeIndex === -1) {
          await logLoginFailure(request, email, 'invalid_backup_code');

          return NextResponse.json(
            { error: '유효하지 않은 백업 코드입니다.' },
            { status: 401 }
          );
        }

        // 사용된 백업 코드 제거
        const newBackupCodes = backupCodes.filter((_, i) => i !== codeIndex);
        await db
          .update(users)
          .set({ totpBackupCodes: newBackupCodes })
          .where(eq(users.id, user.id));
      } else {
        // TOTP 코드 검증
        const isValidTotp = verifyTotpToken(user.totpSecret, totpToken);

        if (!isValidTotp) {
          await logLoginFailure(request, email, 'invalid_totp');

          return NextResponse.json(
            { error: '유효하지 않은 인증 코드입니다.' },
            { status: 401 }
          );
        }
      }
    }

    // 8. 로그인 성공 처리
    await recordLoginAttempt(email, true, ipAddress);

    // 9. 세션 생성 (플랫폼 관리자 필드 포함)
    await createSession({
      userId: user.id,
      email: user.email,
      tenantId: user.tenantId || '',
      role: (user.role || 'user') as 'user' | 'admin' | 'internal_operator',
      adminRole: user.adminRole as 'SUPER_ADMIN' | 'ADMIN' | 'SUPPORT' | 'VIEWER' | undefined,
      isPlatformAdmin: user.isPlatformAdmin ?? undefined,
      mustChangePassword: user.mustChangePassword ?? undefined,
    });

    // 10. 접속기록 로깅
    await logLoginSuccess(request, user.id, user.tenantId || undefined);

    // 11. 비밀번호 변경 필요 여부 확인
    const passwordChangeRequired = isPasswordChangeRequired(user.passwordChangedAt);

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        tenantId: user.tenantId,
      },
      passwordChangeRequired,
      accountReactivated, // 삭제 예정이었던 계정이 재활성화된 경우 true
    });
  } catch (error) {
    console.error('[LOGIN ERROR]', error);
    return errorResponse(error);
  }
}
