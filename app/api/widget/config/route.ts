/**
 * 위젯 설정 API
 * GET: 현재 설정 조회
 * PATCH: 설정 업데이트
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withTenantIsolation } from '@/lib/middleware/tenant';
import { validateWidgetConfig, DEFAULT_CONFIG, DEFAULT_THEME } from '@/lib/widget';
import { ErrorCode, AppError, handleApiError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { db, tenants } from '@/lib/db';
import { eq } from 'drizzle-orm';

// 설정 업데이트 스키마
const configUpdateSchema = z.object({
  position: z.enum(['bottom-right', 'bottom-left', 'top-right', 'top-left']).optional(),
  theme: z
    .object({
      primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
      backgroundColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
      textColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
      fontFamily: z.string().max(100).optional(),
      borderRadius: z.number().min(0).max(32).optional(),
      buttonSize: z.number().min(40).max(80).optional(),
    })
    .optional(),
  title: z.string().max(50).optional(),
  subtitle: z.string().max(100).optional(),
  placeholder: z.string().max(100).optional(),
  welcomeMessage: z.string().max(500).optional(),
  buttonIcon: z.enum(['chat', 'question', 'support']).optional(),
});

/**
 * GET /api/widget/config - 현재 설정 조회
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
    const widgetConfig = (settings.widgetConfig as Record<string, unknown>) || {};
    const widgetTheme = (widgetConfig.theme as Record<string, unknown>) || {};
    const hasApiKey = !!settings.widgetApiKey;

    return NextResponse.json({
      config: {
        ...DEFAULT_CONFIG,
        ...widgetConfig,
        theme: { ...DEFAULT_THEME, ...widgetTheme },
      },
      hasApiKey,
    });
  } catch (error) {
    logger.error('Get widget config failed', error as Error);
    return handleApiError(error);
  }
}

/**
 * PATCH /api/widget/config - 설정 업데이트
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

    // 설정 검증
    const validation = validateWidgetConfig(parseResult.data);
    if (!validation.valid) {
      return NextResponse.json(
        new AppError(ErrorCode.VALIDATION_ERROR, '잘못된 위젯 설정입니다.', {
          errors: validation.errors,
        }).toSafeResponse(),
        { status: 400 }
      );
    }

    // 기존 설정 조회
    const tenantData = await db.query.tenants.findFirst({
      where: eq(tenants.id, tenant.tenantId),
      columns: {
        settings: true,
      },
    });

    const settings = (tenantData?.settings as Record<string, unknown>) || {};
    const existingConfig = (settings.widgetConfig as Record<string, unknown>) || {};

    // 설정 병합
    const updatedConfig = {
      ...existingConfig,
      ...parseResult.data,
      theme: {
        ...(existingConfig.theme as Record<string, unknown> || {}),
        ...parseResult.data.theme,
      },
    };

    // 설정 저장
    await db
      .update(tenants)
      .set({
        settings: {
          ...settings,
          widgetConfig: updatedConfig,
        },
        updatedAt: new Date(),
      })
      .where(eq(tenants.id, tenant.tenantId));

    logger.info('Widget config updated', {
      tenantId: tenant.tenantId,
      userId: session.userId,
      updates: Object.keys(parseResult.data),
    });

    return NextResponse.json({
      config: updatedConfig,
      success: true,
    });
  } catch (error) {
    logger.error('Update widget config failed', error as Error);
    return handleApiError(error);
  }
}
