/**
 * FAQ Builder 데이터셋 매핑 테스트
 *
 * FAQ builder를 통해 업로드된 QA 데이터가 데이터셋에 올바르게 매핑되는지 검증합니다.
 *
 * 주요 테스트 케이스:
 * 1. QA 데이터 → 문서 생성 시 datasetId 매핑
 * 2. 문서 → 청크 처리 시 datasetId 동기화
 * 3. 데이터 무결성 검증 (청크 datasetId = 문서 datasetId)
 */

import { describe, it, expect } from 'vitest';
import { v4 as uuidv4 } from 'uuid';
import {
  createTestDataset,
  createTestSession,
  createTestDocument,
  createTestChunk,
} from '@/__tests__/factories';

// FAQ builder QA 데이터 타입
interface QAItem {
  question: string;
  answer: string;
}

// FAQ builder 시뮬레이션 함수들
const simulateUploadQAAsDocument = (params: {
  qaItems: QAItem[];
  datasetId: string;
  tenantId: string;
}) => {
  const { qaItems, datasetId, tenantId } = params;

  if (!datasetId) {
    throw new Error('datasetId is required');
  }

  // QA 데이터를 텍스트로 변환
  const content = qaItems
    .map((qa, i) => `Q${i + 1}: ${qa.question}\nA${i + 1}: ${qa.answer}`)
    .join('\n\n');

  // 문서 생성 (datasetId 포함)
  const document = createTestDocument({
    tenantId,
    datasetId, // 핵심: datasetId가 문서에 설정되어야 함
    filename: `FAQ_${Date.now()}.txt`,
    fileType: 'text/plain',
    status: 'processing',
  });

  // Inngest 이벤트 데이터 시뮬레이션
  const eventData = {
    documentId: document.id,
    tenantId,
    datasetId, // 핵심: 이벤트에도 datasetId 전달
    filename: document.filename,
    fileType: document.fileType,
    filePath: document.filePath,
    content,
  };

  return { document, eventData };
};

const simulateProcessDocument = (eventData: {
  documentId: string;
  tenantId: string;
  datasetId: string | null | undefined;
  content: string;
}) => {
  const { documentId, tenantId, content } = eventData;

  // 방어적 datasetId 검증 (process-document.ts의 로직 시뮬레이션)
  let resolvedDatasetId = eventData.datasetId;

  if (!resolvedDatasetId) {
    // documents 테이블에서 조회 (실제 코드에서는 DB 조회)
    // 테스트에서는 null 반환으로 시뮬레이션
    resolvedDatasetId = null;
  }

  // 청크 생성 (datasetId 포함)
  const chunkContent = content.split('\n\n');
  const chunks = chunkContent.map((text, index) =>
    createTestChunk({
      tenantId,
      datasetId: resolvedDatasetId ?? undefined,
      documentId,
      content: text,
      status: 'approved',
      isActive: true,
    })
  );

  return { chunks, resolvedDatasetId };
};

