/**
 * 기존 티어 → 새 티어 마이그레이션 스크립트
 *
 * 기존 구조:
 * - tenants.tier: 'basic' | 'standard' | 'premium'
 * - tier_budget_limits.tier: 'basic' | 'standard' | 'premium'
 *
 * 새 구조:
 * - tenants.tier: 'free' | 'pro' | 'business'
 * - plans.id: 'free' | 'pro' | 'business'
 * - subscriptions.planId: 'free' | 'pro' | 'business'
 *
 * 매핑:
 * - 'basic' → 'free'
 * - 'standard' → 'pro'
 * - 'premium' → 'business'
 * - null/undefined → 'free'
 *
 * 실행:
 *   pnpm exec dotenv -e .env.local -- pnpm tsx scripts/migrate-to-new-tiers.ts
 */

import { db } from '@/lib/db';
import { tenants, subscriptions, tenantPoints, pointTransactions, tierBudgetLimits } from '@/drizzle/schema';
import { eq, isNull, sql } from 'drizzle-orm';
import { FREE_TRIAL_POINTS, TIER_MONTHLY_POINTS, POINT_TRANSACTION_TYPES } from '@/lib/points/constants';

// 티어 매핑
const TIER_MAPPING: Record<string, string> = {
  basic: 'free',
  standard: 'pro',
  premium: 'business',
};

