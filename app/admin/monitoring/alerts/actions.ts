'use server';

/**
 * 알림 관리 서버 액션
 * 알림 조회, 확인 처리, 설정 관리
 */

import { validateSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { usageAlerts, slackAlertSettings, tenants } from '@/drizzle/schema';
import { eq, desc, and, sql, count, inArray } from 'drizzle-orm';
import type { AlertType, AlertSeverity } from '@/lib/alerts/types';
import { logger } from '@/lib/logger';

export interface AlertRecord {
  id: string;
  tenantId: string;
  tenantName: string;
  alertType: AlertType;
  alertChannel: string;
  threshold: number;
  actualValue: number;
  message: string;
  sentAt: Date;
  acknowledged: boolean;
  acknowledgedAt: Date | null;
}

export interface AlertsOverview {
  total: number;
  unacknowledged: number;
  today: number;
  byType: {
    budget_warning: number;
    budget_critical: number;
    budget_exceeded: number;
    anomaly_spike: number;
  };
}

export interface SlackSettings {
  id: string;
  webhookUrl: string;
  channelName: string | null;
  enableBudgetAlerts: boolean;
  enableAnomalyAlerts: boolean;
}

/**
 * 알림 목록 조회
 */
export async function getAlerts(options: {
  page?: number;
  limit?: number;
  acknowledged?: boolean;
  alertType?: AlertType;
}): Promise<{ alerts: AlertRecord[]; total: number } | null> {
  const session = await validateSession();
  if (!session || (session.role !== 'internal_operator' && session.role !== 'admin')) {
    return null;
  }

  const { page = 1, limit = 20, acknowledged, alertType } = options;
  const offset = (page - 1) * limit;

  try {
    // 조건 구성
    const conditions = [];
    if (acknowledged !== undefined) {
      conditions.push(eq(usageAlerts.acknowledged, acknowledged));
    }
    if (alertType) {
      conditions.push(eq(usageAlerts.alertType, alertType));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // 알림 목록 조회
    const alerts = await db
      .select({
        id: usageAlerts.id,
        tenantId: usageAlerts.tenantId,
        tenantName: tenants.name,
        alertType: usageAlerts.alertType,
        alertChannel: usageAlerts.alertChannel,
        threshold: usageAlerts.threshold,
        actualValue: usageAlerts.actualValue,
        message: usageAlerts.message,
        sentAt: usageAlerts.sentAt,
        acknowledged: usageAlerts.acknowledged,
        acknowledgedAt: usageAlerts.acknowledgedAt,
      })
      .from(usageAlerts)
      .leftJoin(tenants, eq(usageAlerts.tenantId, tenants.id))
      .where(whereClause)
      .orderBy(desc(usageAlerts.sentAt))
      .limit(limit)
      .offset(offset);

    // 총 개수 조회
    const [{ total }] = await db
      .select({ total: count() })
      .from(usageAlerts)
      .where(whereClause);

    return {
      alerts: alerts.map((a) => ({
        id: a.id,
        tenantId: a.tenantId,
        tenantName: a.tenantName || '알 수 없음',
        alertType: a.alertType as AlertType,
        alertChannel: a.alertChannel || 'none',
        threshold: Number(a.threshold),
        actualValue: Number(a.actualValue),
        message: a.message || '',
        sentAt: a.sentAt!,
        acknowledged: a.acknowledged ?? false,
        acknowledgedAt: a.acknowledgedAt,
      })),
      total: Number(total),
    };
  } catch (error) {
    logger.error('Failed to get alerts', error as Error, {
      page,
      limit,
      acknowledged,
      alertType,
    });
    return null;
  }
}

/**
 * 알림 개요 통계 조회
 */
export async function getAlertsOverview(): Promise<AlertsOverview | null> {
  const session = await validateSession();
  if (!session || (session.role !== 'internal_operator' && session.role !== 'admin')) {
    return null;
  }

  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    // Note: Drizzle sql 템플릿에서 Date 객체는 ISO 문자열로 변환 필요
    const todayStartISO = todayStart.toISOString();

    const [stats] = await db
      .select({
        total: count(),
        unacknowledged: sql<number>`COUNT(*) FILTER (WHERE ${usageAlerts.acknowledged} = false)`,
        today: sql<number>`COUNT(*) FILTER (WHERE ${usageAlerts.sentAt} >= ${todayStartISO}::timestamptz)`,
        budget_warning: sql<number>`COUNT(*) FILTER (WHERE ${usageAlerts.alertType} = 'budget_warning')`,
        budget_critical: sql<number>`COUNT(*) FILTER (WHERE ${usageAlerts.alertType} = 'budget_critical')`,
        budget_exceeded: sql<number>`COUNT(*) FILTER (WHERE ${usageAlerts.alertType} = 'budget_exceeded')`,
        anomaly_spike: sql<number>`COUNT(*) FILTER (WHERE ${usageAlerts.alertType} = 'anomaly_spike')`,
      })
      .from(usageAlerts);

    return {
      total: Number(stats.total),
      unacknowledged: Number(stats.unacknowledged),
      today: Number(stats.today),
      byType: {
        budget_warning: Number(stats.budget_warning),
        budget_critical: Number(stats.budget_critical),
        budget_exceeded: Number(stats.budget_exceeded),
        anomaly_spike: Number(stats.anomaly_spike),
      },
    };
  } catch (error) {
    logger.error('Failed to get alerts overview', error as Error);
    return null;
  }
}

/**
 * 알림 확인 처리
 */
export async function acknowledgeAlert(alertId: string): Promise<boolean> {
  const session = await validateSession();
  if (!session || (session.role !== 'internal_operator' && session.role !== 'admin')) {
    return false;
  }

  try {
    await db
      .update(usageAlerts)
      .set({
        acknowledged: true,
        acknowledgedAt: new Date(),
      })
      .where(eq(usageAlerts.id, alertId));

    return true;
  } catch (error) {
    logger.error('Failed to acknowledge alert', error as Error, { alertId });
    return false;
  }
}

/**
 * 여러 알림 일괄 확인 처리
 * 단일 쿼리로 모든 알림을 한 번에 업데이트합니다.
 */
export async function acknowledgeAlerts(alertIds: string[]): Promise<boolean> {
  const session = await validateSession();
  if (!session || (session.role !== 'internal_operator' && session.role !== 'admin')) {
    return false;
  }

  if (alertIds.length === 0) {
    return true;
  }

  try {
    // 단일 쿼리로 모든 알림을 한 번에 업데이트 (N+1 최적화)
    await db
      .update(usageAlerts)
      .set({
        acknowledged: true,
        acknowledgedAt: new Date(),
      })
      .where(inArray(usageAlerts.id, alertIds));

    return true;
  } catch (error) {
    logger.error('Failed to acknowledge alerts', error as Error, {
      alertCount: alertIds.length,
    });
    return false;
  }
}

/**
 * Slack 설정 조회
 */
export async function getSlackSettings(): Promise<SlackSettings | null> {
  const session = await validateSession();
  if (!session || (session.role !== 'internal_operator' && session.role !== 'admin')) {
    return null;
  }

  try {
    const [settings] = await db.select().from(slackAlertSettings).limit(1);

    if (!settings) {
      return null;
    }

    return {
      id: settings.id,
      webhookUrl: settings.webhookUrl,
      channelName: settings.channelName,
      enableBudgetAlerts: settings.enableBudgetAlerts ?? true,
      enableAnomalyAlerts: settings.enableAnomalyAlerts ?? true,
    };
  } catch (error) {
    logger.error('Failed to get Slack settings', error as Error);
    return null;
  }
}

/**
 * Slack 설정 저장
 */
export async function saveSlackSettings(settings: {
  webhookUrl: string;
  channelName?: string;
  enableBudgetAlerts: boolean;
  enableAnomalyAlerts: boolean;
}): Promise<boolean> {
  const session = await validateSession();
  if (!session || (session.role !== 'internal_operator' && session.role !== 'admin')) {
    return false;
  }

  try {
    const existing = await db.select({ id: slackAlertSettings.id }).from(slackAlertSettings).limit(1);

    if (existing.length > 0) {
      // 업데이트
      await db
        .update(slackAlertSettings)
        .set({
          webhookUrl: settings.webhookUrl,
          channelName: settings.channelName || null,
          enableBudgetAlerts: settings.enableBudgetAlerts,
          enableAnomalyAlerts: settings.enableAnomalyAlerts,
          updatedAt: new Date(),
        })
        .where(eq(slackAlertSettings.id, existing[0].id));
    } else {
      // 새로 생성
      await db.insert(slackAlertSettings).values({
        webhookUrl: settings.webhookUrl,
        channelName: settings.channelName || null,
        enableBudgetAlerts: settings.enableBudgetAlerts,
        enableAnomalyAlerts: settings.enableAnomalyAlerts,
      });
    }

    return true;
  } catch (error) {
    logger.error('Failed to save Slack settings', error as Error, {
      enableBudgetAlerts: settings.enableBudgetAlerts,
      enableAnomalyAlerts: settings.enableAnomalyAlerts,
    });
    return false;
  }
}
