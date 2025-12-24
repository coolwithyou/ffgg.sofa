/**
 * 로그아웃 API
 * POST /api/auth/logout
 */

import { NextRequest, NextResponse } from 'next/server';
import { destroySession, getCurrentUserId, getCurrentTenantId } from '@/lib/auth';
import { createAuditLogFromRequest, AuditAction, TargetType } from '@/lib/audit/logger';
import { errorResponse } from '@/lib/errors';

export async function POST(request: NextRequest) {
  try {
    const userId = await getCurrentUserId();
    const tenantId = await getCurrentTenantId();

    if (userId) {
      // 접속기록 로깅
      await createAuditLogFromRequest(request, {
        userId,
        tenantId: tenantId || undefined,
        action: AuditAction.LOGOUT,
        targetType: TargetType.SESSION,
        result: 'success',
      });
    }

    // 세션 삭제
    await destroySession();

    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error);
  }
}
