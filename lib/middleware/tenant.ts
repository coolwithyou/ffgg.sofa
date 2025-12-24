/**
 * 테넌트 격리 미들웨어
 * [C-007] API 레벨 tenant_id 검증
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateSession, SessionData } from '@/lib/auth';
import { db, tenants } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { ErrorCode, AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';

export interface TenantContext {
  tenantId: string;
  tier: 'basic' | 'standard' | 'premium';
  status: 'active' | 'inactive' | 'suspended';
  usageLimits: Record<string, number>;
}

/**
 * 테넌트 정보 조회
 */
export async function getTenantContext(
  tenantId: string
): Promise<TenantContext | null> {
  try {
    const tenant = await db.query.tenants.findFirst({
      where: eq(tenants.id, tenantId),
      columns: {
        id: true,
        tier: true,
        status: true,
        usageLimits: true,
      },
    });

    if (!tenant) {
      return null;
    }

    return {
      tenantId: tenant.id,
      tier: (tenant.tier || 'basic') as 'basic' | 'standard' | 'premium',
      status: (tenant.status || 'active') as 'active' | 'inactive' | 'suspended',
      usageLimits: (tenant.usageLimits || {}) as Record<string, number>,
    };
  } catch (error) {
    logger.error('Failed to get tenant context', error as Error, { tenantId });
    return null;
  }
}

/**
 * 요청의 테넌트 ID와 세션의 테넌트 ID 일치 확인
 */
export function validateTenantAccess(
  session: SessionData,
  requestedTenantId: string
): boolean {
  // internal_operator는 모든 테넌트 접근 가능
  if (session.role === 'internal_operator') {
    return true;
  }

  // 일반 사용자/관리자는 자신의 테넌트만 접근 가능
  return session.tenantId === requestedTenantId;
}

/**
 * 테넌트 상태 확인
 */
export function isTenantActive(context: TenantContext): boolean {
  return context.status === 'active';
}

/**
 * 테넌트 격리 미들웨어
 * API Route에서 사용
 */
export async function withTenantIsolation(
  request: NextRequest,
  requiredTenantId?: string
): Promise<
  | { success: true; session: SessionData; tenant: TenantContext }
  | { success: false; response: NextResponse }
> {
  // 1. 세션 검증
  const session = await validateSession();

  if (!session) {
    return {
      success: false,
      response: NextResponse.json(
        new AppError(ErrorCode.UNAUTHORIZED).toSafeResponse(),
        { status: 401 }
      ),
    };
  }

  // 2. 요청된 테넌트 ID 결정
  const tenantId =
    requiredTenantId ||
    request.headers.get('x-tenant-id') ||
    session.tenantId;

  if (!tenantId) {
    return {
      success: false,
      response: NextResponse.json(
        new AppError(ErrorCode.VALIDATION_ERROR, '테넌트 ID가 필요합니다.').toSafeResponse(),
        { status: 400 }
      ),
    };
  }

  // 3. 테넌트 접근 권한 확인
  if (!validateTenantAccess(session, tenantId)) {
    logger.warn('Tenant access denied', {
      userId: session.userId,
      sessionTenantId: session.tenantId,
      requestedTenantId: tenantId,
    });

    return {
      success: false,
      response: NextResponse.json(
        new AppError(ErrorCode.TENANT_MISMATCH).toSafeResponse(),
        { status: 403 }
      ),
    };
  }

  // 4. 테넌트 컨텍스트 조회
  const tenant = await getTenantContext(tenantId);

  if (!tenant) {
    return {
      success: false,
      response: NextResponse.json(
        new AppError(ErrorCode.NOT_FOUND, '테넌트를 찾을 수 없습니다.').toSafeResponse(),
        { status: 404 }
      ),
    };
  }

  // 5. 테넌트 상태 확인
  if (!isTenantActive(tenant)) {
    return {
      success: false,
      response: NextResponse.json(
        new AppError(ErrorCode.FORBIDDEN, '비활성화된 테넌트입니다.').toSafeResponse(),
        { status: 403 }
      ),
    };
  }

  return { success: true, session, tenant };
}

/**
 * 데이터 접근 시 테넌트 ID 필터 강제
 * DB 쿼리에서 사용
 */
export function enforceTenantFilter<T extends { tenantId: string }>(
  data: T[],
  tenantId: string
): T[] {
  return data.filter((item) => item.tenantId === tenantId);
}

/**
 * 단일 레코드 테넌트 검증
 */
export function validateRecordTenant<T extends { tenantId: string }>(
  record: T | null,
  tenantId: string
): T | null {
  if (!record) return null;
  if (record.tenantId !== tenantId) {
    logger.warn('Record tenant mismatch', {
      recordTenantId: record.tenantId,
      expectedTenantId: tenantId,
    });
    return null;
  }
  return record;
}

/**
 * API 핸들러 래퍼 (테넌트 격리 적용)
 */
export function withTenant<T extends NextResponse>(
  handler: (
    request: NextRequest,
    context: { session: SessionData; tenant: TenantContext }
  ) => Promise<T>
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    const result = await withTenantIsolation(request);

    if (!result.success) {
      return result.response;
    }

    try {
      return await handler(request, {
        session: result.session,
        tenant: result.tenant,
      });
    } catch {
      return NextResponse.json(
        { error: { code: 'INTERNAL_ERROR', message: '서버 오류가 발생했습니다.' } },
        { status: 500 }
      );
    }
  };
}
