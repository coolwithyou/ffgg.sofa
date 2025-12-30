/**
 * Slack Webhook 알림 발송
 */

import type { Alert, BudgetAlert, AnomalyAlert, AlertSeverity } from './types';

/**
 * Slack Webhook URL 유효성 검증
 */
function validateWebhookUrl(url: string): { valid: boolean; error?: string } {
  if (!url) {
    return { valid: false, error: 'Webhook URL is empty' };
  }

  // Slack Webhook URL 형식 검증
  const slackWebhookPattern = /^https:\/\/hooks\.slack\.com\/services\/[A-Z0-9]+\/[A-Z0-9]+\/[a-zA-Z0-9]+$/;

  if (!slackWebhookPattern.test(url)) {
    return { valid: false, error: 'Invalid Slack webhook URL format' };
  }

  return { valid: true };
}

interface SlackBlock {
  type: string;
  text?: {
    type: string;
    text: string;
    emoji?: boolean;
  };
  fields?: Array<{
    type: string;
    text: string;
  }>;
  elements?: Array<{
    type: string;
    text: string;
  }>;
}

interface SlackMessage {
  blocks: SlackBlock[];
  attachments?: Array<{
    color: string;
    blocks: SlackBlock[];
  }>;
}

const SEVERITY_COLORS: Record<AlertSeverity, string> = {
  info: '#2196F3',
  warning: '#FF9800',
  critical: '#F44336',
};

const SEVERITY_EMOJIS: Record<AlertSeverity, string> = {
  info: 'ℹ️',
  warning: '⚠️',
  critical: '🚨',
};

/**
 * 예산 알림용 Slack 메시지 생성
 */
function createBudgetAlertMessage(alert: BudgetAlert): SlackMessage {
  const emoji = SEVERITY_EMOJIS[alert.severity];
  const progressBar = createProgressBar(alert.percentUsed);

  return {
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `${emoji} SOFA 예산 알림`,
          emoji: true,
        },
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*테넌트:*\n${alert.tenantName}`,
          },
          {
            type: 'mrkdwn',
            text: `*상태:*\n${getAlertTypeLabel(alert.type)}`,
          },
        ],
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*현재 사용량:* $${alert.currentUsage.toFixed(2)} / $${alert.budgetLimit.toFixed(2)} (${alert.percentUsed.toFixed(1)}%)`,
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: progressBar,
        },
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `발생 시간: ${alert.createdAt.toLocaleString('ko-KR')}`,
          },
        ],
      },
    ],
    attachments: [
      {
        color: SEVERITY_COLORS[alert.severity],
        blocks: [],
      },
    ],
  };
}

/**
 * 이상 탐지 알림용 Slack 메시지 생성
 */
function createAnomalyAlertMessage(alert: AnomalyAlert): SlackMessage {
  return {
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '📈 SOFA 이상 사용량 감지',
          emoji: true,
        },
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*테넌트:*\n${alert.tenantName}`,
          },
          {
            type: 'mrkdwn',
            text: `*증가율:*\n${alert.increaseRatio.toFixed(0)}%`,
          },
        ],
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*어제 비용:*\n$${alert.previousValue.toFixed(2)}`,
          },
          {
            type: 'mrkdwn',
            text: `*오늘 비용:*\n$${alert.actualValue.toFixed(2)}`,
          },
        ],
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `발생 시간: ${alert.createdAt.toLocaleString('ko-KR')}`,
          },
        ],
      },
    ],
    attachments: [
      {
        color: SEVERITY_COLORS.warning,
        blocks: [],
      },
    ],
  };
}

/**
 * Slack 메시지 발송
 */
export async function sendSlackAlert(
  alert: Alert,
  webhookUrl: string
): Promise<{ success: boolean; error?: string }> {
  // 1. URL 유효성 검증
  const urlValidation = validateWebhookUrl(webhookUrl);
  if (!urlValidation.valid) {
    console.error('[Slack] Webhook URL validation failed:', {
      error: urlValidation.error,
      tenantId: alert.tenantId,
      alertType: alert.type,
      timestamp: new Date().toISOString(),
    });
    return { success: false, error: urlValidation.error };
  }

  try {
    let message: SlackMessage;

    if (alert.type === 'anomaly_spike') {
      message = createAnomalyAlertMessage(alert as AnomalyAlert);
    } else {
      message = createBudgetAlertMessage(alert as BudgetAlert);
    }

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Slack] Webhook request failed:', {
        status: response.status,
        error: errorText,
        tenantId: alert.tenantId,
        alertType: alert.type,
        timestamp: new Date().toISOString(),
      });
      return { success: false, error: `HTTP ${response.status}: ${errorText}` };
    }

    console.log('[Slack] Alert sent successfully:', {
      tenantId: alert.tenantId,
      alertType: alert.type,
      timestamp: new Date().toISOString(),
    });

    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[Slack] Failed to send alert:', {
      error: errorMessage,
      tenantId: alert.tenantId,
      alertType: alert.type,
      timestamp: new Date().toISOString(),
    });
    return { success: false, error: errorMessage };
  }
}

/**
 * 진행률 바 생성 (텍스트 기반)
 */
function createProgressBar(percent: number): string {
  const filled = Math.min(Math.round(percent / 5), 20);
  const empty = 20 - filled;
  const bar = '█'.repeat(filled) + '░'.repeat(empty);
  return `\`${bar}\` ${percent.toFixed(1)}%`;
}

/**
 * 알림 타입 레이블
 */
function getAlertTypeLabel(type: string): string {
  switch (type) {
    case 'budget_warning':
      return '예산 경고 (80%)';
    case 'budget_critical':
      return '예산 위험 (90%)';
    case 'budget_exceeded':
      return '예산 초과 (100%)';
    default:
      return type;
  }
}
