/**
 * Inngest 클라이언트 설정
 * 비동기 작업 큐 및 워크플로우 관리
 *
 * 개발 환경에서 Inngest가 설정되지 않으면 이벤트를 로그만 출력
 */

import { Inngest } from 'inngest';
import { logger } from '@/lib/logger';

/**
 * Inngest가 제대로 설정되어 있는지 확인
 */
function isInngestConfigured(): boolean {
  const eventKey = process.env.INNGEST_EVENT_KEY;
  const signingKey = process.env.INNGEST_SIGNING_KEY;

  // 플레이스홀더 값 체크
  const isPlaceholder = (value: string | undefined) =>
    !value ||
    value.startsWith('your-') ||
    value === 'your-inngest-event-key' ||
    value === 'your-inngest-signing-key';

  return !isPlaceholder(eventKey) && !isPlaceholder(signingKey);
}

// Inngest 클라이언트 생성
const realInngest = new Inngest({
  id: 'sofa-rag-chatbot',
  name: 'SOFA RAG Chatbot',
});

// 개발용 Mock Inngest (이벤트만 로그 출력)
const mockInngest = {
  send: async (event: { name: string; data: Record<string, unknown> }) => {
    logger.info('[DEV] Inngest event skipped (not configured)', {
      eventName: event.name,
      eventData: event.data,
    });
    return { ids: [] };
  },
};

// 설정 여부에 따라 실제 또는 목 클라이언트 사용
export const inngest = isInngestConfigured() ? realInngest : mockInngest;

// 실제 Inngest 클라이언트 (서버 핸들러용)
export const inngestClient = realInngest;

// 이벤트 타입 정의
export interface DocumentUploadedEvent {
  name: 'document/uploaded';
  data: {
    documentId: string;
    tenantId: string;
    userId: string;
    filename: string;
    fileType: string;
    filePath: string;
  };
}

export interface DocumentProcessingEvent {
  name: 'document/processing';
  data: {
    documentId: string;
    tenantId: string;
    step: 'parsing' | 'chunking' | 'embedding' | 'quality_check';
    progress: number;
  };
}

export interface ChunkApprovedEvent {
  name: 'chunk/approved';
  data: {
    chunkId: string;
    tenantId: string;
    documentId: string;
    approvedBy: string;
  };
}

export interface NotificationEvent {
  name: 'notification/send';
  data: {
    type: 'review_needed' | 'processing_complete' | 'processing_failed';
    tenantId: string;
    documentId?: string;
    message: string;
    recipientEmail?: string;
  };
}

// 모든 이벤트 타입
export type InngestEvents =
  | DocumentUploadedEvent
  | DocumentProcessingEvent
  | ChunkApprovedEvent
  | NotificationEvent;
