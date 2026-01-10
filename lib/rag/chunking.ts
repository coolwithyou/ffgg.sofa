/**
 * 스마트 청킹 알고리즘
 * 문서를 의미 단위로 분리하고 품질 점수 계산
 *
 * 주요 특징:
 * - 한국어 종결어미 기반 문장 경계 감지
 * - 문장 단위 오버랩으로 컨텍스트 보존
 * - Q&A 쌍, 헤더, 테이블 구조 인식
 */

/**
 * 문서 유형
 */
export type DocumentType = 'faq' | 'technical' | 'legal' | 'general';

/**
 * 문서 유형별 청킹 설정
 */
export interface DocumentTypeConfig {
  maxChunkSize: number;
  overlap: number;
  description: string;
}

/**
 * 문서 유형별 최적 청킹 설정
 * - faq: 짧은 Q&A 단위, 오버랩 최소화
 * - technical: 맥락 중요, 적당한 오버랩
 * - legal: 조항/절 단위, 큰 오버랩으로 맥락 보존
 * - general: 균형 잡힌 기본값
 */
export const DOCUMENT_TYPE_CONFIGS: Record<DocumentType, DocumentTypeConfig> = {
  faq: { maxChunkSize: 400, overlap: 30, description: '짧은 Q&A 단위' },
  technical: { maxChunkSize: 600, overlap: 80, description: '기술 문서, 맥락 중요' },
  legal: { maxChunkSize: 800, overlap: 100, description: '법률/계약, 조항 단위' },
  general: { maxChunkSize: 500, overlap: 50, description: '일반 문서 기본값' },
};

export interface ChunkOptions {
  maxChunkSize: number;
  overlap: number;
  preserveStructure: boolean;
  /** 문서 유형 자동 감지 여부 (true시 maxChunkSize/overlap 자동 조절) */
  autoDetectDocumentType?: boolean;
}

/**
 * 언어 유형
 */
export type Language = 'ko' | 'en' | 'mixed';

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
    /** 감지된 문서 유형 */
    documentType?: DocumentType;
    /** 문장 수 (품질 지표) */
    sentenceCount?: number;
    /** 평균 문장 길이 (품질 지표) */
    avgSentenceLength?: number;
    /** 감지된 언어 */
    language?: Language;
    /** 가독성 점수 (0-100) */
    readabilityScore?: number;
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
  autoDetectDocumentType: true, // 기본적으로 문서 유형 자동 감지 활성화
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
 * 텍스트 언어 감지
 * 단어 기반 비율에 따라 ko/en/mixed 반환
 *
 * 글자 기반이 아닌 단어 기반으로 계산하는 이유:
 * - 영어 'Hello'는 5글자, 한글 '안녕'은 2글자이지만 둘 다 1단어
 * - 단어 기반이 다국어 혼합 텍스트에서 더 공정한 판단 제공
 */
export function detectLanguage(text: string): Language {
  // 단어 단위로 분리
  const words = text.split(/\s+/).filter((w) => w.length > 0);

  if (words.length === 0) return 'mixed';

  let koreanWords = 0;
  let englishWords = 0;

  for (const word of words) {
    // 단어에서 문자 유형 분석
    const koreanChars = (word.match(/[가-힣ㄱ-ㅎㅏ-ㅣ]/g) || []).length;
    const englishChars = (word.match(/[a-zA-Z]/g) || []).length;

    // 단어의 주요 언어 판단 (더 많은 문자 유형 기준)
    if (koreanChars > 0 && koreanChars >= englishChars) {
      koreanWords++;
    } else if (englishChars > 0) {
      englishWords++;
    }
    // 숫자만 있는 단어는 무시
  }

  const totalLangWords = koreanWords + englishWords;
  if (totalLangWords === 0) return 'mixed';

  const koreanRatio = koreanWords / totalLangWords;
  const englishRatio = englishWords / totalLangWords;

  // 60% 이상이면 해당 언어로 판단 (단어 기반이므로 임계값 낮춤)
  if (koreanRatio >= 0.6) return 'ko';
  if (englishRatio >= 0.6) return 'en';

  return 'mixed';
}

/**
 * 텍스트 가독성 점수 계산 (0-100)
 *
 * 평가 기준:
 * - 평균 문장 길이: 15-40자가 최적
 * - 어휘 다양성: 중복 단어 비율이 낮을수록 좋음
 * - 문장 완결성: 종결어미로 끝나는 비율
 */
