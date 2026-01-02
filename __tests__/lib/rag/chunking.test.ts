/**
 * 스마트 청킹 알고리즘 테스트
 */

import { describe, it, expect } from 'vitest';
import {
  smartChunk,
  analyzeStructure,
  isHeaderOrSeparatorOnly,
} from '@/lib/rag/chunking';

describe('analyzeStructure', () => {
  it('Markdown 헤더를 감지한다', () => {
    const content = '# Title\n\nSome content';
    const structure = analyzeStructure(content);

    expect(structure.hasHeaders).toBe(true);
  });

  it('Underline 헤더를 감지한다', () => {
    const content = 'Title\n====\n\nSome content';
    const structure = analyzeStructure(content);

    expect(structure.hasHeaders).toBe(true);
  });

  it('Q&A 쌍을 감지한다 (영어)', () => {
    const content = 'Q: What is this?\nA: This is a test.';
    const structure = analyzeStructure(content);

    expect(structure.hasQAPairs).toBe(true);
  });

  it('Q&A 쌍을 감지한다 (한국어)', () => {
    const content = '질문: 이것은 무엇인가요?\n답변: 테스트입니다.';
    const structure = analyzeStructure(content);

    expect(structure.hasQAPairs).toBe(true);
  });

  it('테이블을 감지한다', () => {
    const content = '| Column 1 | Column 2 |\n| --- | --- |';
    const structure = analyzeStructure(content);

    expect(structure.hasTables).toBe(true);
  });

  it('불렛 리스트를 감지한다', () => {
    const content = '- Item 1\n- Item 2\n- Item 3';
    const structure = analyzeStructure(content);

    expect(structure.hasLists).toBe(true);
  });

  it('번호 리스트를 감지한다', () => {
    const content = '1. First item\n2. Second item';
    const structure = analyzeStructure(content);

    expect(structure.hasLists).toBe(true);
  });
});

describe('isHeaderOrSeparatorOnly', () => {
  it('마크다운 헤더만 있는 경우 true 반환', () => {
    expect(isHeaderOrSeparatorOnly('## Part 2: 주요 제품')).toBe(true);
    expect(isHeaderOrSeparatorOnly('# 제목')).toBe(true);
    expect(isHeaderOrSeparatorOnly('### 소제목')).toBe(true);
  });

  it('구분자만 있는 경우 true 반환', () => {
    expect(isHeaderOrSeparatorOnly('---')).toBe(true);
    expect(isHeaderOrSeparatorOnly('***')).toBe(true);
    expect(isHeaderOrSeparatorOnly('___')).toBe(true);
    expect(isHeaderOrSeparatorOnly('===')).toBe(true);
  });

  it('헤더와 구분자만 있는 경우 true 반환', () => {
    expect(isHeaderOrSeparatorOnly('## 제목\n---')).toBe(true);
    expect(isHeaderOrSeparatorOnly('# Title\n\n---\n\n## Another')).toBe(true);
  });

  it('의미 있는 내용이 20자 미만인 경우 true 반환', () => {
    expect(isHeaderOrSeparatorOnly('## 제목\n짧은 내용')).toBe(true);
    expect(isHeaderOrSeparatorOnly('안녕')).toBe(true);
  });

  it('의미 있는 내용이 있는 경우 false 반환', () => {
    expect(
      isHeaderOrSeparatorOnly('## 제목\n이것은 충분히 긴 내용이며 20자를 넘습니다.')
    ).toBe(false);
    expect(
      isHeaderOrSeparatorOnly('이것은 의미 있는 충분히 긴 텍스트입니다.')
    ).toBe(false);
  });

  it('빈 콘텐츠는 true 반환', () => {
    expect(isHeaderOrSeparatorOnly('')).toBe(true);
    expect(isHeaderOrSeparatorOnly('   ')).toBe(true);
  });
});

