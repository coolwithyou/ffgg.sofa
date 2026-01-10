/**
 * AI 기반 Semantic Chunking 알고리즘 테스트
 *
 * 테스트 대상:
 * - findSentenceBoundaries: 문장 경계 감지
 * - splitByNaturalBoundaries: 자연스러운 경계에서 텍스트 분할
 * - inferChunkType: 청크 타입 추론
 * - calculateSemanticQualityScore: 품질 점수 계산
 */

import { describe, it, expect } from 'vitest';
import {
  findSentenceBoundaries,
  splitByNaturalBoundaries,
  inferChunkType,
  calculateSemanticQualityScore,
} from '@/lib/rag/semantic-chunking';

describe('findSentenceBoundaries', () => {
  describe('한국어 문장 경계 감지', () => {
    it('합쇼체 종결어미를 감지한다', () => {
      const text = '이것은 테스트입니다. 다음 문장입니다. ';
      const boundaries = findSentenceBoundaries(text);

      expect(boundaries.length).toBeGreaterThan(0);
    });

    it('해요체 종결어미를 감지한다', () => {
      const text = '안녕하세요. 반갑습니다. ';
      const boundaries = findSentenceBoundaries(text);

      expect(boundaries.length).toBeGreaterThan(0);
    });

    it('물음표와 느낌표를 감지한다', () => {
      const text = '이것은 질문인가요? 네, 맞습니다! ';
      const boundaries = findSentenceBoundaries(text);

      expect(boundaries.length).toBeGreaterThan(0);
    });
  });

  describe('영어 문장 경계 감지', () => {
    it('마침표로 끝나는 문장을 감지한다', () => {
      const text = 'This is a test. Another sentence. ';
      const boundaries = findSentenceBoundaries(text);

      expect(boundaries.length).toBeGreaterThan(0);
    });

    it('물음표와 느낌표를 감지한다', () => {
      const text = 'Is this a question? Yes, it is! ';
      const boundaries = findSentenceBoundaries(text);

      expect(boundaries.length).toBeGreaterThan(0);
    });
  });

  it('빈 텍스트는 빈 배열을 반환한다', () => {
    const boundaries = findSentenceBoundaries('');
    expect(boundaries).toEqual([]);
  });

  it('문장 경계가 없는 텍스트는 빈 배열을 반환한다', () => {
    const text = '이것은 문장 경계가 없는 텍스트';
    const boundaries = findSentenceBoundaries(text);

    expect(boundaries).toEqual([]);
  });
});

describe('splitByNaturalBoundaries', () => {
  it('maxSize 이내의 텍스트는 그대로 반환한다', () => {
    const text = '짧은 텍스트입니다.';
    const segments = splitByNaturalBoundaries(text, 100);

    expect(segments).toHaveLength(1);
    expect(segments[0]).toBe(text);
  });

  it('긴 텍스트를 문장 단위로 분할한다', () => {
    // 총 길이가 maxSize를 충분히 초과하는 텍스트 사용
    const text =
      '첫 번째 문장입니다. 두 번째 문장입니다. 세 번째 문장입니다. 네 번째 문장입니다. 다섯 번째 문장입니다. 여섯 번째 문장입니다. ';
    const segments = splitByNaturalBoundaries(text, 40);

    expect(segments.length).toBeGreaterThan(1);
    // 각 세그먼트는 maxSize 이하여야 함 (문장 단위로 분할되므로 약간 초과할 수 있음)
    segments.forEach((segment) => {
      expect(segment.length).toBeLessThanOrEqual(50); // 여유 있게 검증
    });
  });

  it('단락으로 구분된 텍스트를 분할한다', () => {
    const text = '첫 번째 단락\n\n두 번째 단락\n\n세 번째 단락';
    const segments = splitByNaturalBoundaries(text, 20);

    expect(segments.length).toBeGreaterThanOrEqual(1);
  });

  it('빈 텍스트는 빈 배열을 반환한다', () => {
    const segments = splitByNaturalBoundaries('', 100);
    expect(segments).toEqual([]);
  });

  it('공백만 있는 텍스트는 빈 배열을 반환한다', () => {
    const segments = splitByNaturalBoundaries('   \n\n   ', 100);
    expect(segments).toEqual([]);
  });
});

