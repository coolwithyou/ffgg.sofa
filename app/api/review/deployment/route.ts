/**
 * 배포 상태 API
 * GET: 배포 상태 조회
 * POST: 자동 승인 적용
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withTenantIsolation } from '@/lib/middleware/tenant';
import { getDeploymentStatus, applyAutoApproval } from '@/lib/review';
import { ErrorCode, AppError, handleApiError } from '@/lib/errors';
import { logger } from '@/lib/logger';

// 자동 승인 요청 스키마
const autoApprovalSchema = z.object({
  documentId: z.string().uuid(),
  minQualityScore: z.number().min(0).max(100).default(85),
  enabled: z.boolean().default(true),
});

/**
 * GET /api/review/deployment - 배포 상태 조회
 */
export async function GET(request: NextRequest) {
  try {
    // 테넌트 격리 확인
    const isolation = await withTenantIsolation(request);
    if (!isolation.success) {
      return isolation.response;
    }

    const { tenant, session } = isolation;

    // 권한 확인
    if (session.role !== 'admin' && session.role !== 'internal_operator') {
      return NextResponse.json(
        new AppError(ErrorCode.FORBIDDEN, '관리자만 접근 가능합니다.').toSafeResponse(),
        { status: 403 }
      );
    }

    const documentId = request.nextUrl.searchParams.get('documentId') || undefined;

    // UUID 검증 (있는 경우)
    if (documentId) {
      const uuidResult = z.string().uuid().safeParse(documentId);
      if (!uuidResult.success) {
        return NextResponse.json(
          new AppError(ErrorCode.VALIDATION_ERROR, '유효하지 않은 문서 ID입니다.').toSafeResponse(),
          { status: 400 }
        );
      }
    }

    const status = await getDeploymentStatus(tenant.tenantId, documentId);

    return NextResponse.json({ status });
  } catch (error) {
    logger.error('Get deployment status failed', error as Error);
    return handleApiError(error);
  }
}

/**
 * POST /api/review/deployment - 자동 승인 적용
 */
export async function POST(request: NextRequest) {
  try {
    // 테넌트 격리 확인
    const isolation = await withTenantIsolation(request);
    if (!isolation.success) {
      return isolation.response;
    }

    const { tenant, session } = isolation;

    // 권한 확인
    if (session.role !== 'admin' && session.role !== 'internal_operator') {
      return NextResponse.json(
        new AppError(ErrorCode.FORBIDDEN, '관리자만 접근 가능합니다.').toSafeResponse(),
        { status: 403 }
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        new AppError(ErrorCode.VALIDATION_ERROR, '유효하지 않은 JSON 형식입니다.').toSafeResponse(),
        { status: 400 }
      );
    }

    const parseResult = autoApprovalSchema.safeParse(body);

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

    const { documentId, minQualityScore, enabled } = parseResult.data;

    const approvedCount = await applyAutoApproval(tenant.tenantId, documentId, {
      enabled,
      minQualityScore,
    });

    logger.info('Auto approval applied', {
      tenantId: tenant.tenantId,
      userId: session.userId,
      documentId,
      minQualityScore,
      approvedCount,
    });

    return NextResponse.json({
      success: true,
      approvedCount,
      minQualityScore,
    });
  } catch (error) {
    logger.error('Apply auto approval failed', error as Error);
    return handleApiError(error);
  }
}
