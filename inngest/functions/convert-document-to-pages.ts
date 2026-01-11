/**
 * 문서 → Knowledge Pages 변환 파이프라인
 *
 * 업로드된 문서를 LLM을 사용하여 계층적인 Knowledge Pages로 자동 변환합니다.
 *
 * 처리 흐름:
 * 1. 문서 텍스트 파싱
 * 2. LLM으로 구조 분석 → 페이지 트리 JSON 생성
 * 3. 각 페이지별 LLM 콘텐츠 생성
 * 4. Knowledge Pages DB 저장 (Draft 상태)
 */

import { inngestClient } from '../client';
import { db, documents } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { parseDocument, type SupportedFileType } from '@/lib/parsers';
import { getFileFromStorage } from '@/lib/upload/storage';
import { convertDocumentToPages } from '@/lib/knowledge-pages/document-to-pages';
import { logger } from '@/lib/logger';

export const convertDocumentToPagesFunction = inngestClient.createFunction(
  {
    id: 'convert-document-to-pages',
    retries: 2,
    onFailure: async ({ event, error }) => {
      // onFailure 이벤트에서 원본 이벤트 데이터는 event.data.event.data에 있음
      const failureEvent = event as unknown as {
        data: {
          event: {
            data: {
              documentId: string;
              chatbotId: string;
              tenantId: string;
            };
          };
        };
      };

      const originalData = failureEvent.data.event?.data;
      if (!originalData?.documentId) {
        logger.error('[ConvertToPages] onFailure: Missing document data', new Error(JSON.stringify(event)));
        return;
      }

      const { documentId, chatbotId, tenantId } = originalData;

      logger.error('[ConvertToPages] Conversion failed after retries', error, {
        documentId,
        chatbotId,
        tenantId,
      });

      // 알림 이벤트 발송 (실패 알림)
      // TODO: 별도 알림 이벤트로 처리
    },
  },
  { event: 'document/convert-to-pages' },
  async ({ event, step }) => {
    const { documentId, chatbotId, tenantId, options } = event.data;
    const conversionStartTime = Date.now();

    logger.info('[ConvertToPages] Starting conversion', {
      documentId,
      chatbotId,
      tenantId,
      options,
    });

    // Step 1: 문서 정보 조회
    const doc = await step.run('fetch-document', async () => {
      const [document] = await db
        .select()
        .from(documents)
        .where(eq(documents.id, documentId));

      if (!document) {
        throw new Error(`문서를 찾을 수 없습니다: ${documentId}`);
      }

      if (!document.filePath) {
        throw new Error(`문서 파일 경로가 없습니다: ${documentId}`);
      }

      return {
        id: document.id,
        filename: document.filename,
        fileType: document.fileType,
        filePath: document.filePath,
      };
    });

    // Step 2: 파일 다운로드 및 파싱
    const parseResult = await step.run('parse-document', async () => {
      // 파일 다운로드
      let fileBuffer: Buffer;
      try {
        fileBuffer = await getFileFromStorage(doc.filePath, tenantId);
      } catch (storageError) {
        const errMsg = (storageError as Error).message || '';
        if (errMsg.includes('NoSuchKey') || errMsg.includes('not found') || errMsg.includes('ENOENT')) {
          throw new Error(
            `원본 파일을 찾을 수 없습니다. 문서를 다시 업로드해주세요. (파일: ${doc.filename})`
          );
        }
        throw storageError;
      }

      // 문서 파싱
      const result = await parseDocument(
        fileBuffer,
        doc.fileType as SupportedFileType
      );

      logger.info('[ConvertToPages] Document parsed', {
        documentId,
        textLength: result.text.length,
      });

      return result;
    });

    // Step 3: LLM으로 문서 → Knowledge Pages 변환
    const conversionResult = await step.run('convert-to-pages', async () => {
      const result = await convertDocumentToPages(
        parseResult.text,
        {
          chatbotId,
          documentId,
          parentPageId: options?.parentPageId,
        },
        (progress) => {
          // Inngest step 내에서는 진행 상태 업데이트가 어려움
          // 로그로 대체
          logger.debug('[ConvertToPages] Progress', {
            documentId,
            status: progress.status,
            step: progress.currentStep,
            progress: `${progress.completedPages}/${progress.totalPages}`,
          });
        }
      );

      return result;
    });

    const totalDurationMs = Date.now() - conversionStartTime;

    if (conversionResult.success) {
      logger.info('[ConvertToPages] Conversion completed successfully', {
        documentId,
        chatbotId,
        totalPages: conversionResult.totalPageCount,
        durationMs: totalDurationMs,
      });

      return {
        success: true,
        documentId,
        chatbotId,
        totalPages: conversionResult.totalPageCount,
        durationMs: totalDurationMs,
      };
    } else {
      logger.error('[ConvertToPages] Conversion failed', new Error(conversionResult.error), {
        documentId,
        chatbotId,
      });

      throw new Error(conversionResult.error || '문서 변환에 실패했습니다.');
    }
  }
);
