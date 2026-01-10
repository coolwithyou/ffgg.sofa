/**
 * 형태소 분석기 테스트
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  analyzeMorphology,
  findSentenceBoundariesWithNLP,
  getCacheStats,
  clearCache,
  type MorphologicalResult,
} from '@/lib/nlp';

// Claude API 모킹
vi.mock('ai', () => ({
  generateText: vi.fn().mockImplementation(async () => ({
    text: JSON.stringify({
      sentences: ['첫 번째 문장입니다.', '두 번째 문장이에요.', '세 번째 문장이죠.'],
    }),
    usage: {
      inputTokens: 100,
      outputTokens: 50,
    },
  })),
}));

vi.mock('@ai-sdk/anthropic', () => ({
  createAnthropic: vi.fn().mockReturnValue(() => 'mock-model'),
}));

// 토큰 추적 모킹
vi.mock('@/lib/usage/token-tracker', () => ({
  trackTokenUsage: vi.fn().mockResolvedValue(undefined),
}));

describe('형태소 분석기 (Morphological Analyzer)', () => {
  beforeEach(() => {
    clearCache();
    vi.clearAllMocks();
  });

  afterEach(() => {
    clearCache();
  });

  describe('analyzeMorphology', () => {
    it('빈 텍스트 입력 시 빈 결과 반환', async () => {
      const result = await analyzeMorphology('');

      expect(result.sentences).toEqual([]);
      expect(result.sentenceBoundaries).toEqual([]);
      expect(result.metadata.method).toBe('rule-based');
      expect(result.metadata.processingTime).toBe(0);
    });

    it('공백만 있는 텍스트 입력 시 빈 결과 반환', async () => {
      const result = await analyzeMorphology('   \n\t  ');

      expect(result.sentences).toEqual([]);
      expect(result.sentenceBoundaries).toEqual([]);
    });

    it('Claude API로 문장 분리', async () => {
      const text = '첫 번째 문장입니다. 두 번째 문장이에요. 세 번째 문장이죠.';
      const result = await analyzeMorphology(text, { provider: 'claude' });

      expect(result.sentences).toHaveLength(3);
      expect(result.metadata.method).toBe('claude');
      expect(result.metadata.cached).toBe(false);
    });

    it('규칙 기반 문장 분리', async () => {
      const text = '첫 번째 문장입니다. 두 번째 문장이에요.';
      const result = await analyzeMorphology(text, { provider: 'rule-based' });

      expect(result.sentences.length).toBeGreaterThan(0);
      expect(result.metadata.method).toBe('rule-based');
    });

    it('캐시 동작 확인', async () => {
      const text = '캐시 테스트 문장입니다.';

      // 첫 번째 호출
      const result1 = await analyzeMorphology(text, { provider: 'claude' });
      expect(result1.metadata.cached).toBe(false);

      // 두 번째 호출 - 캐시 적중
      const result2 = await analyzeMorphology(text, { provider: 'claude' });
      expect(result2.metadata.cached).toBe(true);
    });

    it('캐시 비활성화 옵션', async () => {
      const text = '캐시 비활성화 테스트입니다.';

      // 첫 번째 호출
      await analyzeMorphology(text, { provider: 'claude' });

      // 캐시 비활성화로 두 번째 호출
      const result2 = await analyzeMorphology(text, {
        provider: 'claude',
        useCache: false,
      });

      expect(result2.metadata.cached).toBe(false);
    });
  });

  describe('findSentenceBoundariesWithNLP', () => {
    it('문장 경계 위치 반환', async () => {
      const text = '첫 번째 문장입니다. 두 번째 문장이에요.';
      const boundaries = await findSentenceBoundariesWithNLP(text, {
        provider: 'claude',
      });

      expect(Array.isArray(boundaries)).toBe(true);
      expect(boundaries.every((b) => typeof b === 'number')).toBe(true);
    });
  });

  describe('규칙 기반 분석 (Rule-based)', () => {
    it('한국어 종결어미 인식', async () => {
      const text = '이것은 첫 번째 문장입니다 두 번째 문장이에요 세 번째입니다';
      const result = await analyzeMorphology(text, { provider: 'rule-based' });

      expect(result.sentences.length).toBeGreaterThanOrEqual(1);
    });

    it('마침표 기반 분리', async () => {
      const text = '첫 번째. 두 번째. 세 번째.';
      const result = await analyzeMorphology(text, { provider: 'rule-based' });

      expect(result.sentences.length).toBeGreaterThanOrEqual(1);
    });

    it('물음표/느낌표 인식', async () => {
      const text = '질문입니까? 감탄이에요! 그렇군요.';
      const result = await analyzeMorphology(text, { provider: 'rule-based' });

      expect(result.sentences.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('getCacheStats', () => {
    it('캐시 통계 조회', async () => {
      // 캐시가 비어있을 때
      const stats1 = getCacheStats();
      expect(stats1.size).toBe(0);
      expect(stats1.oldestAge).toBeNull();

      // 캐시에 항목 추가
      await analyzeMorphology('테스트 문장입니다.', { provider: 'claude' });

      const stats2 = getCacheStats();
      expect(stats2.size).toBe(1);
      expect(stats2.oldestAge).toBeGreaterThanOrEqual(0);
    });
  });

  describe('clearCache', () => {
    it('캐시 초기화', async () => {
      // 캐시에 항목 추가
      await analyzeMorphology('테스트 문장입니다.', { provider: 'claude' });
      expect(getCacheStats().size).toBe(1);

      // 캐시 초기화
      clearCache();
      expect(getCacheStats().size).toBe(0);
    });
  });

  describe('문장 경계 계산 정확도', () => {
    it('경계 위치가 원본 텍스트 내에 있음', async () => {
      const text = '첫 번째 문장입니다. 두 번째 문장이에요. 세 번째 문장이죠.';
      const result = await analyzeMorphology(text, { provider: 'claude' });

      for (const boundary of result.sentenceBoundaries) {
        expect(boundary).toBeGreaterThanOrEqual(0);
        expect(boundary).toBeLessThanOrEqual(text.length);
      }
    });

    it('경계가 오름차순으로 정렬됨', async () => {
      const text = '첫 번째 문장입니다. 두 번째 문장이에요. 세 번째 문장이죠.';
      const result = await analyzeMorphology(text, { provider: 'claude' });

      for (let i = 1; i < result.sentenceBoundaries.length; i++) {
        expect(result.sentenceBoundaries[i]).toBeGreaterThanOrEqual(
          result.sentenceBoundaries[i - 1]
        );
      }
    });
  });

  describe('에러 처리', () => {
    it('API 실패 시 규칙 기반으로 폴백', async () => {
      // generateText가 에러를 throw하도록 설정
      const { generateText } = await import('ai');
      vi.mocked(generateText).mockRejectedValueOnce(new Error('API Error'));

      const text = '폴백 테스트 문장입니다.';
      const result = await analyzeMorphology(text, { provider: 'claude' });

      // 규칙 기반으로 폴백되어 결과가 있어야 함
      expect(result.sentences.length).toBeGreaterThanOrEqual(1);
      expect(result.metadata.method).toBe('rule-based');
    });
  });

  describe('메타데이터', () => {
    it('처리 시간 측정', async () => {
      const text = '처리 시간 테스트입니다.';
      const result = await analyzeMorphology(text, { provider: 'rule-based' });

      expect(result.metadata.processingTime).toBeGreaterThanOrEqual(0);
    });

    it('분석 방법 기록', async () => {
      const text = '분석 방법 테스트입니다.';

      const claudeResult = await analyzeMorphology(text, { provider: 'claude' });
      expect(claudeResult.metadata.method).toBe('claude');

      clearCache();

      const ruleResult = await analyzeMorphology(text, { provider: 'rule-based' });
      expect(ruleResult.metadata.method).toBe('rule-based');
    });
  });
});
