/**
 * 티어별 제한 상수 정의
 *
 * 각 티어별로 챗봇, 데이터셋, 문서, 저장 용량, 배포, 포인트 등의 제한을 정의합니다.
 *
 * 플랜 구조 (v2):
 * - free: 무료 플랜 (체험 포인트 500P, 배포 불가)
 * - pro: 프로 플랜 (월 ₩50,000, 3,000P/월, 배포 1개)
 * - business: 비즈니스 플랜 (월 ₩150,000, 10,000P/월, 배포 3개)
 */

export const TIER_LIMITS = {
  free: {
    // 챗봇 제한 (1:1 = 데이터셋)
    maxChatbots: 3,
    maxDatasets: 3, // = maxChatbots

    // 문서 제한
    maxDocumentsPerDataset: 10,
    maxTotalDocuments: 30, // 챗봇당 10개 × 3개

    // 저장 용량 제한 (bytes)
    maxStorageBytes: 100 * 1024 * 1024, // 100MB

    // 청크 제한
    maxChunksPerDocument: 100,

    // 대화 제한
    maxMonthlyConversations: 1000,

    // API Rate Limiting
    apiRequestsPerMinute: 60,
    chatRequestsPerDay: 100,
    uploadRequestsPerHour: 10,

    // 버전 관리 (발행 이력 저장 횟수)
    maxPublishHistory: 1,

    // 배포 제한
    maxDeployments: 0, // 배포 불가 (미리보기만)

    // 포인트 (월간)
    monthlyPoints: 0, // 월간 포인트 없음 (체험 500P만)

    // 슬러그 변경 제한 (챗봇별 하루)
    slugChangesPerDay: 0, // 변경 불가 (발행 불가이므로)
  },

  pro: {
    // 챗봇 제한 (1:1 = 데이터셋)
    maxChatbots: 3,
    maxDatasets: 3, // = maxChatbots

    // 문서 제한
    maxDocumentsPerDataset: 34,
    maxTotalDocuments: 100,

    // 저장 용량 제한 (bytes)
    maxStorageBytes: 1024 * 1024 * 1024, // 1GB

    // 청크 제한
    maxChunksPerDocument: 500,

    // 대화 제한
    maxMonthlyConversations: 10000,

    // API Rate Limiting
    apiRequestsPerMinute: 300,
    chatRequestsPerDay: 1000,
    uploadRequestsPerHour: 50,

    // 버전 관리 (발행 이력 저장 횟수)
    maxPublishHistory: 10,

    // 배포 제한
    maxDeployments: 1,

    // 포인트 (월간)
    monthlyPoints: 3000, // ~300회 AI 응답

    // 슬러그 변경 제한 (챗봇별 하루)
    slugChangesPerDay: 3, // 하루 3회
  },

  business: {
    // 챗봇 제한 (1:1 = 데이터셋)
    maxChatbots: 10,
    maxDatasets: 10, // = maxChatbots

    // 문서 제한
    maxDocumentsPerDataset: 50,
    maxTotalDocuments: 500,

    // 저장 용량 제한 (bytes)
    maxStorageBytes: 10 * 1024 * 1024 * 1024, // 10GB

    // 청크 제한
    maxChunksPerDocument: 1000,

    // 대화 제한
    maxMonthlyConversations: 100000,

    // API Rate Limiting
    apiRequestsPerMinute: 1000,
    chatRequestsPerDay: 10000,
    uploadRequestsPerHour: 200,

    // 버전 관리 (발행 이력 저장 횟수)
    maxPublishHistory: 30,

    // 배포 제한
    maxDeployments: 3,

    // 포인트 (월간)
    monthlyPoints: 10000, // ~1,000회 AI 응답

    // 슬러그 변경 제한 (챗봇별 하루)
    slugChangesPerDay: -1, // 무제한 (-1)
  },
} as const;

/**
 * 티어별 기능 플래그
 */
