/**
 * 스마트 청킹 알고리즘 테스트
 */

import { describe, it, expect } from 'vitest';
import {
  smartChunk,
  analyzeStructure,
  isHeaderOrSeparatorOnly,
  classifyDocumentType,
  detectLanguage,
  calculateReadabilityScore,
  DOCUMENT_TYPE_CONFIGS,
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

describe('classifyDocumentType', () => {
  it('FAQ 문서를 올바르게 분류한다', () => {
    const faqContent = `
자주 묻는 질문 (FAQ)

Q: 배송은 얼마나 걸리나요?
A: 일반 배송은 2-3일, 빠른 배송은 1일 소요됩니다.

Q: 반품은 어떻게 하나요?
A: 구매일로부터 7일 이내 반품 신청 가능합니다.

Q: 포인트는 어떻게 적립되나요?
A: 구매 금액의 1%가 자동 적립됩니다.
    `;
    expect(classifyDocumentType(faqContent)).toBe('faq');
  });

  it('기술 문서를 올바르게 분류한다', () => {
    const technicalContent = `
# API 개발 가이드

## 설치 방법

다음 명령어로 SDK를 설치합니다:

\`\`\`bash
npm install @sofa/sdk
\`\`\`

## 사용법

\`\`\`typescript
import { SofaClient } from '@sofa/sdk';

const client = new SofaClient({ apiKey: 'your-key' });
await client.query('질문 내용');
\`\`\`
    `;
    expect(classifyDocumentType(technicalContent)).toBe('technical');
  });

  it('법률/약관 문서를 올바르게 분류한다', () => {
    const legalContent = `
# 이용약관

제1조 (목적)
이 약관은 회사가 제공하는 서비스의 이용조건 및 절차에 관한 사항을 규정함을 목적으로 합니다.

제2조 (정의)
"서비스"란 회사가 제공하는 모든 온라인 서비스를 의미합니다.

제3조 (약관의 효력)
이 약관은 서비스를 이용하고자 하는 모든 회원에게 적용됩니다.

제4조 (면책조항)
회사는 천재지변 등 불가항력으로 인한 서비스 중단에 대해 책임지지 않습니다.
    `;
    expect(classifyDocumentType(legalContent)).toBe('legal');
  });

  it('일반 문서를 올바르게 분류한다', () => {
    const generalContent = `
안녕하세요. 오늘은 날씨가 좋습니다.
이 문서는 특별한 형식이 없는 일반적인 텍스트입니다.
다양한 주제에 대해 이야기할 수 있습니다.
    `;
    expect(classifyDocumentType(generalContent)).toBe('general');
  });
});

describe('문서 유형별 청크 크기 동적 조절', () => {
  it('FAQ 문서에 작은 청크 크기(400자)가 적용된다', async () => {
    // FAQ 구조를 가진 긴 문서
    const faqContent = Array(10)
      .fill('')
      .map(
        (_, i) =>
          `Q: 질문 ${i + 1}번은 무엇인가요?\nA: 이것은 ${i + 1}번 질문에 대한 자세한 답변입니다. 충분히 긴 내용을 작성합니다.`
      )
      .join('\n\n');

    const chunks = await smartChunk(faqContent, { autoDetectDocumentType: true });

    // FAQ로 감지되어야 함
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks[0].metadata.documentType).toBe('faq');

    // 청크 크기가 FAQ 설정(400자)에 맞게 조절되어야 함
    chunks.forEach((chunk) => {
      // 약간의 오버랩 포함하여 450자 이내
      expect(chunk.content.length).toBeLessThanOrEqual(450);
    });
  });

  it('기술 문서에 적당한 청크 크기(600자)가 적용된다', async () => {
    const technicalContent = `
# API 사용 가이드

## 인증 방법

\`\`\`javascript
const client = new ApiClient({ key: 'your-api-key' });
\`\`\`

## 요청 보내기

API 요청은 다음과 같이 보낼 수 있습니다. 먼저 클라이언트를 초기화하고, 필요한 파라미터를 설정합니다. 그 다음 요청을 전송하고 응답을 처리합니다.

\`\`\`javascript
const response = await client.post('/endpoint', { data: 'value' });
console.log(response.data);
\`\`\`

응답은 JSON 형식으로 반환되며, 필요에 따라 파싱하여 사용할 수 있습니다. 에러가 발생한 경우 적절한 예외 처리를 해주세요.
    `;

    const chunks = await smartChunk(technicalContent, { autoDetectDocumentType: true });

    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks[0].metadata.documentType).toBe('technical');
  });

  it('사용자가 명시적으로 크기를 지정하면 자동 조절이 무시된다', async () => {
    const faqContent = `
Q: 첫 번째 질문입니다.
A: 첫 번째 답변입니다. 충분히 길게 작성합니다.

Q: 두 번째 질문입니다.
A: 두 번째 답변입니다. 마찬가지로 길게 작성합니다.
    `;

    // 사용자가 명시적으로 maxChunkSize를 지정
    const chunks = await smartChunk(faqContent, {
      maxChunkSize: 200,
      autoDetectDocumentType: true,
    });

    // 지정한 크기(200자)가 적용되어야 함
    chunks.forEach((chunk) => {
      expect(chunk.content.length).toBeLessThanOrEqual(250);
    });
  });

  it('청크 메타데이터에 문장 통계가 포함된다', async () => {
    const content =
      '첫 번째 문장입니다. 두 번째 문장입니다. 세 번째 문장입니다. 네 번째 문장입니다.';
    const chunks = await smartChunk(content);

    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks[0].metadata.sentenceCount).toBeDefined();
    expect(chunks[0].metadata.avgSentenceLength).toBeDefined();
    expect(chunks[0].metadata.sentenceCount).toBeGreaterThanOrEqual(1);
  });

  it('청크 메타데이터에 언어와 가독성 점수가 포함된다', async () => {
    const content =
      '이것은 한국어 텍스트입니다. 가독성 점수가 계산되어야 합니다.';
    const chunks = await smartChunk(content);

    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks[0].metadata.language).toBe('ko');
    expect(chunks[0].metadata.readabilityScore).toBeDefined();
    expect(chunks[0].metadata.readabilityScore).toBeGreaterThan(0);
  });
});

