/**
 * 알림 시스템 타입 정의
 */

export type AlertType = 'budget_warning' | 'budget_critical' | 'budget_exceeded' | 'anomaly_spike';

export type AlertSeverity = 'info' | 'warning' | 'critical';

export type AlertChannel = 'email' | 'slack' | 'both';

export interface Alert {
  id?: string;
  tenantId: string;
  tenantName: string;
  type: AlertType;
  severity: AlertSeverity;
  threshold: number;
  actualValue: number;
  message: string;
  details?: Record<string, unknown>;
  createdAt: Date;
}

export interface BudgetAlert extends Alert {
  type: 'budget_warning' | 'budget_critical' | 'budget_exceeded';
  budgetLimit: number;
  currentUsage: number;
  percentUsed: number;
}

export interface AnomalyAlert extends Alert {
  type: 'anomaly_spike';
  previousValue: number;
  increaseRatio: number;
}

export interface AlertSettings {
  emailRecipients: string[];
  slackWebhookUrl?: string;
  enableBudgetAlerts: boolean;
  enableAnomalyAlerts: boolean;
  budgetWarningThreshold: number; // default: 80
  budgetCriticalThreshold: number; // default: 90
  anomalySpikeThreshold: number; // default: 200 (200% increase)
}

export const DEFAULT_ALERT_SETTINGS: AlertSettings = {
  emailRecipients: [],
  enableBudgetAlerts: true,
  enableAnomalyAlerts: true,
  budgetWarningThreshold: 80,
  budgetCriticalThreshold: 90,
  anomalySpikeThreshold: 200,
};

export const ALERT_SEVERITY_MAP: Record<AlertType, AlertSeverity> = {
  budget_warning: 'warning',
  budget_critical: 'critical',
  budget_exceeded: 'critical',
  anomaly_spike: 'warning',
};

export const ALERT_MESSAGES: Record<AlertType, (data: Record<string, unknown>) => string> = {
  budget_warning: (data) =>
    `예산 ${data.percentUsed}% 사용: $${data.currentUsage} / $${data.budgetLimit}`,
  budget_critical: (data) =>
    `⚠️ 예산 ${data.percentUsed}% 사용 (위험): $${data.currentUsage} / $${data.budgetLimit}`,
  budget_exceeded: (data) =>
    `🚨 예산 초과! $${data.currentUsage} / $${data.budgetLimit} (${data.percentUsed}%)`,
  anomaly_spike: (data) =>
    `📈 비정상 사용량 감지: 전일 대비 ${data.increaseRatio}% 증가`,
};

export const ALERT_CONFIG: Record<AlertType, { label: string; severity: AlertSeverity }> = {
  budget_warning: { label: '예산 경고', severity: 'warning' },
  budget_critical: { label: '예산 위험', severity: 'critical' },
  budget_exceeded: { label: '예산 초과', severity: 'critical' },
  anomaly_spike: { label: '이상 급증', severity: 'warning' },
};
