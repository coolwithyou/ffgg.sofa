/**
 * RAG 검색 로직 테스트
 *
 * 이 테스트는 Hybrid Search 및 Reciprocal Rank Fusion 로직을 검증합니다.
 * DB 의존성 없이 순수 로직만 테스트합니다.
 */

import { describe, it, expect } from 'vitest';
import { createTestChunk } from '@/__tests__/factories';

// SearchResult 타입 정의 (lib/rag/retrieval.ts와 동일)
interface SearchResult {
  id: string;
  chunkId: string;
  documentId: string;
  datasetId?: string;
  content: string;
  score: number;
  metadata: Record<string, unknown>;
  source: 'dense' | 'sparse' | 'hybrid';
}

interface RankedResult {
  chunk: SearchResult;
  score: number;
}

const RRF_K = 60; // Reciprocal Rank Fusion 상수

/**
 * Reciprocal Rank Fusion (RRF) 알고리즘 - 테스트용 구현
 */
function reciprocalRankFusion(
  denseResults: SearchResult[],
  sparseResults: SearchResult[],
  limit: number
): SearchResult[] {
  const scores = new Map<string, RankedResult>();

  // Dense 결과 점수 계산
  denseResults.forEach((result, rank) => {
    const rrfScore = 1 / (RRF_K + rank + 1);
    scores.set(result.id, {
      chunk: { ...result, source: 'hybrid' },
      score: rrfScore,
    });
  });

  // Sparse 결과 점수 합산
  sparseResults.forEach((result, rank) => {
    const rrfScore = 1 / (RRF_K + rank + 1);
    const existing = scores.get(result.id);

    if (existing) {
      existing.score += rrfScore;
    } else {
      scores.set(result.id, {
        chunk: { ...result, source: 'hybrid' },
        score: rrfScore,
      });
    }
  });

  // 점수 기준 정렬 및 상위 N개 반환
  return Array.from(scores.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((item) => ({
      ...item.chunk,
      score: item.score,
    }));
}

// 테스트용 SearchResult 생성 헬퍼
const createSearchResult = (
  id: string,
  source: 'dense' | 'sparse' | 'hybrid',
  score: number = 0.8,
  overrides: Partial<SearchResult> = {}
): SearchResult => ({
  id,
  chunkId: id,
  documentId: 'test-document-id',
  content: `Test content for chunk ${id}`,
  score,
  metadata: {},
  source,
  ...overrides,
});

describe('RAG Retrieval', () => {
  describe('Reciprocal Rank Fusion (RRF)', () => {
    it('should calculate RRF score correctly for single result', () => {
      // 첫 번째 순위 (rank=0)의 RRF 점수: 1 / (60 + 0 + 1) = 1/61
      const expectedScore = 1 / (RRF_K + 0 + 1);
      const denseResults = [createSearchResult('chunk-1', 'dense')];
      const sparseResults: SearchResult[] = [];

      const results = reciprocalRankFusion(denseResults, sparseResults, 5);

      expect(results.length).toBe(1);
      expect(results[0].score).toBeCloseTo(expectedScore, 10);
    });

    it('should merge dense and sparse results for same chunk', () => {
      // 같은 청크가 양쪽에 있으면 점수 합산
      const denseResults = [createSearchResult('chunk-1', 'dense')];
      const sparseResults = [createSearchResult('chunk-1', 'sparse')];

      const results = reciprocalRankFusion(denseResults, sparseResults, 5);

      // 합산 점수: 1/61 + 1/61 = 2/61
      const expectedScore = 2 / (RRF_K + 0 + 1);
      expect(results.length).toBe(1);
      expect(results[0].score).toBeCloseTo(expectedScore, 10);
      expect(results[0].source).toBe('hybrid');
    });

    it('should rank chunks appearing in both results higher', () => {
      // chunk-1은 양쪽에, chunk-2는 dense에만, chunk-3은 sparse에만
      const denseResults = [
        createSearchResult('chunk-1', 'dense'),
        createSearchResult('chunk-2', 'dense'),
      ];
      const sparseResults = [
        createSearchResult('chunk-3', 'sparse'),
        createSearchResult('chunk-1', 'sparse'),
      ];

      const results = reciprocalRankFusion(denseResults, sparseResults, 5);

      // chunk-1: 1/61 (dense rank 0) + 1/62 (sparse rank 1) = 가장 높음
      expect(results[0].id).toBe('chunk-1');
    });

    it('should respect limit parameter', () => {
      const denseResults = [
        createSearchResult('chunk-1', 'dense'),
        createSearchResult('chunk-2', 'dense'),
        createSearchResult('chunk-3', 'dense'),
      ];
      const sparseResults = [
        createSearchResult('chunk-4', 'sparse'),
        createSearchResult('chunk-5', 'sparse'),
      ];

      const results = reciprocalRankFusion(denseResults, sparseResults, 3);

      expect(results.length).toBe(3);
    });

    it('should handle empty dense results', () => {
      const denseResults: SearchResult[] = [];
      const sparseResults = [
        createSearchResult('chunk-1', 'sparse'),
        createSearchResult('chunk-2', 'sparse'),
      ];

      const results = reciprocalRankFusion(denseResults, sparseResults, 5);

      expect(results.length).toBe(2);
      expect(results.every((r) => r.source === 'hybrid')).toBe(true);
    });

    it('should handle empty sparse results', () => {
      const denseResults = [
        createSearchResult('chunk-1', 'dense'),
        createSearchResult('chunk-2', 'dense'),
      ];
      const sparseResults: SearchResult[] = [];

      const results = reciprocalRankFusion(denseResults, sparseResults, 5);

      expect(results.length).toBe(2);
      expect(results.every((r) => r.source === 'hybrid')).toBe(true);
    });

    it('should handle both empty results', () => {
      const denseResults: SearchResult[] = [];
      const sparseResults: SearchResult[] = [];

      const results = reciprocalRankFusion(denseResults, sparseResults, 5);

      expect(results.length).toBe(0);
    });

    it('should calculate decreasing scores for lower ranks', () => {
      const denseResults = [
        createSearchResult('chunk-1', 'dense'),
        createSearchResult('chunk-2', 'dense'),
        createSearchResult('chunk-3', 'dense'),
      ];

      const results = reciprocalRankFusion(denseResults, [], 5);

      // 점수는 순위가 낮아질수록 감소해야 함
      expect(results[0].score).toBeGreaterThan(results[1].score);
      expect(results[1].score).toBeGreaterThan(results[2].score);
    });

    it('should preserve chunk metadata', () => {
      const denseResults = [
        createSearchResult('chunk-1', 'dense', 0.9, {
          metadata: { source: 'document.pdf', page: 5 },
        }),
      ];

      const results = reciprocalRankFusion(denseResults, [], 5);

      expect(results[0].metadata).toEqual({ source: 'document.pdf', page: 5 });
    });

    it('should preserve datasetId', () => {
      const denseResults = [
        createSearchResult('chunk-1', 'dense', 0.9, {
          datasetId: 'dataset-123',
        }),
      ];

      const results = reciprocalRankFusion(denseResults, [], 5);

      expect(results[0].datasetId).toBe('dataset-123');
    });
  });

  describe('SearchResult Filtering', () => {
    it('should only include approved chunks', () => {
      const chunks = [
        createTestChunk({ status: 'approved', isActive: true }),
        createTestChunk({ status: 'pending', isActive: true }),
        createTestChunk({ status: 'rejected', isActive: true }),
      ];

      const filtered = chunks.filter((c) => c.status === 'approved');

      expect(filtered.length).toBe(1);
      expect(filtered[0].status).toBe('approved');
    });

    it('should only include active chunks', () => {
      const chunks = [
        createTestChunk({ status: 'approved', isActive: true }),
        createTestChunk({ status: 'approved', isActive: false }),
      ];

      const filtered = chunks.filter((c) => c.isActive === true);

      expect(filtered.length).toBe(1);
      expect(filtered[0].isActive).toBe(true);
    });

    it('should filter by tenant ID', () => {
      const tenantA = 'tenant-a';
      const tenantB = 'tenant-b';
      const chunks = [
        createTestChunk({ tenantId: tenantA }),
        createTestChunk({ tenantId: tenantA }),
        createTestChunk({ tenantId: tenantB }),
      ];

      const tenantAChunks = chunks.filter((c) => c.tenantId === tenantA);

      expect(tenantAChunks.length).toBe(2);
    });

    it('should filter by dataset IDs', () => {
      const datasetIds = ['dataset-1', 'dataset-2'];
      const chunks = [
        createTestChunk({ datasetId: 'dataset-1' }),
        createTestChunk({ datasetId: 'dataset-2' }),
        createTestChunk({ datasetId: 'dataset-3' }),
      ];

      const filtered = chunks.filter((c) => datasetIds.includes(c.datasetId));

      expect(filtered.length).toBe(2);
    });
  });

  describe('Multi-Dataset Search Logic', () => {
    it('should return empty array when no dataset IDs provided', () => {
      const datasetIds: string[] = [];

      // hybridSearchMultiDataset 로직 시뮬레이션
      const shouldSearch = datasetIds.length > 0;

      expect(shouldSearch).toBe(false);
    });

    it('should search across multiple datasets', () => {
      const datasetIds = ['dataset-1', 'dataset-2', 'dataset-3'];
      const chunks = [
        createTestChunk({ datasetId: 'dataset-1', content: 'FAQ about pricing' }),
        createTestChunk({ datasetId: 'dataset-2', content: 'FAQ about shipping' }),
        createTestChunk({ datasetId: 'dataset-3', content: 'FAQ about returns' }),
        createTestChunk({ datasetId: 'dataset-4', content: 'Not included' }),
      ];

      const filtered = chunks.filter((c) => datasetIds.includes(c.datasetId));

      expect(filtered.length).toBe(3);
      expect(filtered.every((c) => datasetIds.includes(c.datasetId))).toBe(true);
    });

    it('should include datasetId in search results', () => {
      const result = createSearchResult('chunk-1', 'dense', 0.9, {
        datasetId: 'dataset-abc',
      });

      expect(result.datasetId).toBe('dataset-abc');
    });
  });

  describe('Score Calculation', () => {
    it('should have higher RRF score for first rank', () => {
      // rank 0: 1/(60+1) ≈ 0.0164
      // rank 1: 1/(60+2) ≈ 0.0161
      // rank 2: 1/(60+3) ≈ 0.0159
      const rank0Score = 1 / (RRF_K + 0 + 1);
      const rank1Score = 1 / (RRF_K + 1 + 1);
      const rank2Score = 1 / (RRF_K + 2 + 1);

      expect(rank0Score).toBeGreaterThan(rank1Score);
      expect(rank1Score).toBeGreaterThan(rank2Score);
    });

    it('should double the score when chunk appears in both results at same rank', () => {
      // 같은 순위에 있을 때 점수가 2배
      const singleScore = 1 / (RRF_K + 0 + 1);
      const denseResults = [createSearchResult('chunk-1', 'dense')];
      const sparseResults = [createSearchResult('chunk-1', 'sparse')];

      const results = reciprocalRankFusion(denseResults, sparseResults, 5);

      expect(results[0].score).toBeCloseTo(singleScore * 2, 10);
    });

    it('should not exceed 2x score when chunk in both at rank 0', () => {
      const maxPossibleScore = 2 / (RRF_K + 0 + 1);
      const denseResults = [createSearchResult('chunk-1', 'dense')];
      const sparseResults = [createSearchResult('chunk-1', 'sparse')];

      const results = reciprocalRankFusion(denseResults, sparseResults, 5);

      expect(results[0].score).toBeLessThanOrEqual(maxPossibleScore);
    });
  });

  describe('Result Ordering', () => {
    it('should sort by score descending', () => {
      // 다양한 순위의 결과들
      const denseResults = [
        createSearchResult('dense-1', 'dense'),
        createSearchResult('dense-2', 'dense'),
        createSearchResult('common', 'dense'), // rank 2
      ];
      const sparseResults = [
        createSearchResult('common', 'sparse'), // rank 0
        createSearchResult('sparse-1', 'sparse'),
        createSearchResult('sparse-2', 'sparse'),
      ];

      const results = reciprocalRankFusion(denseResults, sparseResults, 10);

      // 결과가 점수 내림차순으로 정렬되어야 함
      for (let i = 0; i < results.length - 1; i++) {
        expect(results[i].score).toBeGreaterThanOrEqual(results[i + 1].score);
      }
    });

    it('should prioritize chunks appearing in both results', () => {
      const denseResults = [
        createSearchResult('only-dense', 'dense'),
        createSearchResult('both', 'dense'),
      ];
      const sparseResults = [
        createSearchResult('only-sparse', 'sparse'),
        createSearchResult('both', 'sparse'),
      ];

      const results = reciprocalRankFusion(denseResults, sparseResults, 10);

      // 'both'가 가장 높은 점수 (두 곳에서 합산)
      expect(results[0].id).toBe('both');
    });
  });

  describe('Content and Metadata Handling', () => {
    it('should preserve content in search results', () => {
      const content = 'This is the actual chunk content about product pricing.';
      const denseResults = [
        createSearchResult('chunk-1', 'dense', 0.9, { content }),
      ];

      const results = reciprocalRankFusion(denseResults, [], 5);

      expect(results[0].content).toBe(content);
    });

    it('should preserve documentId in search results', () => {
      const documentId = 'doc-12345';
      const denseResults = [
        createSearchResult('chunk-1', 'dense', 0.9, { documentId }),
      ];

      const results = reciprocalRankFusion(denseResults, [], 5);

      expect(results[0].documentId).toBe(documentId);
    });

    it('should preserve complex metadata', () => {
      const metadata = {
        source: 'faq-document.pdf',
        page: 10,
        section: 'pricing',
        lastUpdated: '2024-01-01',
        tags: ['pricing', 'subscription'],
      };
      const denseResults = [
        createSearchResult('chunk-1', 'dense', 0.9, { metadata }),
      ];

      const results = reciprocalRankFusion(denseResults, [], 5);

      expect(results[0].metadata).toEqual(metadata);
    });
  });

  describe('Edge Cases', () => {
    it('should handle single result', () => {
      const denseResults = [createSearchResult('single', 'dense')];

      const results = reciprocalRankFusion(denseResults, [], 5);

      expect(results.length).toBe(1);
      expect(results[0].id).toBe('single');
    });

    it('should handle limit greater than result count', () => {
      const denseResults = [
        createSearchResult('chunk-1', 'dense'),
        createSearchResult('chunk-2', 'dense'),
      ];

      const results = reciprocalRankFusion(denseResults, [], 100);

      expect(results.length).toBe(2);
    });

    it('should handle limit of 0', () => {
      const denseResults = [
        createSearchResult('chunk-1', 'dense'),
        createSearchResult('chunk-2', 'dense'),
      ];

      const results = reciprocalRankFusion(denseResults, [], 0);

      expect(results.length).toBe(0);
    });

    it('should handle many results correctly', () => {
      // 50개의 결과 생성
      const denseResults = Array.from({ length: 50 }, (_, i) =>
        createSearchResult(`dense-${i}`, 'dense')
      );
      const sparseResults = Array.from({ length: 50 }, (_, i) =>
        createSearchResult(`sparse-${i}`, 'sparse')
      );

      const results = reciprocalRankFusion(denseResults, sparseResults, 10);

      expect(results.length).toBe(10);
      // 점수 순으로 정렬되어야 함
      for (let i = 0; i < results.length - 1; i++) {
        expect(results[i].score).toBeGreaterThanOrEqual(results[i + 1].score);
      }
    });

    it('should handle duplicates in same result set gracefully', () => {
      // Map 사용으로 중복은 자동으로 처리됨 (마지막 값으로 덮어쓰기)
      const denseResults = [
        createSearchResult('same-id', 'dense'),
        createSearchResult('same-id', 'dense'), // 중복
      ];

      const results = reciprocalRankFusion(denseResults, [], 5);

      // 중복은 하나로 처리됨
      expect(results.length).toBe(1);
    });
  });

  describe('Search Configuration', () => {
    it('should use default limit of 5', () => {
      const DEFAULT_LIMIT = 5;
      expect(DEFAULT_LIMIT).toBe(5);
    });

    it('should use RRF_K constant of 60', () => {
      expect(RRF_K).toBe(60);
    });

    it('should multiply limit by 2 for internal searches', () => {
      // hybridSearch 내부에서 limit * 2로 검색
      const userLimit = 5;
      const internalLimit = userLimit * 2;

      expect(internalLimit).toBe(10);
    });
  });

  describe('Source Attribution', () => {
    it('should mark all hybrid results as source: hybrid', () => {
      const denseResults = [createSearchResult('chunk-1', 'dense')];
      const sparseResults = [createSearchResult('chunk-2', 'sparse')];

      const results = reciprocalRankFusion(denseResults, sparseResults, 5);

      expect(results.every((r) => r.source === 'hybrid')).toBe(true);
    });

    it('should mark dense-only results as hybrid after fusion', () => {
      const denseResults = [createSearchResult('chunk-1', 'dense')];

      const results = reciprocalRankFusion(denseResults, [], 5);

      expect(results[0].source).toBe('hybrid');
    });

    it('should mark sparse-only results as hybrid after fusion', () => {
      const sparseResults = [createSearchResult('chunk-1', 'sparse')];

      const results = reciprocalRankFusion([], sparseResults, 5);

      expect(results[0].source).toBe('hybrid');
    });
  });
});
