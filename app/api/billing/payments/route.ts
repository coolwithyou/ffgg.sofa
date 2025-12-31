/**
 * 결제 내역 조회 API
 * [Billing System] 테넌트의 결제 내역 조회 (페이지네이션 지원)
 *
 * GET /api/billing/payments?page=1&limit=10
 *
 * @returns 결제 내역 목록 및 페이지네이션 정보
 */

import { NextRequest, NextResponse } from 'next/server';
import { eq, desc, count } from 'drizzle-orm';
import { db } from '@/lib/db';
import { payments } from '@/drizzle/schema';
import { validateSession } from '@/lib/auth/session';

export async function GET(request: NextRequest) {
  try {
    // 1. 세션 검증
    const session = await validateSession();
    if (!session) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 });
    }

    const { tenantId } = session;

    // 2. URL 파라미터 파싱
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '10', 10)));
    const offset = (page - 1) * limit;

    // 3. 전체 개수 조회
    const [{ total }] = await db
      .select({ total: count() })
      .from(payments)
      .where(eq(payments.tenantId, tenantId));

    // 4. 결제 내역 조회
    const paymentList = await db
      .select({
        id: payments.id,
        paymentId: payments.paymentId,
        amount: payments.amount,
        currency: payments.currency,
        status: payments.status,
        payMethod: payments.payMethod,
        cardInfo: payments.cardInfo,
        receiptUrl: payments.receiptUrl,
        paidAt: payments.paidAt,
        createdAt: payments.createdAt,
      })
      .from(payments)
      .where(eq(payments.tenantId, tenantId))
      .orderBy(desc(payments.createdAt))
      .limit(limit)
      .offset(offset);

    // 5. 응답 반환
    return NextResponse.json({
      payments: paymentList,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Payments fetch error:', error);
    return NextResponse.json(
      { error: '결제 내역 조회 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
