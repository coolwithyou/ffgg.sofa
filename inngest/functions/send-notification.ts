/**
 * 알림 발송 함수
 * 이메일 및 기타 알림 채널 처리
 */

import { inngest } from '../client';
import { logger } from '@/lib/logger';

/**
 * HTML 특수문자 이스케이프 (XSS 방지)
 */
function escapeHtml(text: string): string {
  const htmlEntities: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };
  return text.replace(/[&<>"']/g, (char) => htmlEntities[char] || char);
}

export const sendNotification = inngest.createFunction(
  {
    id: 'send-notification',
    retries: 2,
  },
  { event: 'notification/send' },
  async ({ event }) => {
    const { type, tenantId, documentId, message, recipientEmail } = event.data;

    logger.info('Sending notification', {
      type,
      tenantId,
      documentId,
      recipientEmail,
    });

    try {
      switch (type) {
        case 'review_needed':
          await sendReviewNotification(tenantId, documentId, message, recipientEmail);
          break;

        case 'processing_complete':
          await sendCompletionNotification(tenantId, documentId, message, recipientEmail);
          break;

        case 'processing_failed':
          await sendFailureNotification(tenantId, documentId, message, recipientEmail);
          break;

        default:
          logger.warn('Unknown notification type', { type });
      }

      return { success: true, type };
    } catch (error) {
      logger.error('Notification sending failed', undefined, {
        notificationType: type,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }
);

/**
 * 검토 필요 알림
 */
async function sendReviewNotification(
  tenantId: string,
  documentId: string | undefined,
  message: string,
  recipientEmail?: string
) {
  // Resend API를 사용한 이메일 발송
  if (process.env.RESEND_API_KEY && recipientEmail) {
    const { Resend } = await import('resend');
    const resend = new Resend(process.env.RESEND_API_KEY);

    await resend.emails.send({
      from: process.env.EMAIL_FROM || 'noreply@sofa.app',
      to: recipientEmail,
      subject: '[SOFA] 문서 검토 요청',
      html: `
        <h2>문서 검토가 필요합니다</h2>
        <p>${escapeHtml(message)}</p>
        <p>
          <a href="${process.env.NEXT_PUBLIC_APP_URL}/admin/chunks?document=${escapeHtml(documentId || '')}">
            검토 페이지로 이동
          </a>
        </p>
      `,
    });

    logger.info('Review notification email sent', { recipientEmail });
  } else {
    // 개발 환경에서는 로그만 출력
    logger.info('Review notification (dev mode)', {
      tenantId,
      documentId,
      message,
    });
  }
}

/**
 * 처리 완료 알림
 */
async function sendCompletionNotification(
  tenantId: string,
  documentId: string | undefined,
  message: string,
  recipientEmail?: string
) {
  if (process.env.RESEND_API_KEY && recipientEmail) {
    const { Resend } = await import('resend');
    const resend = new Resend(process.env.RESEND_API_KEY);

    await resend.emails.send({
      from: process.env.EMAIL_FROM || 'noreply@sofa.app',
      to: recipientEmail,
      subject: '[SOFA] 문서 처리 완료',
      html: `
        <h2>문서 처리가 완료되었습니다</h2>
        <p>${escapeHtml(message)}</p>
        <p>
          <a href="${process.env.NEXT_PUBLIC_APP_URL}/documents/${escapeHtml(documentId || '')}">
            문서 상세 보기
          </a>
        </p>
      `,
    });
  } else {
    logger.info('Completion notification (dev mode)', {
      tenantId,
      documentId,
      message,
    });
  }
}

/**
 * 처리 실패 알림
 */
async function sendFailureNotification(
  tenantId: string,
  documentId: string | undefined,
  message: string,
  recipientEmail?: string
) {
  if (process.env.RESEND_API_KEY && recipientEmail) {
    const { Resend } = await import('resend');
    const resend = new Resend(process.env.RESEND_API_KEY);

    await resend.emails.send({
      from: process.env.EMAIL_FROM || 'noreply@sofa.app',
      to: recipientEmail,
      subject: '[SOFA] 문서 처리 실패',
      html: `
        <h2>문서 처리 중 오류가 발생했습니다</h2>
        <p>${escapeHtml(message)}</p>
        <p>문제가 지속되면 관리자에게 문의하세요.</p>
      `,
    });
  } else {
    logger.info('Failure notification (dev mode)', {
      tenantId,
      documentId,
      message,
    });
  }
}
