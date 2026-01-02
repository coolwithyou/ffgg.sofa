/**
 * 스마트 청킹 알고리즘
 * 문서를 의미 단위로 분리하고 품질 점수 계산
 */

export interface ChunkOptions {
  maxChunkSize: number;
  overlap: number;
  preserveStructure: boolean;
}

export interface Chunk {
  content: string;
  index: number;
  qualityScore: number;
  metadata: {
    startOffset: number;
    endOffset: number;
    hasHeader: boolean;
    isQAPair: boolean;
    isTable: boolean;
    isList: boolean;
  };
}

export interface DocumentStructure {
  hasHeaders: boolean;
  hasQAPairs: boolean;
  hasTables: boolean;
  hasLists: boolean;
}

const DEFAULT_OPTIONS: ChunkOptions = {
  maxChunkSize: 500,
  overlap: 50,
  preserveStructure: true,
};

/**
 * 스마트 청킹 수행
 */
export async function smartChunk(
  content: string,
  options: Partial<ChunkOptions> = {}
): Promise<Chunk[]> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // 1. 문서 구조 분석
  const structure = analyzeStructure(content);

  // 2. 의미 단위로 분리
  const segments = splitBySemanticUnits(content, structure, opts.preserveStructure);

  // 3. 크기 조절 및 오버랩 적용
  const chunks: Chunk[] = [];
  let globalIndex = 0;
  let globalOffset = 0;

  for (const segment of segments) {
    const segmentChunks = splitWithOverlap(
      segment.content,
      opts.maxChunkSize,
      opts.overlap,
      globalIndex,
      globalOffset,
      segment.metadata
    );

    chunks.push(...segmentChunks);
    globalIndex += segmentChunks.length;
    globalOffset += segment.content.length;
  }

  // 4. 품질 점수 계산
  const scoredChunks = chunks.map((chunk) => ({
    ...chunk,
    qualityScore: calculateQualityScore(chunk),
  }));

  // 5. 제목/구분자만 있는 청크 자동 필터링
  const filteredChunks = scoredChunks.filter(
    (chunk) => !isHeaderOrSeparatorOnly(chunk.content)
  );

  // 6. 인덱스 재정렬
  return filteredChunks.map((chunk, idx) => ({
    ...chunk,
    index: idx,
  }));
}

/**
 * 문서 구조 분석
 */
export function analyzeStructure(content: string): DocumentStructure {
  return {
    // Markdown/일반 헤더 감지
    hasHeaders:
      /^#+\s/m.test(content) || /^[A-Z가-힣].+\n={3,}/m.test(content),
    // Q&A 쌍 감지
    hasQAPairs:
      /Q[:：].*\nA[:：]/i.test(content) ||
      /질문[:：].*\n답변[:：]/i.test(content) ||
      /문[:：].*\n답[:：]/i.test(content),
    // 테이블 감지
    hasTables: /\|.*\|.*\|/m.test(content),
    // 목록 감지
    hasLists: /^[-*•]\s/m.test(content) || /^\d+[.)]\s/m.test(content),
  };
}

/**
 * 의미 단위로 분리
 */