async function migrateTiers() {
  console.log('🔄 티어 마이그레이션 시작...\n');

  // 1. tenants.tier 업데이트
  console.log('1️⃣ tenants.tier 업데이트 중...');

  // 모든 테넌트 조회
  const allTenants = await db.select({
    id: tenants.id,
    tier: tenants.tier,
    name: tenants.name,
  }).from(tenants);

  let tenantsUpdated = 0;
  for (const tenant of allTenants) {
    const oldTier = tenant.tier || 'basic';
    const newTier = TIER_MAPPING[oldTier] || oldTier;

    // 이미 새 티어면 스킵
    if (['free', 'pro', 'business'].includes(oldTier)) {
      console.log(`  ⏭️ ${tenant.name}: 이미 새 티어 (${oldTier})`);
      continue;
    }

    await db.update(tenants)
      .set({ tier: newTier })
      .where(eq(tenants.id, tenant.id));

    console.log(`  ✅ ${tenant.name}: ${oldTier} → ${newTier}`);
    tenantsUpdated++;
  }
  console.log(`   → ${tenantsUpdated}개 테넌트 티어 업데이트 완료\n`);

  // 2. subscriptions.planId 업데이트
  console.log('2️⃣ subscriptions.planId 업데이트 중...');

  const allSubs = await db.select({
    id: subscriptions.id,
    planId: subscriptions.planId,
    tenantId: subscriptions.tenantId,
  }).from(subscriptions);

  let subsUpdated = 0;
  for (const sub of allSubs) {
    const oldPlan = sub.planId;
    const newPlan = TIER_MAPPING[oldPlan] || oldPlan;

    // 이미 새 플랜이면 스킵
    if (['free', 'pro', 'business'].includes(oldPlan)) {
      console.log(`  ⏭️ 구독 ${sub.id.slice(0, 8)}...: 이미 새 플랜 (${oldPlan})`);
      continue;
    }

    await db.update(subscriptions)
      .set({ planId: newPlan })
      .where(eq(subscriptions.id, sub.id));

    console.log(`  ✅ 구독 ${sub.id.slice(0, 8)}...: ${oldPlan} → ${newPlan}`);
    subsUpdated++;
  }
  console.log(`   → ${subsUpdated}개 구독 플랜 업데이트 완료\n`);

  // 3. tier_budget_limits 업데이트
  console.log('3️⃣ tier_budget_limits 업데이트 중...');

  const budgetLimits = await db.select().from(tierBudgetLimits);

  let budgetsUpdated = 0;
  for (const budget of budgetLimits) {
    const oldTier = budget.tier;
    const newTier = TIER_MAPPING[oldTier] || oldTier;

    // 이미 새 티어면 스킵
    if (['free', 'pro', 'business'].includes(oldTier)) {
      console.log(`  ⏭️ 예산 ${oldTier}: 이미 새 티어`);
      continue;
    }

    await db.update(tierBudgetLimits)
      .set({ tier: newTier })
      .where(eq(tierBudgetLimits.id, budget.id));

    console.log(`  ✅ 예산: ${oldTier} → ${newTier}`);
    budgetsUpdated++;
  }
  console.log(`   → ${budgetsUpdated}개 예산 티어 업데이트 완료\n`);

  // 4. tenant_points 초기화 (포인트가 없는 테넌트에게 체험 포인트 지급)
  console.log('4️⃣ 테넌트 포인트 초기화 중...');

  const tenantsWithPoints = await db.select({
    tenantId: tenantPoints.tenantId,
  }).from(tenantPoints);

  const tenantsWithPointsSet = new Set(tenantsWithPoints.map(t => t.tenantId));

  let pointsInitialized = 0;
  for (const tenant of allTenants) {
    // 이미 포인트 레코드가 있으면 스킵
    if (tenantsWithPointsSet.has(tenant.id)) {
      console.log(`  ⏭️ ${tenant.name}: 이미 포인트 레코드 존재`);
      continue;
    }

    // 테넌트의 현재 티어 확인
    const tenantData = await db.select({ tier: tenants.tier })
      .from(tenants)
      .where(eq(tenants.id, tenant.id))
      .limit(1);

    const tier = tenantData[0]?.tier || 'free';
    const monthlyPoints = TIER_MONTHLY_POINTS[tier as keyof typeof TIER_MONTHLY_POINTS] || 0;

    // Free 티어: 체험 포인트 500P
    // Pro/Business: 월간 포인트
    const initialPoints = tier === 'free' ? FREE_TRIAL_POINTS : monthlyPoints;
    const isFreePoints = tier === 'free';

    // tenant_points 레코드 생성
    await db.insert(tenantPoints).values({
      tenantId: tenant.id,
      balance: initialPoints,
      freePointsGranted: isFreePoints,
      monthlyPointsBase: isFreePoints ? 0 : monthlyPoints,
      lastRechargedAt: new Date(),
    });

    // 트랜잭션 기록
    await db.insert(pointTransactions).values({
      tenantId: tenant.id,
      type: isFreePoints ? POINT_TRANSACTION_TYPES.FREE_TRIAL : POINT_TRANSACTION_TYPES.SUBSCRIPTION_CHARGE,
      amount: initialPoints,
      balance: initialPoints,
      description: isFreePoints
        ? '체험 포인트 지급 (마이그레이션)'
        : `${tier} 플랜 월간 포인트 지급 (마이그레이션)`,
      metadata: { source: 'migration', tier },
    });

    console.log(`  ✅ ${tenant.name}: ${initialPoints}P 지급 (${tier})`);
    pointsInitialized++;
  }
  console.log(`   → ${pointsInitialized}개 테넌트 포인트 초기화 완료\n`);

  console.log('🎉 티어 마이그레이션 완료!\n');
  console.log('요약:');
  console.log(`  - 테넌트 티어 업데이트: ${tenantsUpdated}개`);
  console.log(`  - 구독 플랜 업데이트: ${subsUpdated}개`);
  console.log(`  - 예산 티어 업데이트: ${budgetsUpdated}개`);
  console.log(`  - 포인트 초기화: ${pointsInitialized}개`);
}

// 실행
migrateTiers()
  .then(() => {
    console.log('\n✅ 마이그레이션 스크립트 실행 완료');
    process.exit(0);
  })
  .catch((err) => {
    console.error('\n❌ 마이그레이션 실패:', err);
    process.exit(1);
  });