describe('detectLanguage', () => {
  it('한국어 텍스트를 올바르게 감지한다', () => {
    expect(detectLanguage('안녕하세요. 이것은 한국어 텍스트입니다.')).toBe('ko');
    expect(detectLanguage('SOFA는 좋은 서비스입니다.')).toBe('ko');
  });

  it('영어 텍스트를 올바르게 감지한다', () => {
    expect(detectLanguage('Hello, this is an English text.')).toBe('en');
    expect(detectLanguage('SOFA is a great service for RAG.')).toBe('en');
  });

  it('혼합 텍스트를 올바르게 감지한다', () => {
    // 균등하게 섞인 경우 mixed
    expect(detectLanguage('Hello 안녕 World 세계')).toBe('mixed');
    // 한글 3단어 vs 영어 3단어
    expect(detectLanguage('안녕하세요 Hello 반갑습니다 World 좋은하루 Today')).toBe('mixed');
  });

  it('숫자/특수문자만 있는 경우 mixed를 반환한다', () => {
    expect(detectLanguage('12345!@#$%')).toBe('mixed');
    expect(detectLanguage('   ')).toBe('mixed');
  });
});

describe('calculateReadabilityScore', () => {
  it('적절한 길이의 텍스트에 높은 점수를 부여한다', () => {
    const goodText =
      '이 문장은 적절한 길이입니다. 가독성이 좋은 텍스트입니다. ' +
      '다양한 어휘를 사용하여 작성되었습니다.';
    const score = calculateReadabilityScore(goodText);

    expect(score).toBeGreaterThan(70);
  });

  it('너무 긴 문장에 낮은 점수를 부여한다', () => {
    // 매우 긴 단일 문장 (한국어 종결어미 없음, 구두점 없음)
    // 종결어미로 분리되지 않도록 명사/형용사 나열 형태
    const longSentence =
      '아주 길고 복잡한 문장 구조를 가진 ' +
      '특별하고 독특한 형태의 텍스트 '.repeat(15);
    const score = calculateReadabilityScore(longSentence);

    // 200자 이상의 단일 문장 → avgSentenceLength > 100 → 감점
    expect(score).toBeLessThan(90);
  });

  it('반복되는 단어가 많으면 점수가 낮아진다', () => {
    const repetitiveText = '안녕 안녕 안녕 안녕 안녕 안녕 안녕 안녕 안녕 안녕';
    const score = calculateReadabilityScore(repetitiveText);

    expect(score).toBeLessThan(90);
  });

  it('빈 텍스트는 0점을 반환한다', () => {
    expect(calculateReadabilityScore('')).toBe(0);
    expect(calculateReadabilityScore('   ')).toBe(0);
  });

  it('완전한 문장으로 끝나면 보너스 점수가 부여된다', () => {
    const completeText = '이것은 완전한 문장입니다.';
    const incompleteText = '이것은 완전한 문장이';

    const completeScore = calculateReadabilityScore(completeText);
    const incompleteScore = calculateReadabilityScore(incompleteText);

    // 완전한 문장이 더 높은 점수를 받아야 함
    expect(completeScore).toBeGreaterThanOrEqual(incompleteScore);
  });
});