export function calculateReadabilityScore(text: string): number {
  if (!text.trim()) return 0;

  let score = 100;

  // 1. 문장 분리
  const boundaries = findSentenceBoundaries(text);
  const sentenceCount = Math.max(1, boundaries.length);
  const avgSentenceLength = text.length / sentenceCount;

  // 평균 문장 길이 평가 (15-40자 최적)
  if (avgSentenceLength < 10) {
    score -= 15; // 너무 짧음
  } else if (avgSentenceLength > 100) {
    score -= 30; // 매우 긺 (문장 분리 없음)
  } else if (avgSentenceLength > 80) {
    score -= 20; // 너무 긺
  } else if (avgSentenceLength > 50) {
    score -= 10;
  }

  // 2. 어휘 다양성 (단어 중복 비율)
  const words = text.split(/\s+/).filter((w) => w.length > 1);
  if (words.length > 5) {
    const uniqueWords = new Set(words.map((w) => w.toLowerCase()));
    const diversityRatio = uniqueWords.size / words.length;

    if (diversityRatio < 0.3) {
      score -= 15; // 중복이 많음
    } else if (diversityRatio < 0.5) {
      score -= 5;
    }
  }

  // 3. 특수문자/숫자 과다 여부
  const alphanumericRatio =
    (text.match(/[a-zA-Z가-힣ㄱ-ㅎㅏ-ㅣ0-9]/g)?.length || 0) / text.length;
  if (alphanumericRatio < 0.5) {
    score -= 15; // 특수문자가 너무 많음
  }

  // 4. 문장 완결성 보너스
  if (endsWithCompleteSentence(text)) {
    score += 5;
  }

  return Math.max(0, Math.min(100, score));
}

/**
 * 문서 유형별 키워드 패턴
 */
const DOCUMENT_TYPE_PATTERNS = {
  faq: {
    // Q&A, FAQ, 자주 묻는 질문 등
    keywords:
      /(?:FAQ|Q\s*&\s*A|자주\s*묻는\s*질문|질문\s*답변|문의\s*답변|질의\s*응답)/i,
    structure: /(?:Q[:：]|A[:：]|질문[:：]|답변[:：]|문[:：]|답[:：])/,
  },
  technical: {
    // API, 기술 문서, 개발 가이드 등
    keywords:
      /(?:API|SDK|개발\s*가이드|기술\s*문서|사용\s*설명서|매뉴얼|레퍼런스|설치\s*방법|사용법)/i,
    structure: /```[\s\S]*?```|<code>[\s\S]*?<\/code>/,
  },
  legal: {
    // 법률, 계약, 약관 등
    keywords:
      /(?:약관|이용약관|개인정보|계약서|조항|법률|규정|조례|동의서|면책|보증)/i,
    structure: /제\s*\d+\s*조|제\s*\d+\s*항|제\s*\d+\s*호|Article\s+\d+/i,
  },
};

/**
 * 문서 유형 자동 분류
 * 키워드 패턴 + 구조적 특성을 기반으로 판단
 */
export function classifyDocumentType(content: string): DocumentType {
  // 점수 기반 분류
  const scores: Record<DocumentType, number> = {
    faq: 0,
    technical: 0,
    legal: 0,
    general: 0,
  };

  // FAQ 판단
  if (DOCUMENT_TYPE_PATTERNS.faq.keywords.test(content)) {
    scores.faq += 30;
  }
  if (DOCUMENT_TYPE_PATTERNS.faq.structure.test(content)) {
    scores.faq += 40;
  }
  // Q&A 쌍 개수에 따른 가산점
  const qaMatches = content.match(/(?:Q|질문|문)[:：]/gi);
  if (qaMatches && qaMatches.length >= 3) {
    scores.faq += 20;
  }

  // Technical 판단
  if (DOCUMENT_TYPE_PATTERNS.technical.keywords.test(content)) {
    scores.technical += 30;
  }
  if (DOCUMENT_TYPE_PATTERNS.technical.structure.test(content)) {
    scores.technical += 30;
  }
  // 코드 블록 개수
  const codeBlocks = content.match(/```[\s\S]*?```/g);
  if (codeBlocks && codeBlocks.length >= 2) {
    scores.technical += 20;
  }

  // Legal 판단
  if (DOCUMENT_TYPE_PATTERNS.legal.keywords.test(content)) {
    scores.legal += 30;
  }
  if (DOCUMENT_TYPE_PATTERNS.legal.structure.test(content)) {
    scores.legal += 40;
  }
  // 조항 형식 개수
  const articleMatches = content.match(/제\s*\d+\s*[조항호]/g);
  if (articleMatches && articleMatches.length >= 3) {
    scores.legal += 20;
  }

  // 가장 높은 점수의 유형 선택 (최소 30점 이상이어야 적용)
  const maxScore = Math.max(scores.faq, scores.technical, scores.legal);

  if (maxScore >= 30) {
    if (scores.faq === maxScore) return 'faq';
    if (scores.technical === maxScore) return 'technical';
    if (scores.legal === maxScore) return 'legal';
  }

  return 'general';
}

/**
 * 스마트 청킹 수행
 */