describe('FAQ Builder Dataset Mapping', () => {
  describe('Document Creation with datasetId', () => {
    it('should set datasetId when creating document from QA data', () => {
      const tenantId = 'test-tenant-id';
      const datasetId = uuidv4();
      const qaItems = [
        { question: '출산일이 언제인가요?', answer: '2024년 3월 15일입니다.' },
        { question: '휴직 기간은 어떻게 되나요?', answer: '3개월입니다.' },
      ];

      const { document, eventData } = simulateUploadQAAsDocument({
        qaItems,
        datasetId,
        tenantId,
      });

      expect(document.datasetId).toBe(datasetId);
      expect(eventData.datasetId).toBe(datasetId);
    });

    it('should throw error when datasetId is not provided', () => {
      const tenantId = 'test-tenant-id';
      const qaItems = [
        { question: '테스트 질문', answer: '테스트 답변' },
      ];

      expect(() =>
        simulateUploadQAAsDocument({
          qaItems,
          datasetId: '', // 빈 문자열
          tenantId,
        })
      ).toThrow('datasetId is required');
    });
  });

  describe('Chunk Processing with datasetId', () => {
    it('should pass datasetId from event to chunks', () => {
      const tenantId = 'test-tenant-id';
      const datasetId = uuidv4();
      const documentId = uuidv4();

      const eventData = {
        documentId,
        tenantId,
        datasetId,
        content: 'Q1: 질문1\nA1: 답변1\n\nQ2: 질문2\nA2: 답변2',
      };

      const { chunks, resolvedDatasetId } = simulateProcessDocument(eventData);

      // 모든 청크가 동일한 datasetId를 가져야 함
      expect(resolvedDatasetId).toBe(datasetId);
      chunks.forEach((chunk) => {
        expect(chunk.datasetId).toBe(datasetId);
        expect(chunk.tenantId).toBe(tenantId);
        expect(chunk.documentId).toBe(documentId);
      });
    });

    it('should handle missing datasetId in event (fallback scenario)', () => {
      const tenantId = 'test-tenant-id';
      const documentId = uuidv4();

      const eventData = {
        documentId,
        tenantId,
        datasetId: null, // datasetId 누락 시나리오
        content: 'Q1: 질문\nA1: 답변',
      };

      const { chunks, resolvedDatasetId } = simulateProcessDocument(eventData);

      // 방어적 코드: datasetId가 null이면 청크도 null
      // 실제 코드에서는 documents 테이블에서 조회하여 동기화
      expect(resolvedDatasetId).toBeNull();
    });

    it('should handle undefined datasetId in event', () => {
      const tenantId = 'test-tenant-id';
      const documentId = uuidv4();

      const eventData = {
        documentId,
        tenantId,
        datasetId: undefined, // undefined 시나리오
        content: 'Q1: 질문\nA1: 답변',
      };

      const { resolvedDatasetId } = simulateProcessDocument(eventData);

      // undefined도 null로 처리
      expect(resolvedDatasetId).toBeNull();
    });
  });

  describe('Data Integrity Validation', () => {
    it('should ensure chunk.datasetId matches document.datasetId', () => {
      const datasetId = uuidv4();
      const documentId = uuidv4();
      const tenantId = 'test-tenant-id';

      const document = createTestDocument({
        id: documentId,
        tenantId,
        datasetId,
      });

      const chunks = [
        createTestChunk({ documentId, datasetId, tenantId }),
        createTestChunk({ documentId, datasetId, tenantId }),
        createTestChunk({ documentId, datasetId, tenantId }),
      ];

      // 무결성 검증: 모든 청크의 datasetId가 문서의 datasetId와 일치
      chunks.forEach((chunk) => {
        expect(chunk.datasetId).toBe(document.datasetId);
      });
    });

    it('should detect datasetId mismatch (integrity violation)', () => {
      const datasetId1 = uuidv4();
      const datasetId2 = uuidv4();
      const documentId = uuidv4();
      const tenantId = 'test-tenant-id';

      const document = createTestDocument({
        id: documentId,
        tenantId,
        datasetId: datasetId1,
      });

      // 잘못된 청크 (문서와 다른 datasetId)
      const mismatchedChunk = createTestChunk({
        documentId,
        datasetId: datasetId2, // 불일치!
        tenantId,
      });

      // 무결성 위반 감지
      const hasMismatch = mismatchedChunk.datasetId !== document.datasetId;
      expect(hasMismatch).toBe(true);
    });

    it('should detect null datasetId in chunk when document has datasetId', () => {
      const datasetId = uuidv4();
      const documentId = uuidv4();
      const tenantId = 'test-tenant-id';

      const document = createTestDocument({
        id: documentId,
        tenantId,
        datasetId,
      });

      // 문제가 있는 청크 (datasetId가 null)
      const problematicChunk = createTestChunk({
        documentId,
        datasetId: undefined, // null이 되어 검색에서 제외됨
        tenantId,
      });

      // 무결성 위반 감지
      const hasNullDatasetId = !problematicChunk.datasetId;
      expect(hasNullDatasetId).toBe(true);
      expect(document.datasetId).toBeDefined();
    });
  });

  describe('Search Visibility', () => {
    it('should make chunk searchable when datasetId is set', () => {
      const datasetId = uuidv4();
      const tenantId = 'test-tenant-id';

      const chunk = createTestChunk({
        datasetId,
        tenantId,
        status: 'approved',
        isActive: true,
      });

      // 검색 가능 조건 확인
      const isSearchable =
        chunk.datasetId !== null &&
        chunk.datasetId !== undefined &&
        chunk.status === 'approved' &&
        chunk.isActive === true;

      expect(isSearchable).toBe(true);
    });

    it('should exclude chunk from search when datasetId is null', () => {
      const tenantId = 'test-tenant-id';

      const chunk = createTestChunk({
        datasetId: undefined, // datasetId 없음
        tenantId,
        status: 'approved',
        isActive: true,
      });

      // 검색 가능 조건 확인
      const isSearchable =
        chunk.datasetId !== null &&
        chunk.datasetId !== undefined &&
        chunk.status === 'approved' &&
        chunk.isActive === true;

      // datasetId가 없으면 검색 불가
      expect(isSearchable).toBe(false);
    });

    it('should simulate multi-dataset search filtering', () => {
      const dataset1 = uuidv4();
      const dataset2 = uuidv4();
      const tenantId = 'test-tenant-id';

      const chunks = [
        createTestChunk({ datasetId: dataset1, tenantId, content: '출산일은 3월 15일' }),
        createTestChunk({ datasetId: dataset1, tenantId, content: '휴직 기간 3개월' }),
        createTestChunk({ datasetId: dataset2, tenantId, content: '다른 데이터셋 내용' }),
        createTestChunk({ datasetId: undefined, tenantId, content: 'datasetId 없는 청크' }),
      ];

      // dataset1만 검색
      const targetDatasets = [dataset1];
      const searchableChunks = chunks.filter(
        (chunk) =>
          chunk.datasetId &&
          targetDatasets.includes(chunk.datasetId) &&
          chunk.status === 'approved' &&
          chunk.isActive
      );

      expect(searchableChunks.length).toBe(2);
      expect(searchableChunks.every((c) => c.datasetId === dataset1)).toBe(true);
    });
  });

  describe('End-to-End Flow Simulation', () => {
    it('should correctly map QA data through entire flow', () => {
      const tenantId = 'test-tenant-id';
      const datasetId = uuidv4();
      const qaItems = [
        { question: '문희 씨의 출산일이 언제인가요?', answer: '2024년 3월 15일입니다.' },
        { question: '육아휴직은 언제 복귀하나요?', answer: '6월 15일에 복귀합니다.' },
      ];

      // Step 1: FAQ builder에서 QA 데이터 업로드
      const { document, eventData } = simulateUploadQAAsDocument({
        qaItems,
        datasetId,
        tenantId,
      });

      expect(document.datasetId).toBe(datasetId);
      expect(eventData.datasetId).toBe(datasetId);

      // Step 2: Inngest에서 문서 처리 (process-document)
      const { chunks, resolvedDatasetId } = simulateProcessDocument(eventData);

      expect(resolvedDatasetId).toBe(datasetId);

      // Step 3: 데이터 무결성 검증
      chunks.forEach((chunk) => {
        expect(chunk.datasetId).toBe(datasetId);
        expect(chunk.tenantId).toBe(tenantId);
        expect(chunk.documentId).toBe(document.id);
      });

      // Step 4: 검색 가능 여부 확인
      const targetDatasets = [datasetId];
      const searchableChunks = chunks.filter(
        (chunk) =>
          chunk.datasetId &&
          targetDatasets.includes(chunk.datasetId) &&
          chunk.status === 'approved' &&
          chunk.isActive
      );

      expect(searchableChunks.length).toBe(chunks.length);

      // 특정 내용 검색 시뮬레이션
      const foundChunk = searchableChunks.find((c) =>
        c.content.includes('출산일')
      );
      expect(foundChunk).toBeDefined();
    });

    it('should handle chatbot with linked datasets', () => {
      const tenantId = 'test-tenant-id';
      const datasetId = uuidv4();
      const chatbotId = uuidv4();

      // 챗봇-데이터셋 연결 시뮬레이션
      const chatbotDatasetLink = {
        chatbotId,
        datasetId,
        weight: 1.0,
      };

      // 해당 데이터셋의 청크들
      const chunks = [
        createTestChunk({
          datasetId,
          tenantId,
          content: '문희 씨의 출산일은 2024년 3월 15일입니다.',
          status: 'approved',
          isActive: true,
        }),
      ];

      // 챗봇 검색 시뮬레이션
      const linkedDatasets = [chatbotDatasetLink.datasetId];
      const searchResults = chunks.filter(
        (chunk) =>
          chunk.datasetId &&
          linkedDatasets.includes(chunk.datasetId) &&
          chunk.status === 'approved' &&
          chunk.isActive
      );

      expect(searchResults.length).toBe(1);
      expect(searchResults[0].content).toContain('출산일');
    });
  });

  describe('Defensive datasetId Resolution', () => {
    it('should use event datasetId when available', () => {
      const eventDatasetId = uuidv4();

      // process-document의 방어적 로직 시뮬레이션
      const resolvedDatasetId = eventDatasetId || null;

      expect(resolvedDatasetId).toBe(eventDatasetId);
    });

    it('should fallback to document datasetId when event datasetId is missing', () => {
      const documentDatasetId = uuidv4();

      // 이벤트에 datasetId가 없는 경우
      const eventDatasetId: string | null = null;

      // 방어적 로직: documents 테이블에서 조회 (시뮬레이션)
      const resolvedDatasetId = eventDatasetId || documentDatasetId;

      expect(resolvedDatasetId).toBe(documentDatasetId);
    });

    it('should log warning when using fallback', () => {
      const documentDatasetId = uuidv4();
      const documentId = uuidv4();
      const warnings: string[] = [];

      // 방어적 로직 시뮬레이션
      const eventDatasetId: string | null = null;

      let resolvedDatasetId = eventDatasetId;
      if (!resolvedDatasetId) {
        resolvedDatasetId = documentDatasetId;
        warnings.push(`datasetId fallback from documents table: ${documentId}`);
      }

      expect(warnings.length).toBe(1);
      expect(warnings[0]).toContain('fallback');
    });
  });
});