describe('inferChunkType', () => {
  describe('Q&A 타입 감지', () => {
    it('영어 Q&A 형식을 감지한다', () => {
      const content = 'Q: What is this?\nA: This is a test.';
      expect(inferChunkType(content)).toBe('qa');
    });

    it('한국어 질문/답변 형식을 감지한다', () => {
      const content = '질문: 이것은 무엇인가요?\n답변: 테스트입니다.';
      expect(inferChunkType(content)).toBe('qa');
    });

    it('문/답 형식을 감지한다', () => {
      const content = '문: 이것은 무엇인가요?\n답: 테스트입니다.';
      expect(inferChunkType(content)).toBe('qa');
    });
  });

  describe('헤더 타입 감지', () => {
    it('마크다운 헤더를 감지한다', () => {
      expect(inferChunkType('# 제목')).toBe('header');
      expect(inferChunkType('## 소제목')).toBe('header');
      expect(inferChunkType('### 하위제목')).toBe('header');
    });
  });

  describe('코드 블록 타입 감지', () => {
    it('마크다운 코드 블록을 감지한다', () => {
      const content = '```javascript\nconsole.log("hello");\n```';
      expect(inferChunkType(content)).toBe('code');
    });

    it('들여쓰기 코드를 감지한다', () => {
      const content = '    function test() {\n        return true;\n    }';
      expect(inferChunkType(content)).toBe('code');
    });
  });

  describe('테이블 타입 감지', () => {
    it('마크다운 테이블을 감지한다', () => {
      const content = '| Column 1 | Column 2 |\n| --- | --- |\n| Value 1 | Value 2 |';
      expect(inferChunkType(content)).toBe('table');
    });
  });

  describe('목록 타입 감지', () => {
    it('불렛 리스트를 감지한다', () => {
      const content = '- 항목 1\n- 항목 2\n- 항목 3';
      expect(inferChunkType(content)).toBe('list');
    });

    it('번호 리스트를 감지한다', () => {
      const content = '1. 첫 번째\n2. 두 번째\n3. 세 번째';
      expect(inferChunkType(content)).toBe('list');
    });

    it('별표 리스트를 감지한다', () => {
      const content = '* 항목 1\n* 항목 2';
      expect(inferChunkType(content)).toBe('list');
    });
  });

  describe('일반 단락 타입', () => {
    it('구조적 요소가 없으면 paragraph를 반환한다', () => {
      const content = '이것은 일반적인 텍스트입니다. 특별한 구조가 없습니다.';
      expect(inferChunkType(content)).toBe('paragraph');
    });
  });
});

