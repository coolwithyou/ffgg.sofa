/**
 * 플랜 시드 데이터
 * [Billing System] 기본 플랜 정의
 *
 * 사용법:
 *   pnpm tsx drizzle/seed/plans.ts
 */

import { db } from '@/lib/db';
import { plans, type NewPlan } from '../schema';

export const plansSeed: NewPlan[] = [
  {
    id: 'basic',
    name: 'Basic',
    nameKo: '베이직',
    description: '개인 및 소규모 팀을 위한 무료 플랜',
    monthlyPrice: 0,
    yearlyPrice: 0,
    features: [
      '챗봇 1개',
      '데이터셋 1개',
      '문서 10개',
      '저장공간 100MB',
      '월 1,000회 대화',
    ],
    limits: {
      maxChatbots: 1,
      maxDatasets: 1,
      maxDocuments: 10,
      maxStorageBytes: 104857600, // 100MB
      maxMonthlyConversations: 1000,
    },
    isActive: true,
    sortOrder: 0,
  },
  {
    id: 'standard',
    name: 'Standard',
    nameKo: '스탠다드',
    description: '성장하는 비즈니스를 위한 플랜',
    monthlyPrice: 29000, // KRW
    yearlyPrice: 290000, // 2개월 할인 (348,000 → 290,000)
    features: [
      '챗봇 3개',
      '데이터셋 5개',
      '문서 100개',
      '저장공간 1GB',
      '월 10,000회 대화',
      '이메일 지원',
    ],
    limits: {
      maxChatbots: 3,
      maxDatasets: 5,
      maxDocuments: 100,
      maxStorageBytes: 1073741824, // 1GB
      maxMonthlyConversations: 10000,
    },
    isActive: true,
    sortOrder: 1,
  },
  {
    id: 'premium',
    name: 'Premium',
    nameKo: '프리미엄',
    description: '대규모 비즈니스를 위한 전문가 플랜',
    monthlyPrice: 99000, // KRW
    yearlyPrice: 990000, // 2개월 할인 (1,188,000 → 990,000)
    features: [
      '챗봇 10개',
      '데이터셋 20개',
      '문서 500개',
      '저장공간 10GB',
      '월 100,000회 대화',
      '우선 지원',
      'API 액세스',
      '고급 분석',
    ],
    limits: {
      maxChatbots: 10,
      maxDatasets: 20,
      maxDocuments: 500,
      maxStorageBytes: 10737418240, // 10GB
      maxMonthlyConversations: 100000,
    },
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
          features: plan.features,
          limits: plan.limits,
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
