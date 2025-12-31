/**
 * 빌링키 발급 준비 API
 * [Billing System] 프론트엔드에서 빌링키 발급 전 호출
 *
 * POST /api/billing/billing-key/prepare
 *
 * @returns PortOne 설정 정보 (storeId, channelKey, customer 정보)
 */

import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { tenants, users } from '@/drizzle/schema';
import { validateSession } from '@/lib/auth/session';
import { billingEnv } from '@/lib/config/billing-env';
import { generateBillingKeyRequestId } from '@/lib/billing/order-id';

export async function POST(request: NextRequest) {
  try {
    // 1. 세션 검증
    const session = await validateSession();
    if (!session) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 });
    }

    const { tenantId, userId, email } = session;

    // 2. 테넌트 정보 조회
    const [tenant] = await db
      .select({
        id: tenants.id,
        name: tenants.name,
        email: tenants.email,
      })
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1);

    if (!tenant) {
      return NextResponse.json({ error: '테넌트 정보를 찾을 수 없습니다' }, { status: 404 });
    }

    // 3. 사용자 정보 조회 (이름)
    const [user] = await db
      .select({
        name: users.name,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    // 4. 빌링키 발급 요청 ID 생성
    const billingKeyRequestId = generateBillingKeyRequestId();

    // 5. PortOne 설정 정보 반환
    return NextResponse.json({
      // PortOne 연동에 필요한 설정
      storeId: billingEnv.portone.storeId,
      channelKey: billingEnv.portone.channelKey,

      // 빌링키 발급 요청 ID
      billingKeyRequestId,

      // 고객 정보
      customer: {
        customerId: tenant.id, // 테넌트 ID를 고객 ID로 사용
        customerName: user?.name || tenant.name,
        customerEmail: email || tenant.email,
      },
    });
  } catch (error) {
    console.error('Billing key prepare error:', error);
    return NextResponse.json(
      { error: '빌링키 발급 준비 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
