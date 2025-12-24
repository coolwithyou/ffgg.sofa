/**
 * 개별 청크 API
 * GET: 청크 상세 조회
 * PATCH: 청크 수정
 * DELETE: 청크 삭제 (논리적)
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withTenantIsolation } from '@/lib/middleware/tenant';
import {
  getChunk,
  updateChunk,
  deleteChunk,
  checkAndUpdateDocumentStatus,
} from '@/lib/review';
import { ErrorCode, AppError, handleApiError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import type { ChunkStatus } from '@/lib/review/types';

// UUID 스키마
const uuidSchema = z.string().uuid();

// 청크 수정 스키마
const updateSchema = z.object({
  content: z.string().min(1).max(10000).optional(),
  status: z.enum(['pending', 'approved', 'rejected', 'modified']).optional(),
  qualityScore: z.number().min(0).max(100).optional(),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/review/chunks/[id] - 청크 상세 조회
 */
export async function GET(request: NextRequest, context: RouteParams) {
  try {
    const { id } = await context.params;

    // UUID 검증
    const idResult = uuidSchema.safeParse(id);
    if (!idResult.success) {
      return NextResponse.json(
        new AppError(ErrorCode.VALIDATION_ERROR, '유효하지 않은 청크 ID입니다.').toSafeResponse(),
        { status: 400 }
      );
    }

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

    const chunk = await getChunk(tenant.tenantId, id);

    if (!chunk) {
      return NextResponse.json(
        new AppError(ErrorCode.NOT_FOUND, '청크를 찾을 수 없습니다.').toSafeResponse(),
        { status: 404 }
      );
    }

    return NextResponse.json({ chunk });
  } catch (error) {
    logger.error('Get chunk failed', error as Error);
    return handleApiError(error);
  }
}

/**
 * PATCH /api/review/chunks/[id] - 청크 수정
 */
export async function PATCH(request: NextRequest, context: RouteParams) {
  try {
    const { id } = await context.params;

    // UUID 검증
    const idResult = uuidSchema.safeParse(id);
    if (!idResult.success) {
      return NextResponse.json(
        new AppError(ErrorCode.VALIDATION_ERROR, '유효하지 않은 청크 ID입니다.').toSafeResponse(),
        { status: 400 }
      );
    }

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

    const parseResult = updateSchema.safeParse(body);

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

    // 기존 청크 조회 (문서 ID 확인용)
    const existingChunk = await getChunk(tenant.tenantId, id);
    if (!existingChunk) {
      return NextResponse.json(
        new AppError(ErrorCode.NOT_FOUND, '청크를 찾을 수 없습니다.').toSafeResponse(),
        { status: 404 }
      );
    }

    const updateData = {
      content: parseResult.data.content,
      status: parseResult.data.status as ChunkStatus | undefined,
      qualityScore: parseResult.data.qualityScore,
    };

    const chunk = await updateChunk(tenant.tenantId, id, updateData);

    if (!chunk) {
      return NextResponse.json(
        new AppError(ErrorCode.NOT_FOUND, '청크 업데이트에 실패했습니다.').toSafeResponse(),
        { status: 404 }
      );
    }

    // 상태가 approved로 변경된 경우 문서 상태 확인
    if (parseResult.data.status === 'approved') {
      await checkAndUpdateDocumentStatus(tenant.tenantId, existingChunk.documentId);
    }

    logger.info('Chunk updated', {
      tenantId: tenant.tenantId,
      userId: session.userId,
      chunkId: id,
      updates: Object.keys(parseResult.data),
    });

    return NextResponse.json({ chunk });
  } catch (error) {
    logger.error('Update chunk failed', error as Error);
    return handleApiError(error);
  }
}

/**
 * DELETE /api/review/chunks/[id] - 청크 삭제 (논리적)
 */
export async function DELETE(request: NextRequest, context: RouteParams) {
  try {
    const { id } = await context.params;

    // UUID 검증
    const idResult = uuidSchema.safeParse(id);
    if (!idResult.success) {
      return NextResponse.json(
        new AppError(ErrorCode.VALIDATION_ERROR, '유효하지 않은 청크 ID입니다.').toSafeResponse(),
        { status: 400 }
      );
    }

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

    const success = await deleteChunk(tenant.tenantId, id);

    if (!success) {
      return NextResponse.json(
        new AppError(ErrorCode.NOT_FOUND, '청크를 찾을 수 없습니다.').toSafeResponse(),
        { status: 404 }
      );
    }

    logger.info('Chunk deleted', {
      tenantId: tenant.tenantId,
      userId: session.userId,
      chunkId: id,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Delete chunk failed', error as Error);
    return handleApiError(error);
  }
}
