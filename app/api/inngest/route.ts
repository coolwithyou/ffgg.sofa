/**
 * Inngest API 라우트
 * Inngest 서버와 통신하는 엔드포인트
 */

import { serve } from 'inngest/next';
import { inngestClient } from '@/inngest/client';
import {
  processDocument,
  sendNotification,
  // 빌링 함수
  processRecurringPayment,
  retryFailedPayment,
  handleSubscriptionExpired,
  handlePaymentCompleted,
  // 계정 관리 함수
  processScheduledDeletions,
} from '@/inngest/functions';

// Inngest 함수들을 서빙 (실제 클라이언트 사용)
export const { GET, POST, PUT } = serve({
  client: inngestClient,
  functions: [
    // 문서 처리
    processDocument,
    sendNotification,
    // 빌링
    processRecurringPayment,
    retryFailedPayment,
    handleSubscriptionExpired,
    handlePaymentCompleted,
    // 계정 관리
    processScheduledDeletions,
  ],
});
