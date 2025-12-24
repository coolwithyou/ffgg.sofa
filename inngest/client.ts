/**
 * Inngest 클라이언트 설정
 * 비동기 작업 큐 및 워크플로우 관리
 */

import { Inngest } from 'inngest';

// Inngest 클라이언트 생성
export const inngest = new Inngest({
  id: 'sofa-rag-chatbot',
  name: 'SOFA RAG Chatbot',
});

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
