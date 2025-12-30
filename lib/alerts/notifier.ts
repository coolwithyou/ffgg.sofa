/**
 * 통합 알림 발송 모듈
 * 이메일과 Slack을 동시에 발송합니다.
 */

import { sendBudgetAlertEmail, sendAnomalyAlertEmail } from '@/lib/email';
import { sendSlackAlert } from './slack';
import { db } from '@/lib/db';
import { usageAlerts, slackAlertSettings } from '@/drizzle/schema';
import { eq, and, gte } from 'drizzle-orm';
import type { Alert, BudgetAlert, AnomalyAlert, AlertChannel } from './types';

interface NotifyResult {
  success: boolean;
  emailSent?: boolean;
  slackSent?: boolean;
  errors?: string[];
}

// 운영자 이메일 (환경 변수 또는 기본값)
const OPERATOR_EMAILS = process.env.ALERT_OPERATOR_EMAILS?.split(',') || [];

/**
 * 알림 발송 (이메일 + Slack)
 */
export async function sendAlert(
  alert: Alert,
  options: { channel?: AlertChannel } = {}
): Promise<NotifyResult> {
  const channel = options.channel || 'both';
  const errors: string[] = [];
  let emailSent = false;
  let slackSent = false;

  // 1. 이메일 발송
  if (channel === 'email' || channel === 'both') {
    try {
      if (OPERATOR_EMAILS.length > 0) {
        for (const email of OPERATOR_EMAILS) {
          const result = await sendAlertEmail(alert, email);
          if (!result.success && result.error) {
            errors.push(`Email to ${email}: ${result.error}`);
          } else {
            emailSent = true;
          }
        }
      } else {
        console.warn('[ALERT] No operator emails configured');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown email error';
      errors.push(`Email: ${message}`);
    }
  }

  // 2. Slack 발송
  if (channel === 'slack' || channel === 'both') {
    try {
      const webhookUrl = await getSlackWebhookUrl();
      if (webhookUrl) {
        const result = await sendSlackAlert(alert, webhookUrl);
        if (!result.success && result.error) {
          errors.push(`Slack: ${result.error}`);
        } else {
          slackSent = true;
        }
      } else {
        console.warn('[ALERT] No Slack webhook URL configured');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown Slack error';
      errors.push(`Slack: ${message}`);
    }
  }

  // 3. 알림 이력 저장
  await saveAlertHistory(alert, { emailSent, slackSent, errors });

  return {
    success: errors.length === 0,
    emailSent,
    slackSent,
    errors: errors.length > 0 ? errors : undefined,
  };
}

/**
 * 알림 타입에 따른 이메일 발송
 */
async function sendAlertEmail(
  alert: Alert,
  to: string
): Promise<{ success: boolean; error?: string }> {
  if (alert.type === 'anomaly_spike') {
    const anomaly = alert as AnomalyAlert;
    return sendAnomalyAlertEmail({
      to,
      tenantName: anomaly.tenantName,
      todayCost: anomaly.actualValue,
      yesterdayCost: anomaly.previousValue,
      increaseRatio: anomaly.increaseRatio,
    });
  }

  // 예산 알림
  const budget = alert as BudgetAlert;
  const alertType =
    alert.type === 'budget_exceeded'
      ? 'exceeded'
      : alert.type === 'budget_critical'
        ? 'critical'
        : 'warning';

  return sendBudgetAlertEmail({
    to,
    tenantName: budget.tenantName,
    alertType,
    currentUsage: budget.currentUsage,
    budgetLimit: budget.budgetLimit,
    percentUsed: budget.percentUsed,
  });
}

/**
 * Slack Webhook URL 조회
 */
async function getSlackWebhookUrl(): Promise<string | null> {
  // 환경 변수 우선
  if (process.env.SLACK_WEBHOOK_URL) {
    return process.env.SLACK_WEBHOOK_URL;
  }

  // DB에서 조회
  try {
    const [settings] = await db.select().from(slackAlertSettings).limit(1);
    return settings?.webhookUrl || null;
  } catch {
    return null;
  }
}

/**
 * 알림 이력 저장
 */
async function saveAlertHistory(
  alert: Alert,
  result: { emailSent: boolean; slackSent: boolean; errors: string[] }
): Promise<void> {
  try {
    const channels: string[] = [];
    if (result.emailSent) channels.push('email');
    if (result.slackSent) channels.push('slack');

    await db.insert(usageAlerts).values({
      tenantId: alert.tenantId,
      alertType: alert.type,
      alertChannel: channels.join(',') || 'none',
      threshold: alert.threshold,
      actualValue: alert.actualValue,
      message: alert.message,
      sentAt: new Date(),
      acknowledged: false,
    });
  } catch (error) {
    console.error('[ALERT] Failed to save alert history:', error);
  }
}

/**
 * 여러 알림 일괄 발송
 */
export async function sendAlerts(
  alerts: Alert[],
  options: { channel?: AlertChannel } = {}
): Promise<{ total: number; success: number; failed: number }> {
  let success = 0;
  let failed = 0;

  for (const alert of alerts) {
    const result = await sendAlert(alert, options);
    if (result.success) {
      success++;
    } else {
      failed++;
    }
  }

  return { total: alerts.length, success, failed };
}

/**
 * 중복 알림 방지를 위한 최근 알림 확인
 */
export async function hasRecentAlert(
  tenantId: string,
  alertType: string,
  withinHours: number = 24
): Promise<boolean> {
  try {
    const cutoff = new Date(Date.now() - withinHours * 60 * 60 * 1000);

    const [recent] = await db
      .select({ id: usageAlerts.id })
      .from(usageAlerts)
      .where(
        and(
          eq(usageAlerts.tenantId, tenantId),
          eq(usageAlerts.alertType, alertType),
          gte(usageAlerts.sentAt, cutoff)
        )
      )
      .limit(1);

    return !!recent;
  } catch {
    return false;
  }
}
