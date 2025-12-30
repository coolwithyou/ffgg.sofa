/**
 * 티어별 예산 한도 관리
 * 테넌트의 예산 상태를 조회하고 예산 초과 여부를 확인합니다.
 */

import { db } from '@/lib/db';
import {
  tenants,
  tenantBudgetStatus,
  tierBudgetLimits as tierBudgetLimitsTable,
} from '@/drizzle/schema';
import { eq, sql } from 'drizzle-orm';
import { logger } from '@/lib/logger';
import { TIER_BUDGET_LIMITS, type Tier } from './constants';
import type { BudgetStatus } from '@/lib/usage/types';

/**
 * 유효한 티어인지 확인하고, 유효하지 않으면 'basic' 반환
 */
function getValidTier(tier: unknown): Tier {
  if (tier === 'basic' || tier === 'standard' || tier === 'premium') {
    return tier;
  }
  logger.warn('Invalid tier detected, falling back to basic', { tier });
  return 'basic';
}

export interface BudgetLimit {
  tier: Tier;
  monthlyBudgetUsd: number;
  dailyBudgetUsd: number;
  alertThreshold: number;
  isOverridden: boolean;
}

/**
 * 테넌트의 예산 한도 조회
 * 관리자가 수동으로 설정한 override가 있으면 우선 적용
 */
export async function getTenantBudgetLimit(tenantId: string): Promise<BudgetLimit> {
  // 테넌트 정보 및 예산 상태 조회
  const [tenant] = await db
    .select({
      tier: tenants.tier,
    })
    .from(tenants)
    .where(eq(tenants.id, tenantId))
    .limit(1);

  if (!tenant) {
    throw new Error(`Tenant not found: ${tenantId}`);
  }

  // 유효한 티어인지 확인 (null, 빈 문자열, 정의되지 않은 티어 처리)
  const tier = getValidTier(tenant.tier);

  // override 설정 확인
  const [budgetStatus] = await db
    .select({
      overrideMonthlyBudgetUsd: tenantBudgetStatus.overrideMonthlyBudgetUsd,
    })
    .from(tenantBudgetStatus)
    .where(eq(tenantBudgetStatus.tenantId, tenantId))
    .limit(1);

  const overrideMonthlyBudget = budgetStatus?.overrideMonthlyBudgetUsd;

  if (overrideMonthlyBudget !== null && overrideMonthlyBudget !== undefined) {
    // 관리자 수동 설정 적용
    return {
      tier,
      monthlyBudgetUsd: overrideMonthlyBudget,
      dailyBudgetUsd: overrideMonthlyBudget / 30,
      alertThreshold: TIER_BUDGET_LIMITS[tier].alertThreshold,
      isOverridden: true,
    };
  }

  // DB에서 티어별 예산 한도 조회 (없으면 상수 사용)
  const [dbLimit] = await db
    .select({
      monthlyBudgetUsd: tierBudgetLimitsTable.monthlyBudgetUsd,
      dailyBudgetUsd: tierBudgetLimitsTable.dailyBudgetUsd,
      alertThreshold: tierBudgetLimitsTable.alertThreshold,
    })
    .from(tierBudgetLimitsTable)
    .where(eq(tierBudgetLimitsTable.tier, tier))
    .limit(1);

  if (dbLimit) {
    return {
      tier,
      monthlyBudgetUsd: dbLimit.monthlyBudgetUsd,
      dailyBudgetUsd: dbLimit.dailyBudgetUsd,
      alertThreshold: dbLimit.alertThreshold ?? 80,
      isOverridden: false,
    };
  }

  // 상수에서 기본값 사용
  const defaultLimit = TIER_BUDGET_LIMITS[tier];
  return {
    tier,
    monthlyBudgetUsd: defaultLimit.monthlyBudgetUsd,
    dailyBudgetUsd: defaultLimit.dailyBudgetUsd,
    alertThreshold: defaultLimit.alertThreshold,
    isOverridden: false,
  };
}

/**
 * 예산 상태 확인
 */
export async function checkBudgetStatus(tenantId: string): Promise<BudgetStatus> {
  // 예산 한도 조회
  const budgetLimit = await getTenantBudgetLimit(tenantId);

  // 현재 사용량 조회
  const [usageStatus] = await db
    .select({
      currentMonthUsageUsd: tenantBudgetStatus.currentMonthUsageUsd,
    })
    .from(tenantBudgetStatus)
    .where(eq(tenantBudgetStatus.tenantId, tenantId))
    .limit(1);

  const currentUsageUsd = usageStatus?.currentMonthUsageUsd ?? 0;
  const usagePercentage =
    budgetLimit.monthlyBudgetUsd > 0
      ? (currentUsageUsd / budgetLimit.monthlyBudgetUsd) * 100
      : 0;

  // 알림 레벨 결정
  let alertLevel: BudgetStatus['alertLevel'] = 'normal';
  if (usagePercentage >= 100) {
    alertLevel = 'exceeded';
  } else if (usagePercentage >= 90) {
    alertLevel = 'critical';
  } else if (usagePercentage >= budgetLimit.alertThreshold) {
    alertLevel = 'warning';
  }

  return {
    tenantId,
    tier: budgetLimit.tier,
    monthlyBudgetUsd: budgetLimit.monthlyBudgetUsd,
    currentUsageUsd,
    usagePercentage,
    remainingBudgetUsd: Math.max(0, budgetLimit.monthlyBudgetUsd - currentUsageUsd),
    isOverBudget: usagePercentage >= 100,
    alertLevel,
  };
}

/**
 * 예산 초과 여부만 빠르게 확인
 */
export async function isOverBudget(tenantId: string): Promise<boolean> {
  const status = await checkBudgetStatus(tenantId);
  return status.isOverBudget;
}

/**
 * 테넌트 예산 override 설정 (관리자용)
 */
export async function setTenantBudgetOverride(
  tenantId: string,
  monthlyBudgetUsd: number | null
): Promise<void> {
  await db
    .insert(tenantBudgetStatus)
    .values({
      tenantId,
      overrideMonthlyBudgetUsd: monthlyBudgetUsd,
      currentMonthUsageUsd: 0,
    })
    .onConflictDoUpdate({
      target: tenantBudgetStatus.tenantId,
      set: {
        overrideMonthlyBudgetUsd: monthlyBudgetUsd,
        updatedAt: sql`now()`,
      },
    });

  logger.info('Tenant budget override updated', {
    tenantId,
    monthlyBudgetUsd,
  });
}

/**
 * 모든 테넌트의 예산 상태 조회 (어드민 대시보드용)
 */
export async function getAllTenantBudgetStatuses(): Promise<BudgetStatus[]> {
  const allTenants = await db
    .select({
      id: tenants.id,
      tier: tenants.tier,
    })
    .from(tenants)
    .where(eq(tenants.status, 'active'));

  const statuses: BudgetStatus[] = [];

  for (const tenant of allTenants) {
    try {
      const status = await checkBudgetStatus(tenant.id);
      statuses.push(status);
    } catch (error) {
      logger.error('Failed to get budget status for tenant', error as Error, {
        tenantId: tenant.id,
      });
    }
  }

  return statuses.sort((a, b) => b.usagePercentage - a.usagePercentage);
}

/**
 * 예산 경고가 필요한 테넌트 목록 조회
 */
export async function getTenantsNeedingBudgetAlert(): Promise<BudgetStatus[]> {
  const allStatuses = await getAllTenantBudgetStatuses();
  return allStatuses.filter(
    (status) => status.alertLevel === 'warning' || status.alertLevel === 'critical'
  );
}
