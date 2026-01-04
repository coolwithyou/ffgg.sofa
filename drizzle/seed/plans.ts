/**
 * 플랜 시드 데이터
 * [Billing System] 기본 플랜 정의
 *
 * 플랜 구조 (v2):
 * - free: 무료 플랜 (체험 포인트 500P, 배포 불가)
 * - pro: 프로 플랜 (월 ₩50,000, 3,000P/월, 배포 1개)
 * - business: 비즈니스 플랜 (월 ₩150,000, 10,000P/월, 배포 3개)
 *
 * 사용법:
 *   pnpm tsx drizzle/seed/plans.ts
 */

import { db } from '@/lib/db';
import { plans, type NewPlan, type PlanLimits, type PlanFeatures } from '../schema';
import { PLAN_PRICES } from '@/lib/billing/constants';
import { TIER_LIMITS, TIER_FEATURES } from '@/lib/tier/constants';

/**
 * 티어 제한을 PlanLimits 인터페이스로 변환
 */
function tierLimitsToPlanLimits(tier: keyof typeof TIER_LIMITS): PlanLimits {
  const limits = TIER_LIMITS[tier];
  return {
    maxChatbots: limits.maxChatbots,
    maxDatasets: limits.maxDatasets,
    maxDocumentsPerDataset: limits.maxDocumentsPerDataset,
    maxTotalDocuments: limits.maxTotalDocuments,
    maxStorageBytes: limits.maxStorageBytes,
    maxPublishHistory: limits.maxPublishHistory,
    maxDeployments: limits.maxDeployments,
    monthlyPoints: limits.monthlyPoints,
    maxMonthlyConversations: limits.maxMonthlyConversations,
  };
}

/**
 * 티어 기능을 PlanFeatures 인터페이스로 변환
 */
function tierFeaturesToPlanFeatures(tier: keyof typeof TIER_FEATURES): PlanFeatures {
  const features = TIER_FEATURES[tier];
  return {
    canDeploy: features.canDeploy,
    customDomain: features.customDomain,
    apiAccess: features.apiAccess,
    prioritySupport: features.prioritySupport,
    advancedAnalytics: features.advancedAnalytics,
  };
}

export const plansSeed: NewPlan[] = [
  {
    id: 'free',
    name: 'Free',
    nameKo: '무료',
    description: '서비스를 체험해보세요. 체험 포인트 500P가 제공됩니다.',
    monthlyPrice: PLAN_PRICES.free.monthly,
    yearlyPrice: PLAN_PRICES.free.yearly,
    featureList: [
      '체험 포인트 500P (1회성)',
      '챗봇 3개',
      '데이터셋 3개 (챗봇당 1개)',
      '문서 총 30개 (챗봇당 10개)',
      '저장공간 100MB',
      '버전 이력 1개',
      '배포 불가 (미리보기만)',
    ],
    limits: tierLimitsToPlanLimits('free'),
    features: tierFeaturesToPlanFeatures('free'),
    isActive: true,
    sortOrder: 0,
  },
  {
    id: 'pro',
    name: 'Pro',
    nameKo: '프로',
    description: '성장하는 비즈니스를 위한 플랜. 월 3,000P로 약 300회 AI 응답.',
    monthlyPrice: PLAN_PRICES.pro.monthly,
    yearlyPrice: PLAN_PRICES.pro.yearly,
    featureList: [
      '월 3,000 포인트 (AI 응답 ~300회)',
      '챗봇 3개',
      '데이터셋 3개 (챗봇당 1개)',
      '문서 총 100개',
      '저장공간 1GB',
      '버전 이력 10개',
      '배포 1개',
      '이메일 지원',
    ],
    limits: tierLimitsToPlanLimits('pro'),
    features: tierFeaturesToPlanFeatures('pro'),
    isActive: true,
    sortOrder: 1,
  },
  {
    id: 'business',
    name: 'Business',
    nameKo: '비즈니스',
    description: '대규모 비즈니스를 위한 전문가 플랜. 월 10,000P로 약 1,000회 AI 응답.',
    monthlyPrice: PLAN_PRICES.business.monthly,
    yearlyPrice: PLAN_PRICES.business.yearly,
    featureList: [
      '월 10,000 포인트 (AI 응답 ~1,000회)',
      '챗봇 10개',
      '데이터셋 10개 (챗봇당 1개)',
      '문서 총 500개',
      '저장공간 10GB',
      '버전 이력 30개',
      '배포 3개',
      '커스텀 도메인',
      'API 액세스',
      '슬랙/카톡 우선 지원',
      '고급 분석',
    ],
    limits: tierLimitsToPlanLimits('business'),
    features: tierFeaturesToPlanFeatures('business'),
    isActive: true,
    sortOrder: 2,
  },
];

/**
 * 플랜 시드 실행
 * - 기존 플랜이 있으면 업데이트 (upsert)
 * - 새 플랜이면 추가
 */
export async function seedPlans() {
  console.log('📦 플랜 시드 데이터 삽입 시작...');

  for (const plan of plansSeed) {
    await db
      .insert(plans)
      .values(plan)
      .onConflictDoUpdate({
        target: plans.id,
        set: {
          name: plan.name,
          nameKo: plan.nameKo,
          description: plan.description,
          monthlyPrice: plan.monthlyPrice,
          yearlyPrice: plan.yearlyPrice,
          featureList: plan.featureList,
          limits: plan.limits,
          features: plan.features,
          isActive: plan.isActive,
          sortOrder: plan.sortOrder,
          updatedAt: new Date(),
        },
      });

    console.log(`  ✅ ${plan.nameKo} (${plan.id}) 플랜 생성/업데이트 완료`);
  }

  console.log('✨ 플랜 시드 완료!');
}

// 직접 실행 시
const isMainModule = require.main === module;
if (isMainModule) {
  seedPlans()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('시드 실패:', err);
      process.exit(1);
    });
}