export async function smartChunk(
  content: string,
  options: Partial<ChunkOptions> = {}
): Promise<Chunk[]> {
  let opts = { ...DEFAULT_OPTIONS, ...options };

  // 0. 문서 유형 자동 감지 및 설정 조절
  let detectedDocumentType: DocumentType = 'general';
  if (opts.autoDetectDocumentType && !options.maxChunkSize && !options.overlap) {
    // 사용자가 명시적으로 크기를 지정하지 않은 경우에만 자동 조절
    detectedDocumentType = classifyDocumentType(content);
    const typeConfig = DOCUMENT_TYPE_CONFIGS[detectedDocumentType];
    opts = {
      ...opts,
      maxChunkSize: typeConfig.maxChunkSize,
      overlap: typeConfig.overlap,
    };
  }

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

  // 6. 인덱스 재정렬 및 메타데이터 강화
  return filteredChunks.map((chunk, idx) => {
    // 문장 수 및 평균 길이 계산
    const boundaries = findSentenceBoundaries(chunk.content);
    const sentenceCount = Math.max(1, boundaries.length);
    const avgSentenceLength = Math.round(chunk.content.length / sentenceCount);

    // 언어 감지 및 가독성 점수 계산
    const language = detectLanguage(chunk.content);
    const readabilityScore = calculateReadabilityScore(chunk.content);

    return {
      ...chunk,
      index: idx,
      metadata: {
        ...chunk.metadata,
        documentType: detectedDocumentType,
        sentenceCount,
        avgSentenceLength,
        language,
        readabilityScore,
      },
    };
  });
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
 *
 * 품질 평가 기준:
 * 1. 길이 적정성 (100-800자)
 * 2. 문장 완결성 (종결어미로 끝남)
 * 3. Q&A 쌍 무결성
 * 4. 의미 있는 콘텐츠 비율
 * 5. 구조적 요소 (헤더, 리스트, 테이블)
 * 6. 가독성 점수 반영 (새 메타데이터)
 * 7. 문장 수 적정성 (새 메타데이터)
 */
function calculateQualityScore(chunk: Chunk): number {
  let score = 100;
  const content = chunk.content;
  const meta = chunk.metadata;

  // ========================================
  // 1. 길이 기반 평가
  // ========================================
  if (content.length < 50) {
    score -= 30; // 매우 짧음 (50자 미만)
  } else if (content.length < 100) {
    score -= 20; // 짧음 (100자 미만)
  }

  if (content.length > 1000) {
    score -= 15; // 매우 긺 (1000자 초과)
  } else if (content.length > 800) {
    score -= 10; // 긺 (800자 초과)
  }

  // ========================================
  // 2. 문장 완결성 평가
  // ========================================
  if (!endsWithCompleteSentence(content)) {
    score -= 15;
  }

  // ========================================
  // 3. Q&A 쌍 무결성 평가
  // ========================================
  const hasQuestion = content.includes('Q:') || content.includes('질문:') || content.includes('문:');
  const hasAnswer = content.includes('A:') || content.includes('답변:') || content.includes('답:');

  if (hasQuestion && !hasAnswer) {
    score -= 30; // Q만 있고 A 없음
  } else if (!hasQuestion && hasAnswer) {
    score -= 20; // A만 있고 Q 없음
  }

  // ========================================
  // 4. 의미 있는 콘텐츠 비율
  // ========================================
  // 한국어(가-힣), 영어(a-zA-Z)를 의미 있는 문자로 포함
  // Note: \W는 영어 단어 문자만 인식하므로 한국어가 제외되는 버그 수정
  const meaningfulChars = content.match(/[가-힣a-zA-Z]/g)?.join('') || '';
  const meaningfulRatio = content.length > 0 ? meaningfulChars.length / content.length : 0;

  if (meaningfulRatio < 0.2) {
    score -= 30; // 의미 있는 문자 20% 미만
  } else if (meaningfulRatio < 0.3) {
    score -= 25; // 의미 있는 문자 30% 미만
  }

  // ========================================
  // 5. 구조적 요소 가산점
  // ========================================
  if (meta.isQAPair) {
    score += 10; // 완전한 Q&A 쌍
  }

  if (meta.hasHeader) {
    score += 5; // 섹션 헤더 포함
  }

  if (meta.isList) {
    score += 3; // 리스트 구조 포함
  }

  if (meta.isTable) {
    score += 3; // 테이블 구조 포함
  }

  // ========================================
  // 6. 가독성 점수 반영 (새 메타데이터)
  // ========================================
  if (meta.readabilityScore !== undefined) {
    // 가독성 점수가 낮으면 감점
    if (meta.readabilityScore < 50) {
      score -= 10; // 가독성 매우 낮음
    } else if (meta.readabilityScore < 70) {
      score -= 5; // 가독성 낮음
    } else if (meta.readabilityScore >= 90) {
      score += 5; // 가독성 우수
    }
  }

  // ========================================
  // 7. 문장 수 적정성 (새 메타데이터)
  // ========================================
  if (meta.sentenceCount !== undefined) {
    if (meta.sentenceCount === 1 && content.length > 200) {
      score -= 10; // 긴 단일 문장 (읽기 어려움)
    } else if (meta.sentenceCount >= 3 && meta.sentenceCount <= 10) {
      score += 3; // 적정 문장 수
    }
  }

  // ========================================
  // 8. 평균 문장 길이 적정성 (새 메타데이터)
  // ========================================
  if (meta.avgSentenceLength !== undefined) {
    if (meta.avgSentenceLength > 100) {
      score -= 5; // 문장이 너무 긺
    } else if (meta.avgSentenceLength < 10 && meta.sentenceCount && meta.sentenceCount > 1) {
      score -= 5; // 문장이 너무 짧음 (단어 나열)
    }
  }

  return Math.max(0, Math.min(100, score));
}
