/**
 * 예산 임계값 체크 유틸리티
 * 테넌트별 예산 사용률을 확인하고 알림 대상을 반환합니다.
 */

import { db } from '@/lib/db';
import { tenants, tokenUsageLogs, tenantBudgetStatus } from '@/drizzle/schema';
import { eq, sql, gte, and } from 'drizzle-orm';
import { getTenantBudgetLimit } from '@/lib/tier/budget-limits';
import type { BudgetAlert, AnomalyAlert, AlertType, Alert, ResponseTimeP95Alert, ResponseTimeSpikeAlert } from './types';
import { ALERT_SEVERITY_MAP, ALERT_MESSAGES } from './types';
import { checkAllResponseTimeAlerts } from './response-time-checker';

interface BudgetCheckResult {
  tenantId: string;
  tenantName: string;
  tier: string;
  budgetLimit: number;
  currentUsage: number;
  percentUsed: number;
  alertType: AlertType | null;
}

/**
 * 모든 테넌트의 예산 상태를 확인합니다.
 */
export async function checkAllBudgetThresholds(): Promise<BudgetAlert[]> {
  const alerts: BudgetAlert[] = [];

  try {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // 모든 테넌트의 이번 달 사용량 조회
    const tenantUsages = await db
      .select({
        tenantId: tenants.id,
        tenantName: tenants.name,
        tier: tenants.tier,
        currentUsage: sql<number>`COALESCE(SUM(${tokenUsageLogs.totalCostUsd}), 0)`,
      })
      .from(tenants)
      .leftJoin(
        tokenUsageLogs,
        and(
          eq(tokenUsageLogs.tenantId, tenants.id),
          gte(tokenUsageLogs.createdAt, monthStart)
        )
      )
      .groupBy(tenants.id, tenants.name, tenants.tier);

    for (const tenant of tenantUsages) {
      const result = await checkTenantBudget(
        tenant.tenantId,
        tenant.tenantName,
        tenant.tier ?? 'basic',
        Number(tenant.currentUsage)
      );

      if (result.alertType) {
        const alert = createBudgetAlert(result);
        alerts.push(alert);
      }
    }

    return alerts;
  } catch (error) {
    console.error('Failed to check budget thresholds:', error);
    return [];
  }
}

/**
 * 특정 테넌트의 예산 상태를 확인합니다.
 */
async function checkTenantBudget(
  tenantId: string,
  tenantName: string,
  tier: string,
  currentUsage: number
): Promise<BudgetCheckResult> {
  const budgetLimit = await getTenantBudgetLimit(tenantId);
  const percentUsed = budgetLimit.monthlyBudgetUsd > 0
    ? (currentUsage / budgetLimit.monthlyBudgetUsd) * 100
    : 0;

  let alertType: AlertType | null = null;

  if (percentUsed >= 100) {
    alertType = 'budget_exceeded';
  } else if (percentUsed >= 90) {
    alertType = 'budget_critical';
  } else if (percentUsed >= 80) {
    alertType = 'budget_warning';
  }

  return {
    tenantId,
    tenantName,
    tier,
    budgetLimit: budgetLimit.monthlyBudgetUsd,
    currentUsage,
    percentUsed,
    alertType,
  };
}

/**
 * BudgetCheckResult로부터 BudgetAlert를 생성합니다.
 */
function createBudgetAlert(result: BudgetCheckResult): BudgetAlert {
  const type = result.alertType as 'budget_warning' | 'budget_critical' | 'budget_exceeded';
  const data = {
    percentUsed: result.percentUsed.toFixed(1),
    currentUsage: result.currentUsage.toFixed(2),
    budgetLimit: result.budgetLimit.toFixed(2),
  };

  return {
    tenantId: result.tenantId,
    tenantName: result.tenantName,
    type,
    severity: ALERT_SEVERITY_MAP[type],
    threshold: type === 'budget_exceeded' ? 100 : type === 'budget_critical' ? 90 : 80,
    actualValue: result.percentUsed,
    message: ALERT_MESSAGES[type](data),
    budgetLimit: result.budgetLimit,
    currentUsage: result.currentUsage,
    percentUsed: result.percentUsed,
    createdAt: new Date(),
  };
}

/**
 * 이상 사용량 감지 (전일 대비 급증)
 */
export async function checkAnomalies(spikeThreshold: number = 200): Promise<AnomalyAlert[]> {
  const alerts: AnomalyAlert[] = [];

  try {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterdayStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000);

    // 테넌트별 오늘/어제 사용량 비교
    const usageComparison = await db
      .select({
        tenantId: tokenUsageLogs.tenantId,
        tenantName: tenants.name,
        todayCost: sql<number>`COALESCE(SUM(${tokenUsageLogs.totalCostUsd}) FILTER (WHERE ${tokenUsageLogs.createdAt} >= ${todayStart}), 0)`,
        yesterdayCost: sql<number>`COALESCE(SUM(${tokenUsageLogs.totalCostUsd}) FILTER (WHERE ${tokenUsageLogs.createdAt} >= ${yesterdayStart} AND ${tokenUsageLogs.createdAt} < ${todayStart}), 0)`,
      })
      .from(tokenUsageLogs)
      .innerJoin(tenants, eq(tokenUsageLogs.tenantId, tenants.id))
      .where(gte(tokenUsageLogs.createdAt, yesterdayStart))
      .groupBy(tokenUsageLogs.tenantId, tenants.name);

    for (const usage of usageComparison) {
      const todayCost = Number(usage.todayCost);
      const yesterdayCost = Number(usage.yesterdayCost);

      // 어제 비용이 $0.01 이상이고 오늘 비용이 급증한 경우
      if (yesterdayCost >= 0.01) {
        const increaseRatio = (todayCost / yesterdayCost) * 100;

        if (increaseRatio >= spikeThreshold) {
          const data = { increaseRatio: increaseRatio.toFixed(0) };

          alerts.push({
            tenantId: usage.tenantId!,
            tenantName: usage.tenantName,
            type: 'anomaly_spike',
            severity: 'warning',
            threshold: spikeThreshold,
            actualValue: increaseRatio,
            message: ALERT_MESSAGES.anomaly_spike(data),
            previousValue: yesterdayCost,
            increaseRatio,
            createdAt: new Date(),
          });
        }
      }
    }

    return alerts;
  } catch (error) {
    console.error('Failed to check anomalies:', error);
    return [];
  }
}

/**
 * 모든 알림 체크 실행 (예산 + 이상 탐지 + 응답 시간)
 */
export async function checkAllAlerts(): Promise<Alert[]> {
  const [budgetAlerts, anomalyAlerts, responseTimeAlerts] = await Promise.all([
    checkAllBudgetThresholds(),
    checkAnomalies(),
    checkAllResponseTimeAlerts(),
  ]);

  return [...budgetAlerts, ...anomalyAlerts, ...responseTimeAlerts];
}
