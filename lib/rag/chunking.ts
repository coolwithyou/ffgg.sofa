/**
 * 스마트 청킹 알고리즘
 * 문서를 의미 단위로 분리하고 품질 점수 계산
 *
 * 주요 특징:
 * - 한국어 종결어미 기반 문장 경계 감지
 * - 문장 단위 오버랩으로 컨텍스트 보존
 * - Q&A 쌍, 헤더, 테이블 구조 인식
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
 * 한국어 문장 종결 패턴
 * 종결어미 + 선택적 구두점 + 공백/줄바꿈
 *
 * 분류:
 * 1. 합쇼체 (격식): 습니다, 입니다, 됩니다, 합니다, 습니까, 입니까
 * 2. 해요체 (비격식): 요, 죠, 네요, 군요, 거든요, 잖아요, 나요, 가요, 을까요
 * 3. 해체 (반말): 다, 냐, 니, 자, 어, 아, ㄴ다, 는다, 었다, 였다
 * 4. 인용/나열: 고요, 며, 고
 */
const KOREAN_SENTENCE_END_PATTERN =
  /(?:습니다|입니다|됩니다|합니다|습니까|입니까|네요|군요|거든요|잖아요|나요|가요|을까요|ㄹ까요|세요|어요|아요|죠|요|다|냐|니|자)[.!?。！？]?\s+/g;

/**
 * 기본 문장 종결 패턴 (영어 및 기타 언어)
 */
const GENERAL_SENTENCE_END_PATTERN = /[.!?。！？]\s+/g;

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
 * 크기 제한과 문장 단위 오버랩을 적용하여 분리
 *
 * 개선된 오버랩 전략:
 * - 기존: 마지막 N자를 그대로 중복 (문장 중간 잘림)
 * - 개선: 마지막 완전한 문장을 다음 청크 시작으로 사용
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

    // 다음 시작 위치 (문장 단위 오버랩 적용)
    // 현재 청크의 마지막 문장부터 시작하도록 계산
    const { overlapStart } = calculateSentenceOverlap(
      content.slice(currentPos, endPos),
      overlap
    );

    // 문장 경계 기반 오버랩 적용
    const nextStart = currentPos + overlapStart;

    // 무한 루프 방지: 최소 진행 보장
    if (nextStart <= currentPos) {
      currentPos = endPos;
    } else {
      currentPos = nextStart;
    }

    // 남은 내용이 너무 짧으면 종료
    if (currentPos >= content.length - overlap / 2) {
      break;
    }
  }

  return chunks;
}

/**
 * 마지막 문장 끝 위치 찾기
 * 한국어 종결어미와 일반 구두점 기반
 */
function findLastSentenceEnd(text: string): number {
  // 모든 문장 경계 찾기
  const boundaries = findSentenceBoundaries(text);

  if (boundaries.length === 0) {
    return text.length;
  }

  // 마지막 문장 경계 반환
  return boundaries[boundaries.length - 1];
}

/**
 * 텍스트 내 모든 문장 경계(끝 위치) 찾기
 * 한국어 종결어미 우선, 일반 구두점 보완
 */
function findSentenceBoundaries(text: string): number[] {
  const boundaries: Set<number> = new Set();

  // 1. 한국어 종결어미 패턴 매칭
  const koreanPattern = new RegExp(KOREAN_SENTENCE_END_PATTERN.source, 'g');
  let match;
  while ((match = koreanPattern.exec(text)) !== null) {
    boundaries.add(match.index + match[0].length);
  }

  // 2. 일반 문장 종결 패턴 (영어 등)
  const generalPattern = new RegExp(GENERAL_SENTENCE_END_PATTERN.source, 'g');
  while ((match = generalPattern.exec(text)) !== null) {
    boundaries.add(match.index + match[0].length);
  }

  // 3. 줄바꿈 기반 단락 경계 (마크다운/텍스트)
  const paragraphPattern = /\n\s*\n/g;
  while ((match = paragraphPattern.exec(text)) !== null) {
    boundaries.add(match.index + match[0].length);
  }

  // 정렬된 배열로 반환
  return Array.from(boundaries).sort((a, b) => a - b);
}

/**
 * 문장 단위로 오버랩 영역 계산
 * 단순 문자 수 대신 완전한 문장을 보존
 */
function calculateSentenceOverlap(
  text: string,
  targetOverlapChars: number
): { overlapStart: number; overlapContent: string } {
  const boundaries = findSentenceBoundaries(text);

  if (boundaries.length === 0) {
    // 문장 경계가 없으면 기존 방식 (문자 수 기반)
    const start = Math.max(0, text.length - targetOverlapChars);
    return {
      overlapStart: start,
      overlapContent: text.slice(start),
    };
  }

  // 끝에서 targetOverlapChars 이내의 가장 가까운 문장 경계 찾기
  const targetStart = text.length - targetOverlapChars;
  let overlapStart = 0;

  // 마지막 1-2 문장을 오버랩으로 사용
  for (let i = boundaries.length - 1; i >= 0; i--) {
    const boundary = boundaries[i];
    if (boundary <= targetStart) {
      overlapStart = boundary;
      break;
    }
    // 최소 하나의 문장은 포함
    overlapStart = i > 0 ? boundaries[i - 1] : 0;
  }

  return {
    overlapStart,
    overlapContent: text.slice(overlapStart).trim(),
  };
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
 * 청크가 완전한 문장으로 끝나는지 확인
 * 한국어 종결어미 포함
 */
function endsWithCompleteSentence(content: string): boolean {
  const trimmed = content.trim();

  // 구두점으로 끝나는 경우
  if (/[.!?。！？]$/.test(trimmed)) {
    return true;
  }

  // 한국어 종결어미로 끝나는 경우
  const koreanEndings = [
    '습니다',
    '입니다',
    '됩니다',
    '합니다',
    '습니까',
    '입니까',
    '네요',
    '군요',
    '거든요',
    '잖아요',
    '나요',
    '가요',
    '을까요',
    '세요',
    '어요',
    '아요',
    '죠',
    '요',
    '다',
    '냐',
    '니',
    '자',
  ];

  return koreanEndings.some((ending) => trimmed.endsWith(ending));
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
  if (!endsWithCompleteSentence(content)) {
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
