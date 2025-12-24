/**
 * 카카오 연동 설정 API
 * [Week 8] 카카오톡 연동 설정 관리
 *
 * GET /api/kakao/config - 카카오 설정 조회
 * PATCH /api/kakao/config - 카카오 설정 업데이트
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withTenantIsolation } from '@/lib/middleware/tenant';
import { updateTenantKakaoSettings, generateSkillUrl } from '@/lib/kakao';
import { ErrorCode, AppError, handleApiError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { db, tenants } from '@/lib/db';
import { eq } from 'drizzle-orm';

// 설정 업데이트 스키마
const configUpdateSchema = z.object({
  botId: z.string().min(1).max(100).optional(),
  maxResponseLength: z.number().min(50).max(1000).optional(),
  welcomeMessage: z.string().max(500).optional(),
});

/**
 * GET /api/kakao/config - 카카오 설정 조회
 */
export async function GET(request: NextRequest) {
  try {
    // 테넌트 격리 확인
    const isolation = await withTenantIsolation(request);
    if (!isolation.success) {
      return isolation.response;
    }

    const { tenant, session } = isolation;

    // 관리자 권한 확인
    if (session.role !== 'admin' && session.role !== 'internal_operator') {
      return NextResponse.json(
        new AppError(ErrorCode.FORBIDDEN, '관리자만 접근 가능합니다.').toSafeResponse(),
        { status: 403 }
      );
    }

    // 테넌트 설정 조회
    const tenantData = await db.query.tenants.findFirst({
      where: eq(tenants.id, tenant.tenantId),
      columns: {
        settings: true,
      },
    });

    const settings = (tenantData?.settings as Record<string, unknown>) || {};

    // 스킬 URL 생성
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.example.com';
    const skillUrl = generateSkillUrl(baseUrl);

    return NextResponse.json({
      config: {
        botId: settings.kakaoBotId || null,
        maxResponseLength: settings.kakaoMaxResponseLength || 300,
        welcomeMessage: settings.kakaoWelcomeMessage || null,
      },
      skillUrl,
      isConnected: !!settings.kakaoBotId,
    });
  } catch (error) {
    logger.error('Get kakao config failed', error as Error);
    return handleApiError(error);
  }
}

/**
 * PATCH /api/kakao/config - 카카오 설정 업데이트
 */
export async function PATCH(request: NextRequest) {
  try {
    // 테넌트 격리 확인
    const isolation = await withTenantIsolation(request);
    if (!isolation.success) {
      return isolation.response;
    }

    const { tenant, session } = isolation;

    // 관리자 권한 확인
    if (session.role !== 'admin' && session.role !== 'internal_operator') {
      return NextResponse.json(
        new AppError(ErrorCode.FORBIDDEN, '관리자만 접근 가능합니다.').toSafeResponse(),
        { status: 403 }
      );
    }

    // 요청 파싱
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        new AppError(ErrorCode.VALIDATION_ERROR, '유효하지 않은 JSON 형식입니다.').toSafeResponse(),
        { status: 400 }
      );
    }

    const parseResult = configUpdateSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        new AppError(ErrorCode.VALIDATION_ERROR, '잘못된 요청 데이터입니다.', {
          errors: parseResult.error.issues.map((issue) => ({
            path: issue.path.map((p) => (typeof p === 'symbol' ? String(p) : p)).join('.'),
            message: issue.message,
          })),
        }).toSafeResponse(),
        { status: 400 }
      );
    }

    // 설정 업데이트
    const success = await updateTenantKakaoSettings(tenant.tenantId, parseResult.data);

    if (!success) {
      return NextResponse.json(
        new AppError(ErrorCode.INTERNAL_ERROR, '설정 업데이트에 실패했습니다.').toSafeResponse(),
        { status: 500 }
      );
    }

    logger.info('Kakao config updated', {
      tenantId: tenant.tenantId,
      userId: session.userId,
      updates: Object.keys(parseResult.data),
    });

    return NextResponse.json({
      success: true,
      message: '카카오 설정이 업데이트되었습니다.',
    });
  } catch (error) {
    logger.error('Update kakao config failed', error as Error);
    return handleApiError(error);
  }
}
