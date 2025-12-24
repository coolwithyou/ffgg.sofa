/**
 * 임베드 코드 생성 API
 * POST: 임베드 코드 생성
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withTenantIsolation } from '@/lib/middleware/tenant';
import {
  generateEmbedScript,
  generateIframeEmbed,
  generateReactEmbed,
  validateWidgetConfig,
} from '@/lib/widget';
import { ErrorCode, AppError, handleApiError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { db, tenants } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { randomBytes } from 'crypto';

// 요청 스키마
const embedRequestSchema = z.object({
  type: z.enum(['script', 'iframe', 'react']).default('script'),
  config: z
    .object({
      position: z.enum(['bottom-right', 'bottom-left', 'top-right', 'top-left']).optional(),
      theme: z
        .object({
          primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
          backgroundColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
          textColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
          borderRadius: z.number().min(0).max(32).optional(),
          buttonSize: z.number().min(40).max(80).optional(),
        })
        .optional(),
      title: z.string().max(50).optional(),
      subtitle: z.string().max(100).optional(),
      placeholder: z.string().max(100).optional(),
      welcomeMessage: z.string().max(500).optional(),
    })
    .optional(),
  iframeOptions: z
    .object({
      width: z.string().optional(),
      height: z.string().optional(),
    })
    .optional(),
});

/**
 * POST /api/widget/embed - 임베드 코드 생성
 */
export async function POST(request: NextRequest) {
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

    const parseResult = embedRequestSchema.safeParse(body);
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

    const { type, config, iframeOptions } = parseResult.data;

    // 설정 검증
    if (config) {
      const validation = validateWidgetConfig(config);
      if (!validation.valid) {
        return NextResponse.json(
          new AppError(ErrorCode.VALIDATION_ERROR, '잘못된 위젯 설정입니다.', {
            errors: validation.errors,
          }).toSafeResponse(),
          { status: 400 }
        );
      }
    }

    // 테넌트의 위젯 API 키 조회 또는 생성
    const tenantData = await db.query.tenants.findFirst({
      where: eq(tenants.id, tenant.tenantId),
      columns: {
        settings: true,
      },
    });

    const settings = (tenantData?.settings as Record<string, unknown>) || {};
    let widgetApiKey = settings.widgetApiKey as string | undefined;

    // API 키가 없으면 생성
    if (!widgetApiKey) {
      widgetApiKey = `wk_${randomBytes(24).toString('base64url')}`;

      await db
        .update(tenants)
        .set({
          settings: {
            ...settings,
            widgetApiKey,
            widgetConfig: config,
          },
          updatedAt: new Date(),
        })
        .where(eq(tenants.id, tenant.tenantId));
    } else if (config) {
      // 설정 업데이트
      await db
        .update(tenants)
        .set({
          settings: {
            ...settings,
            widgetConfig: config,
          },
          updatedAt: new Date(),
        })
        .where(eq(tenants.id, tenant.tenantId));
    }

    // 임베드 코드 생성
    let embedCode: string;
    switch (type) {
      case 'iframe':
        embedCode = generateIframeEmbed(tenant.tenantId, widgetApiKey, iframeOptions);
        break;
      case 'react':
        embedCode = generateReactEmbed(tenant.tenantId, widgetApiKey);
        break;
      case 'script':
      default:
        embedCode = generateEmbedScript(tenant.tenantId, widgetApiKey, config);
        break;
    }

    logger.info('Widget embed code generated', {
      tenantId: tenant.tenantId,
      userId: session.userId,
      type,
    });

    return NextResponse.json({
      embedCode,
      apiKey: widgetApiKey,
      type,
    });
  } catch (error) {
    logger.error('Generate embed code failed', error as Error);
    return handleApiError(error);
  }
}
