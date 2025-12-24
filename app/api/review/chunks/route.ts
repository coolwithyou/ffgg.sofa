/**
 * 청크 검토 API
 * GET: 청크 목록 조회
 * PATCH: 청크 일괄 업데이트
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withTenantIsolation } from '@/lib/middleware/tenant';
import { getChunkList, bulkUpdateChunks } from '@/lib/review';
import { ErrorCode, AppError, handleApiError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import type { ChunkListFilter, ChunkStatus } from '@/lib/review/types';

// 청크 목록 조회 스키마
const listQuerySchema = z.object({
  documentId: z.string().uuid().optional(),
  status: z
    .union([
      z.enum(['pending', 'approved', 'rejected', 'modified']),
      z.array(z.enum(['pending', 'approved', 'rejected', 'modified'])),
    ])
    .optional(),
  minQualityScore: z.coerce.number().min(0).max(100).optional(),
  maxQualityScore: z.coerce.number().min(0).max(100).optional(),
  search: z.string().max(200).optional(),
  sortBy: z.enum(['qualityScore', 'chunkIndex', 'createdAt', 'status']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

// 일괄 업데이트 스키마
const bulkUpdateSchema = z.object({
  chunkIds: z.array(z.string().uuid()).min(1).max(100),
  status: z.enum(['approved', 'rejected']),
});

/**
 * GET /api/review/chunks - 청크 목록 조회
 */
export async function GET(request: NextRequest) {
  try {
    // 테넌트 격리 확인
    const isolation = await withTenantIsolation(request);
    if (!isolation.success) {
      return isolation.response;
    }

    const { tenant, session } = isolation;

    // 권한 확인 (관리자만 접근 가능)
    if (session.role !== 'admin' && session.role !== 'internal_operator') {
      return NextResponse.json(
        new AppError(ErrorCode.FORBIDDEN, '관리자만 접근 가능합니다.').toSafeResponse(),
        { status: 403 }
      );
    }

    // 쿼리 파라미터 파싱
    const searchParams: Record<string, string | string[]> = Object.fromEntries(
      request.nextUrl.searchParams
    );

    // status 배열 처리
    const statusParam = request.nextUrl.searchParams.getAll('status');
    if (statusParam.length > 0) {
      searchParams.status = statusParam.length === 1 ? statusParam[0] : statusParam;
    }

    const parseResult = listQuerySchema.safeParse(searchParams);
    if (!parseResult.success) {
      return NextResponse.json(
        new AppError(ErrorCode.VALIDATION_ERROR, '잘못된 요청 파라미터입니다.', {
          errors: parseResult.error.issues.map((issue) => ({
            path: issue.path.map((p) => (typeof p === 'symbol' ? String(p) : p)).join('.'),
            message: issue.message,
          })),
        }).toSafeResponse(),
        { status: 400 }
      );
    }

    const filter: ChunkListFilter = {
      tenantId: tenant.tenantId,
      ...parseResult.data,
    };

    const result = await getChunkList(filter);

    logger.info('Chunk list retrieved', {
      tenantId: tenant.tenantId,
      userId: session.userId,
      total: result.total,
      page: result.page,
    });

    return NextResponse.json(result);
  } catch (error) {
    logger.error('Chunk list failed', error as Error);
    return handleApiError(error);
  }
}

/**
 * PATCH /api/review/chunks - 청크 일괄 업데이트
 */
export async function PATCH(request: NextRequest) {
  try {
    // 테넌트 격리 확인
    const isolation = await withTenantIsolation(request);
    if (!isolation.success) {
      return isolation.response;
    }

    const { tenant, session } = isolation;

    // 권한 확인 (관리자만 접근 가능)
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

    const parseResult = bulkUpdateSchema.safeParse(body);

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

    const result = await bulkUpdateChunks(tenant.tenantId, {
      chunkIds: parseResult.data.chunkIds,
      status: parseResult.data.status as ChunkStatus,
    });

    logger.info('Bulk chunk update', {
      tenantId: tenant.tenantId,
      userId: session.userId,
      status: parseResult.data.status,
      updated: result.updated,
      failed: result.failed,
    });

    return NextResponse.json(result);
  } catch (error) {
    logger.error('Bulk chunk update failed', error as Error);
    return handleApiError(error);
  }
}