function splitBySemanticUnits(
  content: string,
  structure: DocumentStructure,
  preserveStructure: boolean
): Array<{ content: string; metadata: Partial<Chunk['metadata']> }> {
  if (!preserveStructure) {
    return [{ content, metadata: {} }];
  }

  const segments: Array<{ content: string; metadata: Partial<Chunk['metadata']> }> = [];

  // Q&A 쌍 처리
  if (structure.hasQAPairs) {
    // 's' 플래그 없이 줄바꿈을 포함하는 Q&A 패턴
    const qaPattern = /((?:Q|질문|문)[:：][^\n]+(?:\n(?:A|답변|답)[:：][^\n]+)+)/gi;
    let lastIndex = 0;
    let match;

    while ((match = qaPattern.exec(content)) !== null) {
      // Q&A 이전 텍스트
      if (match.index > lastIndex) {
        const beforeText = content.slice(lastIndex, match.index).trim();
        if (beforeText) {
          segments.push({ content: beforeText, metadata: { isQAPair: false } });
        }
      }

      // Q&A 쌍
      segments.push({
        content: match[1].trim(),
        metadata: { isQAPair: true },
      });

      lastIndex = match.index + match[0].length;
    }

    // 나머지 텍스트
    if (lastIndex < content.length) {
      const remaining = content.slice(lastIndex).trim();
      if (remaining) {
        segments.push({ content: remaining, metadata: { isQAPair: false } });
      }
    }

    if (segments.length > 0) {
      return segments;
    }
  }

  // 헤더 기반 분리
  if (structure.hasHeaders) {
    const headerPattern = /^(#{1,6}\s.+|.+\n={3,})/gm;
    let lastIndex = 0;
    let match;

    while ((match = headerPattern.exec(content)) !== null) {
      if (match.index > lastIndex) {
        const sectionContent = content.slice(lastIndex, match.index).trim();
        if (sectionContent) {
          segments.push({ content: sectionContent, metadata: { hasHeader: false } });
        }
      }
      lastIndex = match.index;
    }

    if (lastIndex < content.length) {
      const remaining = content.slice(lastIndex).trim();
      if (remaining) {
        segments.push({ content: remaining, metadata: { hasHeader: true } });
      }
    }

    if (segments.length > 0) {
      return segments;
    }
  }

  // 단락 기반 분리 (기본)
  const paragraphs = content.split(/\n{2,}/);
  return paragraphs
    .map((p) => p.trim())
    .filter((p) => p.length > 0)
    .map((p) => ({ content: p, metadata: {} }));
}

/**
 * 크기 제한과 오버랩을 적용하여 분리
 */
function splitWithOverlap(
  content: string,
  maxSize: number,
  overlap: number,
  startIndex: number,
  startOffset: number,
  metadata: Partial<Chunk['metadata']>
): Chunk[] {
  if (content.length <= maxSize) {
    return [
      {
        content,
        index: startIndex,
        qualityScore: 0,
        metadata: {
          startOffset,
          endOffset: startOffset + content.length,
          hasHeader: metadata.hasHeader ?? false,
          isQAPair: metadata.isQAPair ?? false,
          isTable: metadata.isTable ?? false,
          isList: metadata.isList ?? false,
        },
      },
    ];
  }

  const chunks: Chunk[] = [];
  let currentPos = 0;
  let chunkIndex = startIndex;

  while (currentPos < content.length) {
    let endPos = Math.min(currentPos + maxSize, content.length);

    // 문장 경계에서 자르기
    if (endPos < content.length) {
      const lastSentenceEnd = findLastSentenceEnd(
        content.slice(currentPos, endPos)
      );
      if (lastSentenceEnd > maxSize * 0.5) {
        endPos = currentPos + lastSentenceEnd;
      }
    }

    const chunkContent = content.slice(currentPos, endPos).trim();

    if (chunkContent) {
      chunks.push({
        content: chunkContent,
        index: chunkIndex++,
        qualityScore: 0,
        metadata: {
          startOffset: startOffset + currentPos,
          endOffset: startOffset + endPos,
          hasHeader: metadata.hasHeader ?? false,
          isQAPair: metadata.isQAPair ?? false,
          isTable: metadata.isTable ?? false,
          isList: metadata.isList ?? false,
        },
      });
    }

    // 다음 시작 위치 (오버랩 적용)
    currentPos = endPos - overlap;
    if (currentPos >= content.length - overlap) {
      break;
    }
  }

  return chunks;
}

/**
 * 마지막 문장 끝 위치 찾기
 */
function findLastSentenceEnd(text: string): number {
  // 한국어/영어 문장 끝 패턴
  const sentenceEndPattern = /[.!?。！？다요죠]\s*/g;
  let lastMatch = 0;
  let match;

  while ((match = sentenceEndPattern.exec(text)) !== null) {
    lastMatch = match.index + match[0].length;
  }

  return lastMatch || text.length;
}

/**
 * 제목/구분자만 있는 청크인지 확인
 * 이런 청크는 RAG 검색에서 의미가 없으므로 자동 필터링
 */
export function isHeaderOrSeparatorOnly(content: string): boolean {
  const trimmed = content.trim();

  // 빈 콘텐츠
  if (!trimmed) return true;

  // 마크다운 헤더만 있는 경우 (## 제목, # 제목 등)
  // 헤더 라인만 있고 실제 내용이 없는 경우
  const lines = trimmed.split('\n').filter((line) => line.trim());

  // 모든 라인이 헤더거나 구분자인 경우 필터링
  const meaningfulLines = lines.filter((line) => {
    const l = line.trim();

    // 마크다운 헤더 (#, ##, ### 등)
    if (/^#{1,6}\s+.+$/.test(l)) return false;

    // 마크다운 구분자 (---, ***, ___, === 등)
    if (/^[-*_=]{3,}$/.test(l)) return false;

    // HTML 스타일 구분자
    if (/^<hr\s*\/?>$/i.test(l)) return false;

    // 빈 라인이나 공백만 있는 라인
    if (!l) return false;

    return true;
  });

  // 의미 있는 라인이 없으면 필터링 대상
  if (meaningfulLines.length === 0) return true;

  // 의미 있는 내용이 너무 짧은 경우 (20자 미만)
  // 예: "## Part 2\n주요" 같은 경우도 필터링
  const meaningfulContent = meaningfulLines.join(' ').trim();
  if (meaningfulContent.length < 20) return true;

  return false;
}

/**
 * 청크 품질 점수 계산 (0-100)
 */
function calculateQualityScore(chunk: Chunk): number {
  let score = 100;
  const content = chunk.content;

  // 너무 짧으면 감점 (100자 미만)
  if (content.length < 100) {
    score -= 20;
  }

  // 너무 길면 감점 (800자 초과)
  if (content.length > 800) {
    score -= 10;
  }

  // 문장이 중간에 잘렸으면 감점
  if (
    !content.endsWith('.') &&
    !content.endsWith('다') &&
    !content.endsWith('요') &&
    !content.endsWith('죠') &&
    !content.endsWith('!') &&
    !content.endsWith('?')
  ) {
    score -= 15;
  }

  // Q&A 쌍이 분리됐으면 감점
  if (
    (content.includes('Q:') || content.includes('질문:')) &&
    !(content.includes('A:') || content.includes('답변:'))
  ) {
    score -= 30;
  }

  // 의미 없는 내용이면 감점 (숫자/특수문자만)
  const meaningfulChars = content.replace(/[\d\s\W]/g, '');
  if (meaningfulChars.length < content.length * 0.3) {
    score -= 25;
  }

  // Q&A 쌍이면 가산점
  if (chunk.metadata.isQAPair) {
    score += 10;
  }

  // 헤더가 있으면 가산점
  if (chunk.metadata.hasHeader) {
    score += 5;
  }

  return Math.max(0, Math.min(100, score));
}