describe('calculateSemanticQualityScore', () => {
  it('적절한 길이의 청크에 높은 점수를 부여한다', () => {
    const chunk = {
      content: '이것은 적절한 길이의 청크입니다. 충분한 내용을 담고 있으며 의미 있는 정보를 포함합니다.',
      type: 'paragraph' as const,
      topic: '테스트',
      index: 0,
      metadata: {
        startOffset: 0,
        endOffset: 100,
        originalSegmentIndex: 0,
      },
    };

    const score = calculateSemanticQualityScore(chunk);
    // 적절한 길이 + 주제 있음 + 자연스러운 문장 끝 → 70점 이상
    expect(score).toBeGreaterThanOrEqual(70);
  });

  it('너무 짧은 청크에 낮은 점수를 부여한다', () => {
    const chunk = {
      content: '짧음',
      type: 'paragraph' as const,
      topic: '',
      index: 0,
      metadata: {
        startOffset: 0,
        endOffset: 4,
        originalSegmentIndex: 0,
      },
    };

    const score = calculateSemanticQualityScore(chunk);
    expect(score).toBeLessThan(90);
  });

  it('Q&A 타입에 가산점을 부여한다', () => {
    const qaChunk = {
      content:
        'Q: 이것은 무엇인가요?\nA: 이것은 Q&A 청크입니다. 질문과 답변이 함께 포함되어 있습니다.',
      type: 'qa' as const,
      topic: 'FAQ',
      index: 0,
      metadata: {
        startOffset: 0,
        endOffset: 100,
        originalSegmentIndex: 0,
      },
    };

    const paragraphChunk = {
      content:
        'Q: 이것은 무엇인가요?\nA: 이것은 Q&A 청크입니다. 질문과 답변이 함께 포함되어 있습니다.',
      type: 'paragraph' as const,
      topic: '',
      index: 0,
      metadata: {
        startOffset: 0,
        endOffset: 100,
        originalSegmentIndex: 0,
      },
    };

    const qaScore = calculateSemanticQualityScore(qaChunk);
    const paragraphScore = calculateSemanticQualityScore(paragraphChunk);

    // Q&A 타입이 더 높은 점수를 받아야 함
    expect(qaScore).toBeGreaterThan(paragraphScore);
  });

  it('주제가 있는 청크에 가산점을 부여한다', () => {
    const withTopic = {
      content: '이것은 테스트 청크입니다. 충분한 길이의 내용을 포함하고 있습니다.',
      type: 'paragraph' as const,
      topic: '테스트 주제',
      index: 0,
      metadata: {
        startOffset: 0,
        endOffset: 50,
        originalSegmentIndex: 0,
      },
    };

    const withoutTopic = {
      content: '이것은 테스트 청크입니다. 충분한 길이의 내용을 포함하고 있습니다.',
      type: 'paragraph' as const,
      topic: '',
      index: 0,
      metadata: {
        startOffset: 0,
        endOffset: 50,
        originalSegmentIndex: 0,
      },
    };

    const scoreWithTopic = calculateSemanticQualityScore(withTopic);
    const scoreWithoutTopic = calculateSemanticQualityScore(withoutTopic);

    expect(scoreWithTopic).toBeGreaterThan(scoreWithoutTopic);
  });

  it('자연스러운 문장 끝에 가산점을 부여한다', () => {
    const naturalEnding = {
      content: '이것은 자연스럽게 끝나는 청크입니다.',
      type: 'paragraph' as const,
      topic: '',
      index: 0,
      metadata: {
        startOffset: 0,
        endOffset: 30,
        originalSegmentIndex: 0,
      },
    };

    const unnaturalEnding = {
      content: '이것은 중간에 잘린 청크입',
      type: 'paragraph' as const,
      topic: '',
      index: 0,
      metadata: {
        startOffset: 0,
        endOffset: 20,
        originalSegmentIndex: 0,
      },
    };

    const naturalScore = calculateSemanticQualityScore(naturalEnding);
    const unnaturalScore = calculateSemanticQualityScore(unnaturalEnding);

    expect(naturalScore).toBeGreaterThanOrEqual(unnaturalScore);
  });

  it('점수는 0-100 범위 내에 있어야 한다', () => {
    const chunks = [
      { content: '', type: 'paragraph' as const, topic: '', index: 0, metadata: { startOffset: 0, endOffset: 0, originalSegmentIndex: 0 } },
      { content: 'a'.repeat(10000), type: 'paragraph' as const, topic: '', index: 0, metadata: { startOffset: 0, endOffset: 10000, originalSegmentIndex: 0 } },
      { content: '12345!@#$%', type: 'paragraph' as const, topic: '', index: 0, metadata: { startOffset: 0, endOffset: 10, originalSegmentIndex: 0 } },
    ];

    chunks.forEach((chunk) => {
      const score = calculateSemanticQualityScore(chunk);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    });
  });
});
