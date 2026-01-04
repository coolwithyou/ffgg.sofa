/**
 * 티어별 제한 검증 함수
 *
 * 챗봇, 데이터셋, 문서, 저장 용량 등의 제한을 검증합니다.
 */

import { eq, sql, and } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  tenants,
  chatbots,
  datasets,
  documents,
  chunks,
  usageLogs,
} from '@/drizzle/schema';
import { TIER_LIMITS, TIER_FEATURES, normalizeTier, type Tier } from './constants';

export interface LimitCheckResult {
  allowed: boolean;
  current: number;
  max: number;
  remaining: number;
}

/**
 * 테넌트의 티어 조회
 * 레거시 티어명(basic/standard/premium)도 자동 변환
 */
export async function getTenantTier(tenantId: string): Promise<Tier> {
  const result = await db
    .select({ tier: tenants.tier })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);

  return normalizeTier(result[0]?.tier);
}

/**
 * 챗봇 개수 제한 확인
 */
export async function checkChatbotLimit(
  tenantId: string,
  tier?: Tier
): Promise<LimitCheckResult> {
  const actualTier = tier || (await getTenantTier(tenantId));
  const max = TIER_LIMITS[actualTier].maxChatbots;

  const result = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(chatbots)
    .where(eq(chatbots.tenantId, tenantId));

  const current = result[0]?.count || 0;

  return {
    allowed: current < max,
    current,
    max,
    remaining: Math.max(0, max - current),
  };
}

/**
 * 데이터셋 개수 제한 확인
 */
export async function checkDatasetLimit(
  tenantId: string,
  tier?: Tier
): Promise<LimitCheckResult> {
  const actualTier = tier || (await getTenantTier(tenantId));
  const max = TIER_LIMITS[actualTier].maxDatasets;

  const result = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(datasets)
    .where(eq(datasets.tenantId, tenantId));

  const current = result[0]?.count || 0;

  return {
    allowed: current < max,
    current,
    max,
    remaining: Math.max(0, max - current),
  };
}

/**
 * 전체 문서 개수 제한 확인
 */
export async function checkTotalDocumentLimit(
  tenantId: string,
  tier?: Tier
): Promise<LimitCheckResult> {
  const actualTier = tier || (await getTenantTier(tenantId));
  const max = TIER_LIMITS[actualTier].maxTotalDocuments;

  const result = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(documents)
    .where(eq(documents.tenantId, tenantId));

  const current = result[0]?.count || 0;

  return {
    allowed: current < max,
    current,
    max,
    remaining: Math.max(0, max - current),
  };
}

/**
 * 데이터셋별 문서 개수 제한 확인
 */
export async function checkDatasetDocumentLimit(
  datasetId: string,
  tenantId: string,
  tier?: Tier
): Promise<LimitCheckResult> {
  const actualTier = tier || (await getTenantTier(tenantId));
  const max = TIER_LIMITS[actualTier].maxDocumentsPerDataset;

  const result = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(documents)
    .where(eq(documents.datasetId, datasetId));

  const current = result[0]?.count || 0;

  return {
    allowed: current < max,
    current,
    max,
    remaining: Math.max(0, max - current),
  };
}

/**
 * 저장 용량 제한 확인
 */
export async function checkStorageLimit(
  tenantId: string,
  tier?: Tier
): Promise<LimitCheckResult> {
  const actualTier = tier || (await getTenantTier(tenantId));
  const max = TIER_LIMITS[actualTier].maxStorageBytes;

  const result = await db
    .select({ total: sql<number>`COALESCE(SUM(file_size), 0)::bigint` })
    .from(documents)
    .where(eq(documents.tenantId, tenantId));

  const current = Number(result[0]?.total) || 0;

  return {
    allowed: current < max,
    current,
    max,
    remaining: Math.max(0, max - current),
  };
}

/**
 * 문서당 청크 개수 제한 확인
 */
export async function checkChunkLimit(
  documentId: string,
  tenantId: string,
  tier?: Tier
): Promise<LimitCheckResult> {
  const actualTier = tier || (await getTenantTier(tenantId));
  const max = TIER_LIMITS[actualTier].maxChunksPerDocument;

  const result = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(chunks)
    .where(eq(chunks.documentId, documentId));

  const current = result[0]?.count || 0;

  return {
    allowed: current < max,
    current,
    max,
    remaining: Math.max(0, max - current),
  };
}

/**
 * 월간 대화 수 제한 확인
 */
