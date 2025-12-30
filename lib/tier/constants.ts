/**
 * 티어별 제한 상수 정의
 *
 * 각 티어별로 챗봇, 데이터셋, 문서, 저장 용량 등의 제한을 정의합니다.
 */

export const TIER_LIMITS = {
  basic: {
    // 챗봇 제한
    maxChatbots: 1,

    // 데이터셋 제한
    maxDatasets: 1,

    // 문서 제한
    maxDocumentsPerDataset: 10,
    maxTotalDocuments: 10,

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
  },

  standard: {
    // 챗봇 제한
    maxChatbots: 3,

    // 데이터셋 제한
    maxDatasets: 5,

    // 문서 제한
    maxDocumentsPerDataset: 50,
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
  },

  premium: {
    // 챗봇 제한
    maxChatbots: 10,

    // 데이터셋 제한
    maxDatasets: 20,

    // 문서 제한
    maxDocumentsPerDataset: 200,
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
  },
} as const;

/**
 * 티어별 예산 한도 (USD)
 * DB의 tier_budget_limits 테이블과 동기화 필요
 */
export const TIER_BUDGET_LIMITS = {
  basic: {
    monthlyBudgetUsd: 10, // $10/월
    dailyBudgetUsd: 0.33, // ~$0.33/일
    alertThreshold: 80, // 80%에서 경고
  },
  standard: {
    monthlyBudgetUsd: 50, // $50/월
    dailyBudgetUsd: 1.67, // ~$1.67/일
    alertThreshold: 80,
  },
  premium: {
    monthlyBudgetUsd: 200, // $200/월
    dailyBudgetUsd: 6.67, // ~$6.67/일
    alertThreshold: 80,
  },
} as const;

export type TierBudget = (typeof TIER_BUDGET_LIMITS)[Tier];

export type Tier = keyof typeof TIER_LIMITS;
export type TierLimits = (typeof TIER_LIMITS)[Tier];

/**
 * 티어 이름 한글 표기
 */
export const TIER_NAMES: Record<Tier, string> = {
  basic: '베이직',
  standard: '스탠다드',
  premium: '프리미엄',
};

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