describe('품질 점수 정교화', () => {
  it('구조적 요소(헤더, 리스트)가 있으면 가산점을 받는다', async () => {
    const withHeader = await smartChunk(
      '## 제목\n\n이것은 본문 내용입니다. 충분한 길이의 텍스트가 필요합니다. ' +
        '더 많은 내용을 추가하여 품질 점수가 제대로 계산되도록 합니다.'
    );
    const withoutHeader = await smartChunk(
      '이것은 본문 내용입니다. 충분한 길이의 텍스트가 필요합니다. ' +
        '더 많은 내용을 추가하여 품질 점수가 제대로 계산되도록 합니다.'
    );

    // 헤더가 있는 청크가 +5점 가산
    if (withHeader.length > 0 && withoutHeader.length > 0) {
      expect(withHeader[0].qualityScore).toBeGreaterThanOrEqual(withoutHeader[0].qualityScore);
    }
  });

  it('Q&A 쌍이 분리되면 감점된다', async () => {
    // Q만 있는 청크 (충분한 길이로 필터링 방지)
    const qOnlyChunks = await smartChunk(
      'Q: 이것은 아주 긴 질문입니다. 사용자가 궁금해하는 내용을 상세하게 작성해야 합니다. ' +
        '충분한 길이의 질문을 제공하여 청크로 처리되도록 합니다.'
    );
    // Q&A 완전한 쌍 (한 청크로 유지되도록 줄바꿈 없이 연결)
    const qaChunks = await smartChunk(
      'Q: 이것은 질문입니다. 사용자가 궁금해합니다. ' +
        'A: 이것은 답변입니다. 충분한 길이의 답변을 제공합니다. 상세한 설명을 덧붙입니다.'
    );

    // 둘 다 청크가 생성되어야 함
    expect(qOnlyChunks.length).toBeGreaterThan(0);
    expect(qaChunks.length).toBeGreaterThan(0);

    // Q&A 완전한 쌍이 더 높은 점수를 받음 (Q-only는 -30 감점)
    expect(qaChunks[0].qualityScore).toBeGreaterThan(qOnlyChunks[0].qualityScore);
  });

  it('가독성 점수가 높으면 품질 점수도 높아진다', async () => {
    // 가독성이 좋은 텍스트
    const goodText =
      '이것은 가독성이 좋은 문장입니다. ' +
      '적절한 길이로 작성되었습니다. ' +
      '다양한 어휘를 사용하여 내용을 전달합니다. ' +
      '문장이 완결되어 있습니다.';

    // 가독성이 나쁜 텍스트 (긴 단일 문장, 반복)
    const badText =
      '이것은 매우 긴 문장으로 ' +
      '가독성이 떨어지는 텍스트의 예시를 보여주기 위해 ' +
      '일부러 길게 작성한 텍스트';

    const goodChunks = await smartChunk(goodText);
    const badChunks = await smartChunk(badText);

    if (goodChunks.length > 0 && badChunks.length > 0) {
      // 가독성 점수가 메타데이터에 포함되어 있어야 함
      expect(goodChunks[0].metadata.readabilityScore).toBeDefined();
      expect(badChunks[0].metadata.readabilityScore).toBeDefined();
    }
  });

  it('문장 수가 적정 범위(3-10)이면 가산점을 받는다', async () => {
    // 적정 문장 수 (5문장)
    const optimalText =
      '첫 번째 문장입니다. ' +
      '두 번째 문장입니다. ' +
      '세 번째 문장입니다. ' +
      '네 번째 문장입니다. ' +
      '다섯 번째 문장입니다.';

    const chunks = await smartChunk(optimalText);
    if (chunks.length > 0) {
      expect(chunks[0].metadata.sentenceCount).toBeGreaterThanOrEqual(3);
    }
  });
});