export async function checkMonthlyConversationLimit(
  tenantId: string,
  tier?: Tier
): Promise<LimitCheckResult> {
  const actualTier = tier || (await getTenantTier(tenantId));
  const max = TIER_LIMITS[actualTier].maxMonthlyConversations;

  // 이번 달의 시작일
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthStartStr = monthStart.toISOString().split('T')[0];

  const result = await db
    .select({ total: sql<number>`COALESCE(SUM(conversation_count), 0)::int` })
    .from(usageLogs)
    .where(
      and(
        eq(usageLogs.tenantId, tenantId),
        sql`date >= ${monthStartStr}::date`
      )
    );

  const current = result[0]?.total || 0;

  return {
    allowed: current < max,
    current,
    max,
    remaining: Math.max(0, max - current),
  };
}

/**
 * 파일 업로드 가능 여부 확인 (용량 + 문서 수)
 */
export async function canUploadFile(
  tenantId: string,
  datasetId: string,
  fileSize: number,
  tier?: Tier
): Promise<{
  allowed: boolean;
  reason?: string;
  details: {
    storage: LimitCheckResult;
    totalDocuments: LimitCheckResult;
    datasetDocuments: LimitCheckResult;
  };
}> {
  const actualTier = tier || (await getTenantTier(tenantId));

  const [storage, totalDocuments, datasetDocuments] = await Promise.all([
    checkStorageLimit(tenantId, actualTier),
    checkTotalDocumentLimit(tenantId, actualTier),
    checkDatasetDocumentLimit(datasetId, tenantId, actualTier),
  ]);

  // 용량 확인 (새 파일 크기 포함)
  if (storage.current + fileSize > storage.max) {
    return {
      allowed: false,
      reason: `저장 용량 한도 초과 (현재: ${Math.round(storage.current / 1024 / 1024)}MB, 한도: ${Math.round(storage.max / 1024 / 1024)}MB)`,
      details: { storage, totalDocuments, datasetDocuments },
    };
  }

  // 전체 문서 수 확인
  if (!totalDocuments.allowed) {
    return {
      allowed: false,
      reason: `전체 문서 수 한도 초과 (현재: ${totalDocuments.current}, 한도: ${totalDocuments.max})`,
      details: { storage, totalDocuments, datasetDocuments },
    };
  }

  // 데이터셋별 문서 수 확인
  if (!datasetDocuments.allowed) {
    return {
      allowed: false,
      reason: `데이터셋 문서 수 한도 초과 (현재: ${datasetDocuments.current}, 한도: ${datasetDocuments.max})`,
      details: { storage, totalDocuments, datasetDocuments },
    };
  }

  return {
    allowed: true,
    details: { storage, totalDocuments, datasetDocuments },
  };
}

/**
 * 챗봇 생성 가능 여부 확인
 */
export async function canCreateChatbot(
  tenantId: string,
  tier?: Tier
): Promise<{ allowed: boolean; reason?: string; limit: LimitCheckResult }> {
  const limit = await checkChatbotLimit(tenantId, tier);

  if (!limit.allowed) {
    return {
      allowed: false,
      reason: `챗봇 수 한도 초과 (현재: ${limit.current}, 한도: ${limit.max})`,
      limit,
    };
  }

  return { allowed: true, limit };
}

/**
 * 데이터셋 생성 가능 여부 확인
 */
export async function canCreateDataset(
  tenantId: string,
  tier?: Tier
): Promise<{ allowed: boolean; reason?: string; limit: LimitCheckResult }> {
  const limit = await checkDatasetLimit(tenantId, tier);

  if (!limit.allowed) {
    return {
      allowed: false,
      reason: `데이터셋 수 한도 초과 (현재: ${limit.current}, 한도: ${limit.max})`,
      limit,
    };
  }

  return { allowed: true, limit };
}

/**
 * 테넌트의 전체 사용량 현황 조회
 */
export async function getUsageSummary(
  tenantId: string,
  tier?: Tier
): Promise<{
  tier: Tier;
  chatbots: LimitCheckResult;
  datasets: LimitCheckResult;
  documents: LimitCheckResult;
  storage: LimitCheckResult;
  monthlyConversations: LimitCheckResult;
}> {
  const actualTier = tier || (await getTenantTier(tenantId));

  const [chatbotsLimit, datasetsLimit, documentsLimit, storageLimit, conversationsLimit] =
    await Promise.all([
      checkChatbotLimit(tenantId, actualTier),
      checkDatasetLimit(tenantId, actualTier),
      checkTotalDocumentLimit(tenantId, actualTier),
      checkStorageLimit(tenantId, actualTier),
      checkMonthlyConversationLimit(tenantId, actualTier),
    ]);

  return {
    tier: actualTier,
    chatbots: chatbotsLimit,
    datasets: datasetsLimit,
    documents: documentsLimit,
    storage: storageLimit,
    monthlyConversations: conversationsLimit,
  };
}

