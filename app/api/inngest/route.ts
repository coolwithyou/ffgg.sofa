/**
 * Inngest API 라우트
 * Inngest 서버와 통신하는 엔드포인트
 */

import { serve } from 'inngest/next';
import { inngest } from '@/inngest/client';
import { processDocument, sendNotification } from '@/inngest/functions';

// Inngest 함수들을 서빙
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [processDocument, sendNotification],
});
