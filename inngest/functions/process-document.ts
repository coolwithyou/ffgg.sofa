/**
 * 문서 처리 파이프라인
 * 업로드된 문서를 파싱 → 청킹 → 임베딩 → 저장
 */

import { inngest } from '../client';
import { db, documents, chunks } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { parseDocument, type SupportedFileType } from '@/lib/parsers';
import { smartChunk } from '@/lib/rag/chunking';
import { embedTexts } from '@/lib/rag/embedding';
import { logger } from '@/lib/logger';
import { getFileFromStorage } from '@/lib/upload/storage';

export const processDocument = inngest.createFunction(
  {
    id: 'process-document',
    retries: 3,
onFailure: async ({ event, error }) => {
      const eventData = (event as unknown as { data: { documentId: string } }).data;
      logger.error('Document processing failed permanently', undefined, {
        documentId: eventData.documentId,
        errorMessage: error.message,
      });

      // 문서 상태를 실패로 업데이트
      await db
        .update(documents)
        .set({
          status: 'failed',
          errorMessage: error.message,
          updatedAt: new Date(),
        })
        .where(eq(documents.id, eventData.documentId));
    },
  },
  { event: 'document/uploaded' },
  async ({ event, step }) => {
    const { documentId, tenantId, filename, fileType, filePath } = event.data;

    logger.info('Starting document processing', {
      documentId,
      tenantId,
      filename,
    });

    // Step 1: 문서 상태 업데이트 및 파일 다운로드
    const fileBufferData = await step.run('download-file', async () => {
      await updateDocumentProgress(documentId, 'parsing', 0);
      // tenantId를 전달하여 테넌트 격리 검증
      const buffer = await getFileFromStorage(filePath, tenantId);
      // Inngest step serialization을 위해 배열로 변환
      return Array.from(buffer);
    });

    // Step 2: 문서 파싱
    const parseResult = await step.run('parse-document', async () => {
      await updateDocumentProgress(documentId, 'parsing', 30);

      // 배열에서 Buffer로 복원
      const fileBuffer = Buffer.from(fileBufferData);
      const result = await parseDocument(
        fileBuffer,
        fileType as SupportedFileType
      );

      await updateDocumentProgress(documentId, 'parsing', 100);

      logger.info('Document parsed', {
        documentId,
        textLength: result.text.length,
      });

      return result;
    });

    // Step 3: 스마트 청킹
    const chunkResults = await step.run('chunk-document', async () => {
      await updateDocumentProgress(documentId, 'chunking', 0);

      const chunksData = await smartChunk(parseResult.text, {
        maxChunkSize: 500,
        overlap: 50,
        preserveStructure: true,
      });

      await updateDocumentProgress(documentId, 'chunking', 100);

      logger.info('Document chunked', {
        documentId,
        chunkCount: chunksData.length,
      });

      return chunksData;
    });

    // Step 4: 임베딩 생성 (배치 처리)
    const embeddings = await step.run('generate-embeddings', async () => {
      await updateDocumentProgress(documentId, 'embedding', 0);

      const texts = chunkResults.map((chunk) => chunk.content);
      const embeddingVectors = await embedTexts(texts);

      await updateDocumentProgress(documentId, 'embedding', 100);

      logger.info('Embeddings generated', {
        documentId,
        count: embeddingVectors.length,
      });

      return embeddingVectors;
    });

    // Step 5: 청크 저장 (트랜잭션 사용)
    await step.run('save-chunks', async () => {
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

      // 트랜잭션으로 배치 삽입 (중간 실패 시 전체 롤백)
      await db.transaction(async (tx) => {
        const BATCH_SIZE = 100;
        for (let i = 0; i < chunkRecords.length; i += BATCH_SIZE) {
          const batch = chunkRecords.slice(i, i + BATCH_SIZE);
          await tx.insert(chunks).values(batch);
        }
      });

      // 트랜잭션 완료 후 진행 상태 업데이트
      await updateDocumentProgress(documentId, 'quality_check', 100);

      logger.info('Chunks saved', {
        documentId,
        count: chunkRecords.length,
        autoApproved: chunkRecords.filter((c) => c.autoApproved).length,
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

      logger.info('Document processing completed', {
        documentId,
        status,
        totalChunks: chunkResults.length,
        pendingChunks: pendingChunks.length,
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