// ============================================
// 배포 제한 검증
// ============================================

export interface DeploymentCheckResult {
  allowed: boolean;
  reason?: string;
  current: number;
  max: number;
  remaining: number;
}

/**
 * 현재 배포(활성화)된 챗봇 수 조회
 * publicPageEnabled 또는 widgetEnabled가 true인 챗봇 수
 */
export async function countActiveDeployments(tenantId: string): Promise<number> {
  const result = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(chatbots)
    .where(
      and(
        eq(chatbots.tenantId, tenantId),
        sql`(${chatbots.publicPageEnabled} = true OR ${chatbots.widgetEnabled} = true)`
      )
    );

  return result[0]?.count || 0;
}

/**
 * 배포 가능 여부 확인
 *
 * Free 플랜: 배포 불가 (미리보기만)
 * Pro 플랜: 1개 배포
 * Business 플랜: 3개 배포
 */
export async function canDeploy(
  tenantId: string,
  tier?: Tier
): Promise<DeploymentCheckResult> {
  const actualTier = tier || (await getTenantTier(tenantId));
  const features = TIER_FEATURES[actualTier];
  const limits = TIER_LIMITS[actualTier];

  // Free 플랜은 배포 불가
  if (!features.canDeploy) {
    return {
      allowed: false,
      reason: 'Free 플랜에서는 배포할 수 없습니다. Pro 플랜으로 업그레이드해주세요.',
      current: 0,
      max: 0,
      remaining: 0,
    };
  }

  const current = await countActiveDeployments(tenantId);
  const max = limits.maxDeployments;

  // 배포 한도 체크
  if (current >= max) {
    return {
      allowed: false,
      reason: `배포 한도(${max}개)에 도달했습니다. ${
        actualTier === 'pro' ? 'Business 플랜으로 업그레이드하면 더 많이 배포할 수 있습니다.' : ''
      }`,
      current,
      max,
      remaining: 0,
    };
  }

  return {
    allowed: true,
    current,
    max,
    remaining: max - current,
  };
}

/**
 * 특정 챗봇이 이미 배포되어 있는지 확인
 * (이미 배포된 챗봇은 재배포 시 한도에서 제외)
 */
export async function isChatbotDeployed(chatbotId: string): Promise<boolean> {
  const result = await db
    .select({
      publicPageEnabled: chatbots.publicPageEnabled,
      widgetEnabled: chatbots.widgetEnabled,
    })
    .from(chatbots)
    .where(eq(chatbots.id, chatbotId))
    .limit(1);

  if (!result[0]) return false;

  return Boolean(result[0].publicPageEnabled) || Boolean(result[0].widgetEnabled);
}

/**
 * 챗봇 배포 가능 여부 확인 (특정 챗봇)
 *
 * 이미 배포된 챗봇은 항상 재배포 가능 (설정 변경)
 * 새로 배포하는 경우에만 한도 체크
 */
export async function canDeployChatbot(
  tenantId: string,
  chatbotId: string,
  tier?: Tier
): Promise<DeploymentCheckResult> {
  // 이미 배포된 챗봇인지 확인
  const alreadyDeployed = await isChatbotDeployed(chatbotId);

  // 이미 배포된 경우 항상 허용 (설정 변경이므로)
  if (alreadyDeployed) {
    const actualTier = tier || (await getTenantTier(tenantId));
    const limits = TIER_LIMITS[actualTier];
    const current = await countActiveDeployments(tenantId);

    return {
      allowed: true,
      current,
      max: limits.maxDeployments,
      remaining: Math.max(0, limits.maxDeployments - current),
    };
  }

  // 새 배포인 경우 한도 체크
  return canDeploy(tenantId, tier);
}

/**
 * 커스텀 도메인 사용 가능 여부
 */
export function canUseCustomDomain(tier: Tier): boolean {
  return TIER_FEATURES[tier].customDomain;
}

/**
 * API 액세스 가능 여부
 */
export function canUseApiAccess(tier: Tier): boolean {
  return TIER_FEATURES[tier].apiAccess;
}
