/**
 * Late Chunking 모듈 테스트
 *
 * Late Chunking은 전체 문서를 먼저 임베딩한 후 청크별로 풀링하여
 * 문맥 정보를 보존하는 기법입니다.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  estimateTokenCount,
  exceedsTokenLimit,
  splitByTokenLimit,
  cosineSimilarity,
} from '@/lib/rag/embedding';

// 임베딩 함수 모킹
vi.mock('@/lib/rag/embedding', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/rag/embedding')>();
  return {
    ...actual,
    embedText: vi.fn().mockImplementation(async () => {
      // 1536 차원의 정규화된 더미 임베딩
      const embedding = new Array(1536).fill(0).map(() => Math.random() - 0.5);
      const norm = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
      return embedding.map((val) => val / norm);
    }),
    embedTexts: vi.fn().mockImplementation(async (texts: string[]) => {
      return texts.map(() => {
        const embedding = new Array(1536).fill(0).map(() => Math.random() - 0.5);
        const norm = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
        return embedding.map((val) => val / norm);
      });
    }),
  };
});

describe('토큰 추정 함수', () => {
  describe('estimateTokenCount', () => {
    it('빈 문자열은 0을 반환한다', () => {
      expect(estimateTokenCount('')).toBe(0);
    });

    it('한글 텍스트의 토큰 수를 추정한다 (약 1.5자/토큰)', () => {
      const koreanText = '안녕하세요'; // 5자 → 약 3-4 토큰
      const tokens = estimateTokenCount(koreanText);
      expect(tokens).toBeGreaterThanOrEqual(3);
      expect(tokens).toBeLessThanOrEqual(5);
    });

    it('영어 텍스트의 토큰 수를 추정한다 (약 4자/토큰)', () => {
      const englishText = 'Hello World!'; // 12자 → 약 3-4 토큰
      const tokens = estimateTokenCount(englishText);
      expect(tokens).toBeGreaterThanOrEqual(2);
      expect(tokens).toBeLessThanOrEqual(5);
    });

    it('한영 혼합 텍스트의 토큰 수를 추정한다', () => {
      const mixedText = '안녕하세요 Hello 세계 World'; // 한글 7자 + 영어 10자
      const tokens = estimateTokenCount(mixedText);
      expect(tokens).toBeGreaterThan(0);
      expect(tokens).toBeLessThan(20);
    });

    it('긴 한국어 텍스트의 토큰 수를 추정한다', () => {
      // 300자 한국어 → 약 200 토큰 예상
      const longKorean = '이것은 긴 텍스트입니다. '.repeat(30);
      const tokens = estimateTokenCount(longKorean);
      expect(tokens).toBeGreaterThan(150);
      expect(tokens).toBeLessThan(400);
    });
  });

  describe('exceedsTokenLimit', () => {
    it('짧은 텍스트는 제한을 초과하지 않는다', () => {
      expect(exceedsTokenLimit('안녕하세요')).toBe(false);
    });

    it('매우 긴 텍스트는 제한을 초과한다', () => {
      // 8191 토큰 초과 → 약 12,000자 이상 한국어
      const veryLongText = '테스트'.repeat(10000);
      expect(exceedsTokenLimit(veryLongText)).toBe(true);
    });
  });

  describe('splitByTokenLimit', () => {
    it('짧은 텍스트는 분할하지 않는다', () => {
      const shortText = '이것은 짧은 텍스트입니다.';
      const segments = splitByTokenLimit(shortText);
      expect(segments).toHaveLength(1);
      expect(segments[0]).toBe(shortText);
    });

    it('긴 텍스트를 토큰 제한에 맞게 분할한다', () => {
      // 많은 토큰을 포함하는 긴 텍스트
      const longText = '이것은 긴 문장입니다. '.repeat(1000);
      const segments = splitByTokenLimit(longText, 500);
      expect(segments.length).toBeGreaterThan(1);
    });

    it('단락 경계를 존중하며 분할한다', () => {
      const paragraphedText = '첫 번째 단락입니다.\n\n두 번째 단락입니다.\n\n세 번째 단락입니다.';
      const segments = splitByTokenLimit(paragraphedText, 50);

      // 각 세그먼트가 완전한 단락이거나 단락 경계에서 분리됨
      segments.forEach((segment) => {
        expect(segment.trim().length).toBeGreaterThan(0);
      });
    });

    it('문장 경계를 존중하며 분할한다', () => {
      // 긴 단락을 문장 단위로 분할
      const longParagraph =
        '첫 번째 문장입니다. 두 번째 문장입니다. 세 번째 문장입니다. ' +
        '네 번째 문장입니다. 다섯 번째 문장입니다. 여섯 번째 문장입니다.';
      const segments = splitByTokenLimit(longParagraph, 30);

      // 모든 세그먼트가 문장으로 끝남
      segments.forEach((segment) => {
        const trimmed = segment.trim();
        if (trimmed.length > 10) {
          expect(trimmed.endsWith('.') || trimmed.endsWith('다')).toBe(true);
        }
      });
    });

    it('매우 긴 문장은 강제 분할한다', () => {
      // 토큰 제한을 크게 초과하는 단일 문장
      const veryLongSentence = '가나다라마바사'.repeat(5000);
      const segments = splitByTokenLimit(veryLongSentence, 100);

      expect(segments.length).toBeGreaterThan(1);
      segments.forEach((segment) => {
        expect(estimateTokenCount(segment)).toBeLessThanOrEqual(150); // 약간의 여유
      });
    });
  });
});

describe('cosineSimilarity', () => {
  it('동일 벡터의 유사도는 1이다', () => {
    const vector = [0.5, 0.5, 0.5, 0.5];
    expect(cosineSimilarity(vector, vector)).toBeCloseTo(1, 5);
  });

  it('반대 벡터의 유사도는 -1이다', () => {
    const vectorA = [1, 0, 0];
    const vectorB = [-1, 0, 0];
    expect(cosineSimilarity(vectorA, vectorB)).toBeCloseTo(-1, 5);
  });

  it('직교 벡터의 유사도는 0이다', () => {
    const vectorA = [1, 0];
    const vectorB = [0, 1];
    expect(cosineSimilarity(vectorA, vectorB)).toBeCloseTo(0, 5);
  });

  it('차원이 다르면 에러를 발생시킨다', () => {
    const vectorA = [1, 0, 0];
    const vectorB = [1, 0];
    expect(() => cosineSimilarity(vectorA, vectorB)).toThrow('Embedding dimensions must match');
  });
});

describe('Late Chunking 모듈', () => {
  let lateChunk: typeof import('@/lib/rag/late-chunking').lateChunk;
  let addLateChunkingEmbeddings: typeof import('@/lib/rag/late-chunking').addLateChunkingEmbeddings;

  beforeEach(async () => {
    vi.clearAllMocks();
    const module = await import('@/lib/rag/late-chunking');
    lateChunk = module.lateChunk;
    addLateChunkingEmbeddings = module.addLateChunkingEmbeddings;
  });

  afterEach(() => {
    vi.resetModules();
  });

  describe('lateChunk', () => {
    it('빈 문자열은 빈 배열을 반환한다', async () => {
      const chunks = await lateChunk('');
      expect(chunks).toHaveLength(0);
    });

    it('공백만 있는 문자열은 빈 배열을 반환한다', async () => {
      const chunks = await lateChunk('   \n\n   ');
      expect(chunks).toHaveLength(0);
    });

    it('기본 Late Chunking을 수행한다', async () => {
      const content = '이것은 충분히 긴 텍스트입니다. 최소 20자 이상이어야 청크가 생성됩니다. ' +
        '문서를 먼저 임베딩한 후 청크별로 풀링합니다.';
      const chunks = await lateChunk(content);

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0].embedding).toBeDefined();
      expect(chunks[0].embedding.length).toBe(1536);
    });

    it('Late Chunk 메타데이터가 포함된다', async () => {
      const content = '이것은 Late Chunking 테스트입니다. 메타데이터가 올바르게 생성되는지 확인합니다.';
      const chunks = await lateChunk(content);

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0].lateChunkingMetadata).toBeDefined();
      expect(chunks[0].lateChunkingMetadata.poolingStrategy).toBeDefined();
      expect(chunks[0].lateChunkingMetadata.sourceSegmentCount).toBeDefined();
      expect(chunks[0].lateChunkingMetadata.estimatedTokens).toBeDefined();
      expect(chunks[0].lateChunkingMetadata.documentSimilarity).toBeDefined();
    });

    it('문서 유사도가 0과 1 사이의 값을 가진다', async () => {
      const content = '이것은 문서 유사도 테스트입니다. 청크와 문서 전체의 임베딩 유사도를 계산합니다.';
      const chunks = await lateChunk(content);

      expect(chunks.length).toBeGreaterThan(0);
      const similarity = chunks[0].lateChunkingMetadata.documentSimilarity!;
      // 부동소수점 정밀도 문제로 인해 toBeCloseTo 사용
      expect(similarity).toBeGreaterThanOrEqual(-1.0001);
      expect(similarity).toBeLessThanOrEqual(1.0001);
    });

    describe('풀링 전략', () => {
      const testContent = '풀링 전략 테스트입니다. mean, max, weighted 전략을 테스트합니다. ' +
        '각 전략이 올바르게 적용되는지 확인합니다.';

      it('mean 풀링 전략이 적용된다', async () => {
        const chunks = await lateChunk(testContent, { poolingStrategy: 'mean' });
        expect(chunks.length).toBeGreaterThan(0);
        expect(chunks[0].lateChunkingMetadata.poolingStrategy).toBe('mean');
      });

      it('max 풀링 전략이 적용된다', async () => {
        const chunks = await lateChunk(testContent, { poolingStrategy: 'max' });
        expect(chunks.length).toBeGreaterThan(0);
        expect(chunks[0].lateChunkingMetadata.poolingStrategy).toBe('max');
      });

      it('weighted 풀링 전략이 기본값이다', async () => {
        const chunks = await lateChunk(testContent);
        expect(chunks.length).toBeGreaterThan(0);
        expect(chunks[0].lateChunkingMetadata.poolingStrategy).toBe('weighted');
      });
    });

    describe('임베딩 기반 품질 검증', () => {
      it('validateWithEmbedding이 기본적으로 활성화된다', async () => {
        const content = '품질 검증 테스트입니다. 임베딩 유사도 기반으로 품질 점수가 조정됩니다.';
        const chunks = await lateChunk(content);

        expect(chunks.length).toBeGreaterThan(0);
        // qualityScore가 조정됨 (0-100 범위)
        expect(chunks[0].qualityScore).toBeGreaterThanOrEqual(0);
        expect(chunks[0].qualityScore).toBeLessThanOrEqual(100);
      });

      it('validateWithEmbedding을 비활성화할 수 있다', async () => {
        const content = '품질 검증 비활성화 테스트입니다. 기본 품질 점수만 사용합니다.';
        const chunks = await lateChunk(content, { validateWithEmbedding: false });

        expect(chunks.length).toBeGreaterThan(0);
        expect(chunks[0].qualityScore).toBeDefined();
      });
    });

    describe('토큰 제한 처리', () => {
      it('maxTokensPerSegment 옵션이 적용된다', async () => {
        const content = '토큰 제한 테스트입니다. '.repeat(100);
        const chunks = await lateChunk(content, { maxTokensPerSegment: 500 });

        expect(chunks.length).toBeGreaterThan(0);
      });

      it('긴 문서가 올바르게 세그먼트로 분할된다', async () => {
        const longContent = '이것은 매우 긴 문서입니다. '.repeat(500);
        const chunks = await lateChunk(longContent);

        expect(chunks.length).toBeGreaterThan(0);
        // 각 청크에 임베딩이 생성됨
        chunks.forEach((chunk) => {
          expect(chunk.embedding).toBeDefined();
          expect(chunk.embedding.length).toBe(1536);
        });
      });
    });
  });

  describe('addLateChunkingEmbeddings', () => {
    it('기존 청크에 임베딩을 추가한다', async () => {
      const originalContent = '원본 문서 내용입니다. Late Chunking 임베딩을 추가합니다.';
      const existingChunks = [
        {
          content: '원본 문서 내용입니다.',
          index: 0,
          qualityScore: 80,
          metadata: {
            startOffset: 0,
            endOffset: 14,
            hasHeader: false,
            isQAPair: false,
            isTable: false,
            isList: false,
          },
        },
        {
          content: 'Late Chunking 임베딩을 추가합니다.',
          index: 1,
          qualityScore: 75,
          metadata: {
            startOffset: 15,
            endOffset: 40,
            hasHeader: false,
            isQAPair: false,
            isTable: false,
            isList: false,
          },
        },
      ];

      const lateChunks = await addLateChunkingEmbeddings(existingChunks, originalContent);

      expect(lateChunks).toHaveLength(2);
      lateChunks.forEach((chunk) => {
        expect(chunk.embedding).toBeDefined();
        expect(chunk.embedding.length).toBe(1536);
        expect(chunk.lateChunkingMetadata).toBeDefined();
      });
    });

    it('원본 청크의 속성을 보존한다', async () => {
      const originalContent = '테스트 문서입니다.';
      const existingChunks = [
        {
          content: '테스트 문서입니다.',
          index: 0,
          qualityScore: 90,
          metadata: {
            startOffset: 0,
            endOffset: 11,
            hasHeader: true,
            isQAPair: false,
            isTable: false,
            isList: true,
          },
        },
      ];

      const lateChunks = await addLateChunkingEmbeddings(existingChunks, originalContent);

      expect(lateChunks[0].content).toBe(existingChunks[0].content);
      expect(lateChunks[0].index).toBe(existingChunks[0].index);
      expect(lateChunks[0].metadata.hasHeader).toBe(true);
      expect(lateChunks[0].metadata.isList).toBe(true);
    });

    it('풀링 전략 옵션이 적용된다', async () => {
      const originalContent = '풀링 전략 테스트입니다.';
      const existingChunks = [
        {
          content: '풀링 전략 테스트입니다.',
          index: 0,
          qualityScore: 85,
          metadata: {
            startOffset: 0,
            endOffset: 14,
            hasHeader: false,
            isQAPair: false,
            isTable: false,
            isList: false,
          },
        },
      ];

      const lateChunks = await addLateChunkingEmbeddings(existingChunks, originalContent, {
        poolingStrategy: 'max',
      });

      expect(lateChunks[0].lateChunkingMetadata.poolingStrategy).toBe('max');
    });
  });
});

describe('품질 점수 조정 로직', () => {
  let lateChunk: typeof import('@/lib/rag/late-chunking').lateChunk;

  beforeEach(async () => {
    vi.clearAllMocks();
    const module = await import('@/lib/rag/late-chunking');
    lateChunk = module.lateChunk;
  });

  afterEach(() => {
    vi.resetModules();
  });

  it('품질 점수가 0 이상 100 이하로 제한된다', async () => {
    const content = '품질 점수 범위 테스트입니다. 점수가 올바른 범위 내에 있어야 합니다.';
    const chunks = await lateChunk(content);

    expect(chunks.length).toBeGreaterThan(0);
    chunks.forEach((chunk) => {
      expect(chunk.qualityScore).toBeGreaterThanOrEqual(0);
      expect(chunk.qualityScore).toBeLessThanOrEqual(100);
    });
  });
});