describe('smartChunk', () => {
  it('충분한 길이의 텍스트를 청크로 반환한다', async () => {
    const content = '이것은 충분히 긴 텍스트입니다. 최소 20자 이상이어야 필터링되지 않습니다.';
    const chunks = await smartChunk(content);

    expect(chunks.length).toBe(1);
    expect(chunks[0].content).toBe(content);
  });

  it('너무 짧은 텍스트는 필터링된다', async () => {
    const content = '짧은 텍스트';
    const chunks = await smartChunk(content);

    expect(chunks.length).toBe(0);
  });

  it('제목만 있는 청크는 필터링된다', async () => {
    const content = '## Part 1: 개요\n\n## Part 2: 상세';
    const chunks = await smartChunk(content);

    // 제목만 있는 청크는 모두 필터링됨
    expect(chunks.length).toBe(0);
  });

  it('긴 텍스트를 여러 청크로 분리한다', async () => {
    const content = '안녕하세요. '.repeat(200); // ~2000자
    const chunks = await smartChunk(content, { maxChunkSize: 500 });

    expect(chunks.length).toBeGreaterThan(1);
    chunks.forEach(chunk => {
      expect(chunk.content.length).toBeLessThanOrEqual(550); // 오버랩 포함
    });
  });

  it('Q&A 쌍을 보존한다', async () => {
    const content = 'Q: 이것은 무엇인가요?\nA: 테스트입니다.\n\nQ: 또 다른 질문?\nA: 또 다른 답변.';
    const chunks = await smartChunk(content, { preserveStructure: true });

    // Q&A가 함께 유지되는지 확인
    const hasCompleteQA = chunks.some(
      chunk => chunk.content.includes('Q:') && chunk.content.includes('A:')
    );
    expect(hasCompleteQA).toBe(true);
  });

  it('품질 점수를 계산한다', async () => {
    const content = '이것은 품질 점수 테스트입니다. 충분히 긴 문장이어야 합니다. 문장이 완전하게 끝나야 점수가 높습니다.';
    const chunks = await smartChunk(content);

    expect(chunks[0].qualityScore).toBeGreaterThan(0);
    expect(chunks[0].qualityScore).toBeLessThanOrEqual(100);
  });

  it('100자 미만의 청크에 낮은 품질 점수를 부여한다', async () => {
    // 20자 이상이지만 100자 미만인 텍스트
    const content = '이것은 20자 이상이지만 100자 미만인 짧은 텍스트입니다.';
    const chunks = await smartChunk(content);

    expect(chunks.length).toBe(1);
    expect(chunks[0].qualityScore).toBeLessThan(100);
  });

  it('청크 인덱스를 올바르게 할당한다', async () => {
    // 각 단락이 20자 이상이어야 필터링되지 않음
    const content =
      '첫 번째 단락입니다. 충분히 긴 내용을 작성합니다.\n\n두 번째 단락입니다. 역시 충분히 긴 내용입니다.\n\n세 번째 단락입니다. 마찬가지로 길게 작성했습니다.';
    const chunks = await smartChunk(content);

    expect(chunks.length).toBeGreaterThan(0);
    chunks.forEach((chunk, index) => {
      expect(chunk.index).toBe(index);
    });
  });

  it('메타데이터를 포함한다', async () => {
    // 충분히 긴 Q&A (20자 이상)
    const content =
      'Q: 이것은 충분히 긴 질문입니다. 최소 20자 이상이어야 합니다.\nA: 이것은 충분히 긴 답변입니다. 필터링되지 않도록 길게 작성했습니다.';
    const chunks = await smartChunk(content, { preserveStructure: true });

    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks[0].metadata).toBeDefined();
    expect(typeof chunks[0].metadata.startOffset).toBe('number');
    expect(typeof chunks[0].metadata.endOffset).toBe('number');
  });

  it('오버랩이 적용된다', async () => {
    const content = 'A'.repeat(600); // 600자
    const chunks = await smartChunk(content, { maxChunkSize: 400, overlap: 50 });

    if (chunks.length > 1) {
      // 첫 청크의 끝부분과 두번째 청크의 시작부분이 겹쳐야 함
      const firstEnd = chunks[0].content.slice(-50);
      const secondStart = chunks[1].content.slice(0, 50);
      expect(firstEnd).toBe(secondStart);
    }
  });

  it('preserveStructure=false 일 때 단순 분리한다', async () => {
    const content = '# Header\n\nContent\n\nQ: Question\nA: Answer';
    const chunks = await smartChunk(content, { preserveStructure: false, maxChunkSize: 100 });

    // 구조를 고려하지 않고 단순히 크기 기반으로 분리
    expect(chunks.length).toBeGreaterThanOrEqual(1);
  });
});
