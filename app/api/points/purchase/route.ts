/**
 * 포인트 구매 API
 *
 * POST /api/points/purchase (prepare) - 결제 준비
 * PATCH /api/points/purchase (complete) - 결제 완료 처리
 *
 * 프론트엔드 → prepare → PortOne SDK 결제 → complete → 포인트 충전
 */

import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { tenants, users, pointPurchases } from '@/drizzle/schema';
import { validateSession } from '@/lib/auth/session';
import { billingEnv } from '@/lib/config/billing-env';
import { generatePointPurchaseId } from '@/lib/billing/order-id';
import { POINT_PACKAGES, chargePoints, POINT_TRANSACTION_TYPES } from '@/lib/points';
import { getPayment } from '@/lib/portone/client';

/**
 * POST: 포인트 구매 준비
 *
 * 프론트엔드에서 PortOne SDK 결제창 호출 전 호출
 */
export async function POST(request: NextRequest) {
  try {
    // 1. 세션 검증
    const session = await validateSession();
    if (!session) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 });
    }

    const { tenantId, userId, email } = session;

    // 2. 패키지 ID 검증
    const body = await request.json();
    const { packageId } = body;

    if (!packageId) {
      return NextResponse.json({ error: '패키지 ID가 필요합니다' }, { status: 400 });
    }

    const selectedPackage = POINT_PACKAGES.find((pkg) => pkg.id === packageId);
    if (!selectedPackage) {
      return NextResponse.json({ error: '유효하지 않은 패키지입니다' }, { status: 400 });
    }

    // 3. 테넌트 정보 조회
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

    // 4. 사용자 정보 조회
    const [user] = await db
      .select({ name: users.name })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    // 5. 결제 ID 생성
    const paymentId = generatePointPurchaseId();

    // 6. 구매 레코드 생성 (pending 상태)
    await db.insert(pointPurchases).values({
      id: paymentId,
      tenantId,
      userId,
      packageId: selectedPackage.id,
      points: selectedPackage.points,
      amount: selectedPackage.price,
      currency: 'KRW',
      status: 'pending',
    });

    // 7. PortOne 설정 반환
    return NextResponse.json({
      paymentId,
      storeId: billingEnv.portone.storeId,
      channelKey: billingEnv.portone.channelKey,
      orderName: `SOFA 포인트 ${selectedPackage.name}`,
      totalAmount: selectedPackage.price,
      currency: 'KRW',
      payMethod: 'CARD',
      customer: {
        customerId: tenant.id,
        fullName: user?.name || tenant.name,
        email: email || tenant.email,
      },
      customData: JSON.stringify({
        type: 'point_purchase',
        packageId: selectedPackage.id,
        points: selectedPackage.points,
        tenantId,
      }),
    });
  } catch (error) {
    console.error('Point purchase prepare error:', error);
    return NextResponse.json(
      { error: '포인트 구매 준비 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}

/**
 * PATCH: 포인트 구매 완료 처리
 *
 * 프론트엔드에서 PortOne 결제 완료 후 호출
 */
export async function PATCH(request: NextRequest) {
  try {
    // 1. 세션 검증
    const session = await validateSession();
    if (!session) {
      return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 });
    }

    const { tenantId } = session;

    // 2. paymentId 검증
    const body = await request.json();
    const { paymentId } = body;

    if (!paymentId) {
      return NextResponse.json({ error: '결제 ID가 필요합니다' }, { status: 400 });
    }

    // 3. 구매 레코드 조회 및 소유권 검증
    const [purchase] = await db
      .select()
      .from(pointPurchases)
      .where(eq(pointPurchases.id, paymentId))
      .limit(1);

    if (!purchase) {
      return NextResponse.json({ error: '결제 정보를 찾을 수 없습니다' }, { status: 404 });
    }

    if (purchase.tenantId !== tenantId) {
      return NextResponse.json({ error: '권한이 없습니다' }, { status: 403 });
    }

    if (purchase.status === 'completed') {
      return NextResponse.json({
        message: '이미 처리된 결제입니다',
        points: purchase.points,
      });
    }

    // 4. PortOne API로 결제 상태 확인
    let payment;

    try {
      payment = await getPayment(paymentId);
    } catch (error) {
      console.error('PortOne getPayment error:', error);
      return NextResponse.json({ error: '결제 정보 조회에 실패했습니다' }, { status: 400 });
    }

    // 5. 결제 상태 검증
    if (payment.status !== 'PAID') {
      // 실패한 결제 상태 업데이트
      await db
        .update(pointPurchases)
        .set({
          status: 'failed',
          portonePaymentId: paymentId, // 요청한 paymentId 사용
          updatedAt: new Date(),
        })
        .where(eq(pointPurchases.id, paymentId));

      return NextResponse.json(
        { error: '결제가 완료되지 않았습니다', status: payment.status },
        { status: 400 }
      );
    }

    // 6. 결제 금액 검증
    if (payment.amount?.total !== purchase.amount) {
      await db
        .update(pointPurchases)
        .set({
          status: 'failed',
          portonePaymentId: paymentId, // 요청한 paymentId 사용
          updatedAt: new Date(),
        })
        .where(eq(pointPurchases.id, paymentId));

      return NextResponse.json({ error: '결제 금액이 일치하지 않습니다' }, { status: 400 });
    }

    // 7. 포인트 충전
    const { newBalance, transactionId } = await chargePoints({
      tenantId,
      amount: purchase.points,
      type: POINT_TRANSACTION_TYPES.PURCHASE,
      description: `포인트 추가 구매 (${purchase.points}P)`,
      metadata: {
        paymentId,
        packageId: purchase.packageId,
      },
    });

    // 8. 구매 레코드 완료 처리
    await db
      .update(pointPurchases)
      .set({
        status: 'completed',
        portonePaymentId: paymentId, // 요청한 paymentId 사용
        transactionId,
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(pointPurchases.id, paymentId));

    return NextResponse.json({
      success: true,
      points: purchase.points,
      newBalance,
      transactionId,
    });
  } catch (error) {
    console.error('Point purchase complete error:', error);
    return NextResponse.json(
      { error: '포인트 충전 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
