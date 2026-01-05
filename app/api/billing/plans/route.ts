/**
 * 플랜 조회 API
 * [Billing System] 사용 가능한 결제 플랜 목록 반환
 *
 * GET /api/billing/plans
 *
 * @returns 활성 플랜 목록
 */

import { NextRequest, NextResponse } from 'next/server';
import { eq, asc } from 'drizzle-orm';
import { db } from '@/lib/db';
import { plans } from '@/drizzle/schema';

export async function GET(request: NextRequest) {
  try {
    // 활성 플랜만 정렬하여 조회
    const planList = await db
      .select({
        id: plans.id,
        name: plans.name,
        nameKo: plans.nameKo,
        description: plans.description,
        monthlyPrice: plans.monthlyPrice,
        yearlyPrice: plans.yearlyPrice,
        featureList: plans.featureList,
        features: plans.features,
        limits: plans.limits,
        sortOrder: plans.sortOrder,
      })
      .from(plans)
      .where(eq(plans.isActive, true))
      .orderBy(asc(plans.sortOrder));

    // 프론트엔드 호환성을 위해 featureList를 features로 매핑
    const formattedPlans = planList.map((plan) => ({
      ...plan,
      features: plan.featureList || [], // UI에서 사용하는 string[] 형태
      featureFlags: plan.features, // 기능 플래그 객체 (필요시 사용)
    }));

    return NextResponse.json({ plans: formattedPlans });
  } catch (error) {
    console.error('Plans fetch error:', error);
    return NextResponse.json(
      { error: '플랜 목록 조회 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
