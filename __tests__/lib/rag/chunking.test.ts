/**
 * 스마트 청킹 알고리즘 테스트
 */

import { describe, it, expect } from 'vitest';
import { smartChunk, analyzeStructure } from '@/lib/rag/chunking';

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

describe('smartChunk', () => {
  it('짧은 텍스트를 하나의 청크로 반환한다', async () => {
    const content = '이것은 짧은 텍스트입니다.';
    const chunks = await smartChunk(content);

    expect(chunks.length).toBe(1);
    expect(chunks[0].content).toBe(content);
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

  it('짧은 청크에 낮은 품질 점수를 부여한다', async () => {
    const content = '짧은 텍스트';
    const chunks = await smartChunk(content);

    expect(chunks[0].qualityScore).toBeLessThan(100);
  });

  it('청크 인덱스를 올바르게 할당한다', async () => {
    const content = 'Paragraph 1\n\nParagraph 2\n\nParagraph 3';
    const chunks = await smartChunk(content);

    chunks.forEach((chunk, index) => {
      expect(chunk.index).toBe(index);
    });
  });

  it('메타데이터를 포함한다', async () => {
    const content = 'Q: 질문입니다.\nA: 답변입니다.';
    const chunks = await smartChunk(content, { preserveStructure: true });

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
