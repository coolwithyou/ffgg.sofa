/**
 * 대화 히스토리 API
 * GET /api/chat/history?sessionId=xxx - 대화 히스토리 조회
 * DELETE /api/chat/history?sessionId=xxx - 대화 삭제
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getConversationHistory, deleteConversation } from '@/lib/chat';
import { validateTenantAccessSimple } from '@/lib/middleware/tenant';
import { ErrorCode, AppError, handleApiError } from '@/lib/errors';

// UUID 검증 스키마
const sessionIdSchema = z.string().uuid();

// limit 범위 제한 (1~100)
function validateLimit(value: string | null): number {
  const parsed = parseInt(value || '20', 10);
  return Math.min(Math.max(parsed || 20, 1), 100);
}

/**
 * GET - 대화 히스토리 조회
 */
export async function GET(request: NextRequest) {
  try {
    // 1. 테넌트 검증
    const tenantValidation = await validateTenantAccessSimple(request);
    if (!tenantValidation.valid) {
      return NextResponse.json({ error: tenantValidation.error }, { status: 401 });
    }

    const tenantId = tenantValidation.tenantId;
    if (!tenantId) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, '테넌트 ID가 필요합니다');
    }

    // 2. 쿼리 파라미터 파싱 및 검증
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');
    const limit = validateLimit(searchParams.get('limit'));

    if (!sessionId) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, '세션 ID가 필요합니다');
    }

    // UUID 형식 검증
    const sessionIdResult = sessionIdSchema.safeParse(sessionId);
    if (!sessionIdResult.success) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, '유효하지 않은 세션 ID 형식입니다');
    }

    // 3. 히스토리 조회
    const messages = await getConversationHistory(tenantId, sessionIdResult.data, limit);

    return NextResponse.json({
      sessionId,
      messages,
      count: messages.length,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * DELETE - 대화 삭제
 */
export async function DELETE(request: NextRequest) {
  try {
    // 1. 테넌트 검증
    const tenantValidation = await validateTenantAccessSimple(request);
    if (!tenantValidation.valid) {
      return NextResponse.json({ error: tenantValidation.error }, { status: 401 });
    }

    const tenantId = tenantValidation.tenantId;
    if (!tenantId) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, '테넌트 ID가 필요합니다');
    }

    // 2. 쿼리 파라미터 파싱 및 검증
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, '세션 ID가 필요합니다');
    }

    // UUID 형식 검증
    const sessionIdResult = sessionIdSchema.safeParse(sessionId);
    if (!sessionIdResult.success) {
      throw new AppError(ErrorCode.VALIDATION_ERROR, '유효하지 않은 세션 ID 형식입니다');
    }

    // 3. 대화 삭제
    const deleted = await deleteConversation(tenantId, sessionIdResult.data);

    if (!deleted) {
      throw new AppError(ErrorCode.NOT_FOUND, '대화를 찾을 수 없습니다');
    }

    return NextResponse.json({
      success: true,
      message: '대화가 삭제되었습니다',
    });
  } catch (error) {
    return handleApiError(error);
  }
}
