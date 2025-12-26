/**
 * 문서 처리 파이프라인
 * 업로드된 문서를 파싱 → 청킹 → 임베딩 → 저장
 */

import { inngestClient } from '../client';
import { db, documents, chunks } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { parseDocument, type SupportedFileType } from '@/lib/parsers';
import { smartChunk } from '@/lib/rag/chunking';
import { embedTexts } from '@/lib/rag/embedding';
import { logger } from '@/lib/logger';
import { getFileFromStorage } from '@/lib/upload/storage';
import {
  logDocumentProcessing,
  clearDocumentLogs,
} from '@/lib/document-log';

export const processDocument = inngestClient.createFunction(
  {
    id: 'process-document',
    retries: 3,
onFailure: async ({ event, error }) => {
      // onFailure 이벤트에서 원본 이벤트 데이터는 event.data.event.data에 있음
      const failureEvent = event as unknown as {
        data: {
          event: {
            data: {
              documentId: string;
              tenantId: string;
              filename: string;
            };
          };
        };
      };

      const originalData = failureEvent.data.event?.data;
      if (!originalData?.documentId || !originalData?.tenantId) {
        logger.error('onFailure: Missing document data', { event: JSON.stringify(event) });
        return;
      }

      const { documentId, tenantId } = originalData;

      // 실패 로그 기록
      try {
        await logDocumentProcessing({
          documentId,
          tenantId,
          step: 'failed',
          status: 'failed',
          message: '문서 처리 최종 실패',
          errorMessage: error.message,
          errorStack: error.stack,
        });
      } catch (logError) {
        logger.error('Failed to log document failure', logError as Error);
      }

      // 문서 상태를 실패로 업데이트
      await db
        .update(documents)
        .set({
          status: 'failed',
          errorMessage: error.message,
          updatedAt: new Date(),
        })
        .where(eq(documents.id, documentId));
    },
  },
  { event: 'document/uploaded' },
  async ({ event, step }) => {
    const { documentId, tenantId, filename, fileType, filePath } = event.data;
    const processingStartTime = Date.now();

    // 이전 로그 삭제 (재처리 시)
    await clearDocumentLogs(documentId);

    // 처리 시작 로그
    await logDocumentProcessing({
      documentId,
      tenantId,
      step: 'started',
      status: 'started',
      message: `문서 처리 시작: ${filename}`,
      details: { filename, fileType },
    });

    // Step 1: 문서 상태 업데이트
    await step.run('initialize-processing', async () => {
      await updateDocumentProgress(documentId, 'parsing', 0);
      return { initialized: true };
    });

    // Step 2: 문서 파싱 (파일 다운로드 포함)
    const parseResult = await step.run('parse-document', async () => {
      const stepStartTime = Date.now();
      await updateDocumentProgress(documentId, 'parsing', 30);

      // 파일 다운로드 - step 내에서 직접 수행 (직렬화 문제 회피)
      const fileBuffer = await getFileFromStorage(filePath, tenantId);
      const result = await parseDocument(
        fileBuffer,
        fileType as SupportedFileType
      );

      await updateDocumentProgress(documentId, 'parsing', 100);

      // 파싱 완료 로그
      await logDocumentProcessing({
        documentId,
        tenantId,
        step: 'parsing',
        status: 'completed',
        message: '문서 파싱 완료',
        details: { textLength: result.text.length },
        durationMs: Date.now() - stepStartTime,
      });

      return result;
    });

    // Step 3: 스마트 청킹
    const chunkResults = await step.run('chunk-document', async () => {
      const stepStartTime = Date.now();
      await updateDocumentProgress(documentId, 'chunking', 0);

      const chunksData = await smartChunk(parseResult.text, {
        maxChunkSize: 500,
        overlap: 50,
        preserveStructure: true,
      });

      await updateDocumentProgress(documentId, 'chunking', 100);

      // 청킹 완료 로그
      await logDocumentProcessing({
        documentId,
        tenantId,
        step: 'chunking',
        status: 'completed',
        message: '청크 분할 완료',
        details: { chunkCount: chunksData.length },
        durationMs: Date.now() - stepStartTime,
      });

      return chunksData;
    });

    // Step 4: 임베딩 생성 (배치 처리)
    const embeddings = await step.run('generate-embeddings', async () => {
      const stepStartTime = Date.now();
      await updateDocumentProgress(documentId, 'embedding', 0);

      const texts = chunkResults.map((chunk) => chunk.content);
      const embeddingVectors = await embedTexts(texts);

      await updateDocumentProgress(documentId, 'embedding', 100);

      // 임베딩 완료 로그
      await logDocumentProcessing({
        documentId,
        tenantId,
        step: 'embedding',
        status: 'completed',
        message: '임베딩 생성 완료',
        details: { embeddingCount: embeddingVectors.length },
        durationMs: Date.now() - stepStartTime,
      });

      return embeddingVectors;
    });

    // Step 5: 청크 저장 (트랜잭션 사용)
    await step.run('save-chunks', async () => {
      const stepStartTime = Date.now();
      await updateDocumentProgress(documentId, 'quality_check', 0);

      const chunkRecords = chunkResults.map((chunk, index) => ({
        tenantId,
        documentId,
        content: chunk.content,
        embedding: embeddings[index],
        chunkIndex: chunk.index,
        qualityScore: chunk.qualityScore,
        status: chunk.qualityScore >= 85 ? 'approved' : 'pending',
        autoApproved: chunk.qualityScore >= 85,
        metadata: chunk.metadata,
      }));

      // 배치 삽입 (neon-http는 트랜잭션 미지원)
      const BATCH_SIZE = 100;
      for (let i = 0; i < chunkRecords.length; i += BATCH_SIZE) {
        const batch = chunkRecords.slice(i, i + BATCH_SIZE);
        await db.insert(chunks).values(batch);
      }

      // 트랜잭션 완료 후 진행 상태 업데이트
      await updateDocumentProgress(documentId, 'quality_check', 100);

      const autoApprovedCount = chunkRecords.filter((c) => c.autoApproved).length;
      const avgQualityScore =
        chunkResults.reduce((sum, c) => sum + c.qualityScore, 0) / chunkResults.length;

      // 품질 검사 완료 로그
      await logDocumentProcessing({
        documentId,
        tenantId,
        step: 'quality_check',
        status: 'completed',
        message: '품질 검사 및 저장 완료',
        details: {
          totalChunks: chunkRecords.length,
          autoApproved: autoApprovedCount,
          pendingReview: chunkRecords.length - autoApprovedCount,
          avgQualityScore: Math.round(avgQualityScore * 10) / 10,
        },
        durationMs: Date.now() - stepStartTime,
      });
    });

    // Step 6: 문서 상태 업데이트
    await step.run('update-status', async () => {
      // 자동 승인되지 않은 청크가 있는지 확인
      const pendingChunks = chunkResults.filter((c) => c.qualityScore < 85);
      const status = pendingChunks.length > 0 ? 'reviewing' : 'approved';

      await db
        .update(documents)
        .set({
          status,
          progressStep: null,
          progressPercent: 100,
          updatedAt: new Date(),
        })
        .where(eq(documents.id, documentId));

      // 처리 완료 로그
      const totalDurationMs = Date.now() - processingStartTime;
      await logDocumentProcessing({
        documentId,
        tenantId,
        step: 'completed',
        status: 'completed',
        message: `문서 처리 완료 (${status === 'approved' ? '자동 승인' : '검토 필요'})`,
        details: {
          finalStatus: status,
          totalChunks: chunkResults.length,
          pendingReview: pendingChunks.length,
          totalDurationMs,
        },
        durationMs: totalDurationMs,
      });
    });

    // Step 7: 관리자 알림 (검토 필요 시)
    const pendingCount = chunkResults.filter((c) => c.qualityScore < 85).length;
    if (pendingCount > 0) {
      await step.sendEvent('notify-admin', {
        name: 'notification/send',
        data: {
          type: 'review_needed',
          tenantId,
          documentId,
          message: `문서 "${filename}"의 ${pendingCount}개 청크가 검토 대기 중입니다.`,
        },
      });
    }

    return {
      success: true,
      documentId,
      chunkCount: chunkResults.length,
      autoApproved: chunkResults.filter((c) => c.qualityScore >= 85).length,
      pendingReview: pendingCount,
    };
  }
);

/**
 * 문서 처리 진행 상태 업데이트
 */
async function updateDocumentProgress(
  documentId: string,
  step: 'parsing' | 'chunking' | 'embedding' | 'quality_check',
  progress: number
) {
  await db
    .update(documents)
    .set({
      status: 'processing',
      progressStep: step,
      progressPercent: progress,
      updatedAt: new Date(),
    })
    .where(eq(documents.id, documentId));
}
