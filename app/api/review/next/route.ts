/**
 * 다음 검토 대기 청크 API
 * GET: 다음 검토할 청크 조회
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withTenantIsolation } from '@/lib/middleware/tenant';
import { getNextPendingChunk } from '@/lib/review';
import { ErrorCode, AppError, handleApiError } from '@/lib/errors';
import { logger } from '@/lib/logger';

// 쿼리 파라미터 스키마
const querySchema = z.object({
  currentChunkId: z.string().uuid().optional(),
  documentId: z.string().uuid().optional(),
});

/**
 * GET /api/review/next - 다음 검토 대기 청크 조회
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

    const searchParams = Object.fromEntries(request.nextUrl.searchParams);
    const parseResult = querySchema.safeParse(searchParams);

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

    const { currentChunkId, documentId } = parseResult.data;

    const chunk = await getNextPendingChunk(tenant.tenantId, currentChunkId, documentId);

    if (!chunk) {
      return NextResponse.json({
        chunk: null,
        message: '검토 대기 중인 청크가 없습니다.',
      });
    }

    logger.info('Next pending chunk retrieved', {
      tenantId: tenant.tenantId,
      userId: session.userId,
      chunkId: chunk.id,
    });

    return NextResponse.json({ chunk });
  } catch (error) {
    logger.error('Get next pending chunk failed', error as Error);
    return handleApiError(error);
  }
}
