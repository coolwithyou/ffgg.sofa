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

describe('한국어 문장 경계 처리', () => {
  it('합쇼체 종결어미(-습니다, -입니다)에서 문장을 분리한다', async () => {
    const content =
      '안녕하세요. SOFA는 RAG 기반 챗봇 플랫폼입니다. ' +
      '다양한 문서를 학습하여 자동으로 답변을 생성합니다. ' +
      '사용자 친화적인 인터페이스를 제공합니다.';
    const chunks = await smartChunk(content, { maxChunkSize: 100 });

    // 문장 경계에서 분리되어야 함 (중간에 잘리지 않음)
    chunks.forEach((chunk) => {
      const trimmed = chunk.content.trim();
      const endsWell =
        trimmed.endsWith('.') ||
        trimmed.endsWith('다') ||
        trimmed.endsWith('요');
      expect(endsWell).toBe(true);
    });
  });

  it('해요체 종결어미(-요, -죠, -네요)에서 문장을 분리한다', async () => {
    const content =
      '이 기능은 정말 유용해요. 사용하기도 편하죠. ' +
      '특히 한국어 처리가 뛰어나네요. 문장을 정확히 인식해요.';
    const chunks = await smartChunk(content, { maxChunkSize: 100 });

    // 각 청크가 문장 단위로 끝나야 함
    expect(chunks.length).toBeGreaterThan(0);
    chunks.forEach((chunk) => {
      const trimmed = chunk.content.trim();
      const hasKoreanEnding =
        /(?:요|죠|네요|해요)[.!?]?$/.test(trimmed) || trimmed.endsWith('.');
      expect(hasKoreanEnding).toBe(true);
    });
  });

  it('구두점 없는 한국어 문장도 올바르게 분리한다', async () => {
    const content =
      '첫 번째 문장입니다 두 번째 문장이에요 ' +
      '세 번째 문장이죠 네 번째 문장입니다';
    const chunks = await smartChunk(content, { maxChunkSize: 80 });

    // 종결어미 기반으로 분리되어야 함
    expect(chunks.length).toBeGreaterThan(0);
  });

  it('긴 한국어 텍스트에서 문장 단위 오버랩이 적용된다', async () => {
    // 여러 문장으로 구성된 긴 텍스트
    const sentences = [
      'SOFA는 스마트 오퍼레이터 FAQ 어시스턴트입니다.',
      '문서를 업로드하면 자동으로 청크로 분리합니다.',
      '벡터 임베딩을 생성하여 시맨틱 검색을 수행합니다.',
      'PGroonga를 사용하여 한국어 전문 검색을 지원합니다.',
      'Hybrid Search로 Dense와 Sparse 검색을 결합합니다.',
      'RRF 알고리즘으로 최적의 결과를 도출합니다.',
    ];
    const content = sentences.join(' ');

    const chunks = await smartChunk(content, { maxChunkSize: 150, overlap: 50 });

    if (chunks.length > 1) {
      // 두 번째 청크가 완전한 문장으로 시작하는지 확인
      const secondChunk = chunks[1].content.trim();
      // 문장 중간에 시작하지 않아야 함 (동사 앞에서 시작하지 않음)
      expect(secondChunk).not.toMatch(/^[을를이가은는]/);
    }
  });

  it('영어와 한국어가 혼합된 텍스트를 처리한다', async () => {
    const content =
      'RAG is Retrieval Augmented Generation. ' +
      'SOFA는 RAG 기반 플랫폼입니다. ' +
      'It supports hybrid search. 한국어와 영어 모두 지원합니다.';
    const chunks = await smartChunk(content, { maxChunkSize: 100 });

    // 영어(.)/한국어(종결어미) 모두 문장 단위로 분리
    expect(chunks.length).toBeGreaterThan(0);
    chunks.forEach((chunk) => {
      const trimmed = chunk.content.trim();
      const hasValidEnding =
        trimmed.endsWith('.') ||
        /(?:다|요|죠)$/.test(trimmed);
      expect(hasValidEnding).toBe(true);
    });
  });
});