export const TIER_FEATURES = {
  free: {
    canDeploy: false, // 배포 불가
    customDomain: false,
    apiAccess: false,
    prioritySupport: false,
    advancedAnalytics: false,
  },
  pro: {
    canDeploy: true,
    customDomain: false,
    apiAccess: false,
    prioritySupport: false,
    advancedAnalytics: false,
  },
  business: {
    canDeploy: true,
    customDomain: true,
    apiAccess: true,
    prioritySupport: true,
    advancedAnalytics: true,
  },
} as const;

/**
 * 티어별 예산 한도 (USD) - 레거시 호환
 * DB의 tier_budget_limits 테이블과 동기화 필요
 */
export const TIER_BUDGET_LIMITS = {
  free: {
    monthlyBudgetUsd: 5, // $5/월
    dailyBudgetUsd: 0.17, // ~$0.17/일
    alertThreshold: 80, // 80%에서 경고
  },
  pro: {
    monthlyBudgetUsd: 50, // $50/월
    dailyBudgetUsd: 1.67, // ~$1.67/일
    alertThreshold: 80,
  },
  business: {
    monthlyBudgetUsd: 200, // $200/월
    dailyBudgetUsd: 6.67, // ~$6.67/일
    alertThreshold: 80,
  },
} as const;

export type TierBudget = (typeof TIER_BUDGET_LIMITS)[Tier];

export type Tier = keyof typeof TIER_LIMITS;
export type TierLimits = (typeof TIER_LIMITS)[Tier];
export type TierFeatures = (typeof TIER_FEATURES)[Tier];

/**
 * 티어 이름 한글 표기
 */
export const TIER_NAMES: Record<Tier, string> = {
  free: 'Free',
  pro: 'Pro',
  business: 'Business',
};

/**
 * 레거시 티어 매핑 (마이그레이션용)
 * 기존 basic/standard/premium → 새 free/pro/business
 */
export const LEGACY_TIER_MAPPING: Record<string, Tier> = {
  basic: 'free',
  standard: 'pro',
  premium: 'business',
};

/**
 * DB에서 읽어온 티어값을 새 티어명으로 정규화
 * 레거시 티어명(basic/standard/premium)도 지원
 *
 * @example
 * normalizeTier('basic')    // 'free'
 * normalizeTier('standard') // 'pro'
 * normalizeTier('premium')  // 'business'
 * normalizeTier('free')     // 'free' (이미 새 티어명)
 * normalizeTier('invalid')  // 'free' (기본값)
 * normalizeTier(null)       // 'free' (기본값)
 */
export function normalizeTier(tier: unknown): Tier {
  if (typeof tier !== 'string' || !tier) {
    return 'free';
  }

  // 이미 새 티어명인 경우
  if (tier === 'free' || tier === 'pro' || tier === 'business') {
    return tier;
  }

  // 레거시 티어명인 경우 변환
  const mapped = LEGACY_TIER_MAPPING[tier];
  if (mapped) {
    return mapped;
  }

  // 알 수 없는 티어는 free로 폴백
  return 'free';
}

/**
 * 유효한 티어인지 확인 (새 티어명만)
 */
export function isValidTier(tier: unknown): tier is Tier {
  return tier === 'free' || tier === 'pro' || tier === 'business';
}

/**
 * 용량을 사람이 읽기 쉬운 형식으로 변환
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * 티어별 제한 정보를 사람이 읽기 쉬운 형식으로 반환
 */
export function getTierLimitsDisplay(tier: Tier) {
  const limits = TIER_LIMITS[tier];
  return {
    tier,
    tierName: TIER_NAMES[tier],
    chatbots: `최대 ${limits.maxChatbots}개`,
    datasets: `최대 ${limits.maxDatasets}개`,
    documents: `최대 ${limits.maxTotalDocuments}개`,
    storage: formatBytes(limits.maxStorageBytes),
    conversations: `월 ${limits.maxMonthlyConversations.toLocaleString()}회`,
  };
}
