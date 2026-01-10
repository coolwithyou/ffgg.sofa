/**
 * AI 기반 Semantic Chunking 모듈
 *
 * 문서를 의미적으로 완결된 단위로 분할합니다.
 * 규칙 기반 청킹과 달리 LLM이 문맥을 이해하여 적절한 지점에서 분할합니다.
 *
 * 파이프라인:
 * 1. Pre-chunking (규칙 기반, 큰 단위: 2000자)
 * 2. AI Semantic Re-chunking (Claude Haiku)
 * 3. Post-processing (짧은 청크 병합)
 */

import { logger } from '@/lib/logger';
import { trackTokenUsage } from '@/lib/usage/token-tracker';
import { generateWithCache } from './anthropic-cache';

// ============================================================
// 타입 정의
// ============================================================

export interface SemanticChunk {
  content: string;
  type: 'paragraph' | 'qa' | 'list' | 'table' | 'header' | 'code';
  topic: string;
  index: number;
  metadata: {
    startOffset: number;
    endOffset: number;
    originalSegmentIndex: number;
  };
}

export interface SemanticChunkOptions {
  /** 최소 청크 크기 (기본: 100자) */
  minChunkSize?: number;
  /** 최대 청크 크기 (기본: 600자) */
  maxChunkSize?: number;
  /** 1차 분할 크기 (기본: 2000자) */
  preChunkSize?: number;
  /** AI 모델 (기본: claude-3-haiku-20240307) */
  model?: string;
  /** 배치 크기 (기본: 5) */
  batchSize?: number;
  /** 배치 간 딜레이 (기본: 100ms) */
  batchDelayMs?: number;
}

interface SemanticChunkResult {
  content: string;
  type: string;
  topic: string;
}

// ============================================================
// 상수
// ============================================================

const SEMANTIC_MODEL = 'claude-3-haiku-20240307';

const DEFAULT_OPTIONS: Required<SemanticChunkOptions> = {
  minChunkSize: 100,
  maxChunkSize: 600,
  preChunkSize: 2000,
  model: SEMANTIC_MODEL,
  batchSize: 5,
  batchDelayMs: 100,
};

/**
 * 시스템 프롬프트 (Prompt Caching 적용)
 *
 * 이 프롬프트는 반복 호출 시 캐싱되어 90% 비용 절감 효과를 제공합니다.
 * 세그먼트 내용은 사용자 프롬프트로 별도 전달됩니다.
 */
const SEMANTIC_CHUNK_SYSTEM_PROMPT_KO = `당신은 텍스트를 의미적으로 완결된 청크들로 분할하는 전문가입니다.

## 분할 규칙
1. 각 청크는 하나의 완결된 개념/주제를 담아야 함
2. Q&A 쌍(질문+답변)은 반드시 함께 유지
3. 목록은 가능한 한 단위로 유지 (너무 길면 논리적 단위로 분할)
4. 표는 분할하지 않음
5. 코드 블록은 분할하지 않음
6. 100-600자 권장 (의미 완결성이 문자 수보다 우선)
7. 문장 중간에서 절대 자르지 말 것

## 청크 타입
- paragraph: 일반 문단
- qa: Q&A 쌍
- list: 목록
- table: 표
- header: 제목 + 설명
- code: 코드 블록

## 출력 형식
JSON 배열만 출력하세요. 다른 설명은 하지 마세요.
[
  {"content": "청크 내용", "type": "paragraph", "topic": "주제 키워드"},
  {"content": "Q: 질문\\nA: 답변", "type": "qa", "topic": "FAQ 주제"}
]

사용자가 <segment> 태그로 텍스트를 제공하면, 위 규칙에 따라 분할하세요.`;

const SEMANTIC_CHUNK_SYSTEM_PROMPT_EN = `You are an expert at splitting text into semantically complete chunks.

## Splitting Rules
1. Each chunk should contain one complete concept/topic
2. Q&A pairs (question + answer) must stay together
3. Keep lists as single units when possible (split logically if too long)
4. Do not split tables
5. Do not split code blocks
6. Target 100-600 characters (semantic completeness > character count)
7. Never split in the middle of a sentence

## Chunk Types
- paragraph: general paragraph
- qa: Q&A pair
- list: list/enumeration
- table: table
- header: heading + description
- code: code block

## Output Format
Output only a JSON array. No other explanation.
[
  {"content": "chunk content", "type": "paragraph", "topic": "topic keyword"},
  {"content": "Q: question\\nA: answer", "type": "qa", "topic": "FAQ topic"}
]

When the user provides text in <segment> tags, split it according to the rules above.`;

// ============================================================
// 헬퍼 함수
// ============================================================

/**
 * 한국어 문장 종결 패턴 (chunking.ts에서 재사용)
 * 종결어미 + 선택적 구두점 + 공백/줄바꿈
 */
const KOREAN_SENTENCE_END_PATTERN =
  /(?:습니다|입니다|됩니다|합니다|습니까|입니까|네요|군요|거든요|잖아요|나요|가요|을까요|ㄹ까요|세요|어요|아요|죠|요|다|냐|니|자)[.!?。！？]?\s+/g;

/**
 * 기본 문장 종결 패턴 (영어 및 기타 언어)
 */
const GENERAL_SENTENCE_END_PATTERN = /[.!?。！？]\s+/g;

/**
 * 한국어 문서인지 판별
 */
function isKoreanDocument(text: string): boolean {
  const koreanChars = text.match(/[가-힣]/g) || [];
  return koreanChars.length > text.length * 0.1;
}

/**
 * 텍스트 내 모든 문장 경계(끝 위치) 찾기
 * 한국어 종결어미 우선, 일반 구두점 보완
 *
 * @internal 테스트용 export
 */
export function findSentenceBoundaries(text: string): number[] {
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

  // 정렬된 배열로 반환
  return Array.from(boundaries).sort((a, b) => a - b);
}

/**
 * 자연스러운 문장 경계에서 텍스트 분할
 * maxSize 이내에서 문장 단위로 분할하여 의미 단위를 보존
 *
 * @param text - 분할할 텍스트
 * @param maxSize - 각 세그먼트의 최대 크기
 * @returns 분할된 세그먼트 배열
 *
 * @internal 테스트용 export
 */
export function splitByNaturalBoundaries(text: string, maxSize: number): string[] {
  if (text.length <= maxSize) {
    return [text.trim()].filter((s) => s.length > 0);
  }

  const segments: string[] = [];
  const boundaries = findSentenceBoundaries(text);

  // 문장 경계가 없으면 단락 기준으로 폴백
  if (boundaries.length === 0) {
    const paragraphs = text.split(/\n\n+/);
    let currentSegment = '';

    for (const para of paragraphs) {
      const trimmedPara = para.trim();
      if (!trimmedPara) continue;

      if ((currentSegment + '\n\n' + trimmedPara).length <= maxSize) {
        currentSegment = currentSegment
          ? currentSegment + '\n\n' + trimmedPara
          : trimmedPara;
      } else {
        if (currentSegment) segments.push(currentSegment);
        // 단락 자체가 maxSize보다 크면 강제 분할
        if (trimmedPara.length > maxSize) {
          // 문자 수 기반 강제 분할 (최후의 수단)
          for (let i = 0; i < trimmedPara.length; i += maxSize) {
            segments.push(trimmedPara.slice(i, i + maxSize).trim());
          }
          currentSegment = '';
        } else {
          currentSegment = trimmedPara;
        }
      }
    }
    if (currentSegment) segments.push(currentSegment);
    return segments.filter((s) => s.length > 0);
  }

  // 문장 경계가 있으면 문장 단위로 분할
  let currentStart = 0;
  let currentSegment = '';

  for (const boundary of boundaries) {
    const sentence = text.slice(currentStart, boundary);
    const potentialSegment = currentSegment ? currentSegment + sentence : sentence;

    if (potentialSegment.length <= maxSize) {
      currentSegment = potentialSegment;
    } else {
      // 현재 세그먼트가 있으면 저장
      if (currentSegment.trim()) {
        segments.push(currentSegment.trim());
      }
      // 새 문장이 maxSize보다 크면 강제 분할
      if (sentence.length > maxSize) {
        for (let i = 0; i < sentence.length; i += maxSize) {
          segments.push(sentence.slice(i, i + maxSize).trim());
        }
        currentSegment = '';
      } else {
        currentSegment = sentence;
      }
    }
    currentStart = boundary;
  }

  // 남은 텍스트 처리
  const remaining = text.slice(currentStart).trim();
  if (remaining) {
    if ((currentSegment + remaining).length <= maxSize) {
      currentSegment += remaining;
    } else {
      if (currentSegment.trim()) segments.push(currentSegment.trim());
      currentSegment = remaining;
    }
  }

  if (currentSegment.trim()) {
    segments.push(currentSegment.trim());
  }

  return segments.filter((s) => s.length > 0);
}

/**
 * 1차 규칙 기반 분할 (큰 단위)
 *
 * 개선된 분할 전략:
 * - 마크다운 문서: 헤더(#) 기준 분할
 * - 일반 텍스트/PDF: 빈 줄(\n\n+) 기준 분할
 * - 큰 세그먼트: 문장 경계 기반 재분할 (splitByNaturalBoundaries)
 *
 * @param content - 분할할 텍스트
 * @param maxSize - 최대 세그먼트 크기 (기본: 2000자)
 */
function preChunk(content: string, maxSize: number): string[] {
  const segments: string[] = [];

  // 마크다운 헤더 존재 여부 감지
  const hasMarkdownHeaders = /^#{1,6}\s/m.test(content);

  let majorSplits: string[];

  if (hasMarkdownHeaders) {
    // 마크다운 문서: 헤더(#) 기준 분할
    // (?=^#{1,3}\s)는 lookahead로 헤더 앞에서 분할 (헤더 자체는 유지)
    majorSplits = content.split(/(?=^#{1,3}\s)/gm);

    logger.debug('preChunk: Detected markdown document', {
      headerCount: majorSplits.length,
    });
  } else {
    // 일반 텍스트/PDF: 빈 줄 기준 분할
    // cleanText()가 \n{3,} → \n\n 변환하므로 \n\n+ 패턴 사용
    majorSplits = content.split(/\n\n+/);

    logger.debug('preChunk: Detected plain text document', {
      paragraphCount: majorSplits.length,
    });
  }

  for (const split of majorSplits) {
    const trimmed = split.trim();
    if (!trimmed) continue;

    if (trimmed.length <= maxSize) {
      segments.push(trimmed);
    } else {
      // 큰 세그먼트는 문장 경계 기반으로 재분할
      const subSegments = splitByNaturalBoundaries(trimmed, maxSize);
      segments.push(...subSegments);
    }
  }

  logger.debug('preChunk: Segmentation completed', {
    inputLength: content.length,
    outputSegments: segments.length,
    avgSegmentSize: Math.round(content.length / Math.max(1, segments.length)),
  });

  return segments.filter((s) => s.length > 0);
}

/**
 * AI 응답 파싱
 * JSON 배열을 추출하고 유효성 검증
 */
function parseAIResponse(response: string): SemanticChunkResult[] {
  try {
    // JSON 배열 추출 (응답에 설명이 포함될 수 있으므로)
    const jsonMatch = response.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new Error('No JSON array found in response');
    }

    const parsed = JSON.parse(jsonMatch[0]);

    if (!Array.isArray(parsed)) {
      throw new Error('Response is not an array');
    }

    return parsed
      .map((item: unknown) => {
        const obj = item as Record<string, unknown>;
        return {
          content: String(obj.content || ''),
          type: String(obj.type || 'paragraph'),
          topic: String(obj.topic || ''),
        };
      })
      .filter((chunk) => chunk.content.length > 0);
  } catch (error) {
    logger.warn('Failed to parse AI response for semantic chunking', {
      error: error instanceof Error ? error.message : 'Unknown',
      responsePreview: response.slice(0, 200),
    });
    return [];
  }
}

/**
 * 청크 콘텐츠에서 타입 추론
 * AI 실패 시 폴백에서 사용
 *
 * @internal 테스트용 export
 */
export function inferChunkType(
  content: string
): 'qa' | 'header' | 'list' | 'table' | 'code' | 'paragraph' {
  // Q&A 패턴 감지
  if (
    /(?:Q|질문|문)[:：]/i.test(content) &&
    /(?:A|답변|답)[:：]/i.test(content)
  ) {
    return 'qa';
  }

  // 마크다운 헤더 감지
  if (/^#{1,6}\s/.test(content)) {
    return 'header';
  }

  // 코드 블록 감지
  if (/```[\s\S]*```/.test(content) || /^\s{4,}[\w]/m.test(content)) {
    return 'code';
  }

  // 테이블 감지
  if (/\|.*\|.*\|/m.test(content)) {
    return 'table';
  }

  // 목록 감지
  if (/^[-*•]\s/m.test(content) || /^\d+[.)]\s/m.test(content)) {
    return 'list';
  }

  return 'paragraph';
}

/**
 * AI 실패 시 규칙 기반 청킹으로 폴백
 *
 * 순환 의존성을 피하기 위해 동적 import 사용
 */
async function fallbackToRuleBasedChunking(
  segment: string,
  options: Required<SemanticChunkOptions>
): Promise<SemanticChunkResult[]> {
  try {
    const { smartChunk } = await import('./chunking');

    const ruleBasedChunks = await smartChunk(segment, {
      maxChunkSize: options.maxChunkSize,
      overlap: 0, // 폴백에서는 오버랩 불필요 (후처리에서 처리)
      preserveStructure: true,
    });

    logger.info('Fallback to rule-based chunking', {
      inputLength: segment.length,
      outputChunks: ruleBasedChunks.length,
    });

    return ruleBasedChunks.map((chunk) => ({
      content: chunk.content,
      type: inferChunkType(chunk.content),
      topic: '',
    }));
  } catch (error) {
    logger.error('Fallback chunking also failed', error as Error);

    // 최후의 수단: 원본 반환
    return [
      {
        content: segment,
        type: inferChunkType(segment),
        topic: '',
      },
    ];
  }
}

// ============================================================
// 메인 함수
// ============================================================

/**
 * 단일 세그먼트를 AI로 의미 단위 분할
 *
 * Prompt Caching 적용:
 * - 시스템 프롬프트(분할 규칙)는 캐싱되어 반복 호출 시 90% 비용 절감
 * - 세그먼트 내용은 사용자 프롬프트로 전달되어 캐싱되지 않음
 */
async function chunkSegmentWithAI(
  segment: string,
  options: Required<SemanticChunkOptions>,
  trackingContext?: { tenantId: string }
): Promise<SemanticChunkResult[]> {
  const isKorean = isKoreanDocument(segment);

  // 시스템 프롬프트 (캐싱됨)
  const systemPrompt = isKorean
    ? SEMANTIC_CHUNK_SYSTEM_PROMPT_KO
    : SEMANTIC_CHUNK_SYSTEM_PROMPT_EN;

  // 사용자 프롬프트 (세그먼트 내용, 캐싱되지 않음)
  const userPrompt = `<segment>\n${segment}\n</segment>`;

  try {
    // Prompt Caching 적용된 API 호출
    const result = await generateWithCache({
      model: options.model,
      systemPrompt,
      userPrompt,
      maxOutputTokens: 4096,
      temperature: 0,
    });

    // 토큰 사용량 추적 (캐시 정보 포함)
    if (trackingContext?.tenantId) {
      await trackTokenUsage({
        tenantId: trackingContext.tenantId,
        featureType: 'semantic_chunking',
        modelProvider: 'anthropic',
        modelId: options.model,
        inputTokens: result.usage.inputTokens,
        outputTokens: result.usage.outputTokens,
        metadata: {
          cacheCreationInputTokens: result.usage.cacheCreationInputTokens,
          cacheReadInputTokens: result.usage.cacheReadInputTokens,
        },
      });
    }

    const chunks = parseAIResponse(result.text);

    // 빈 결과면 규칙 기반 폴백
    if (chunks.length === 0) {
      logger.warn('AI returned empty chunks, falling back to rule-based', {
        segmentLength: segment.length,
        responsePreview: result.text.slice(0, 100),
      });
      return await fallbackToRuleBasedChunking(segment, options);
    }

    return chunks;
  } catch (error) {
    logger.error('AI semantic chunking failed, falling back to rule-based', error as Error, {
      segmentLength: segment.length,
    });

    // 에러 시 규칙 기반 청킹으로 폴백
    return await fallbackToRuleBasedChunking(segment, options);
  }
}

/**
 * AI 기반 시맨틱 청킹 활성화 여부
 */
export function isSemanticChunkingEnabled(): boolean {
  return !!process.env.ANTHROPIC_API_KEY && process.env.DISABLE_SEMANTIC_CHUNKING !== 'true';
}

/**
 * 메인 시맨틱 청킹 함수
 *
 * @param content - 원본 문서 텍스트
 * @param options - 청킹 옵션
 * @param onProgress - 진행 상황 콜백 (current, total)
 * @param trackingContext - 토큰 사용량 추적용 컨텍스트
 * @returns 의미 단위로 분할된 청크 배열
 */
export async function semanticChunk(
  content: string,
  options: SemanticChunkOptions = {},
  onProgress?: (current: number, total: number) => void,
  trackingContext?: { tenantId: string }
): Promise<SemanticChunk[]> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // API 키 없으면 기존 방식으로 폴백
  if (!isSemanticChunkingEnabled()) {
    logger.info('Semantic chunking disabled, falling back to rule-based chunking');
    const { smartChunk } = await import('./chunking');
    const ruleBasedChunks = await smartChunk(content, {
      maxChunkSize: opts.maxChunkSize,
      overlap: 50,
      preserveStructure: true,
    });

    return ruleBasedChunks.map((chunk, index) => ({
      content: chunk.content,
      type: 'paragraph' as const,
      topic: '',
      index,
      metadata: {
        startOffset: chunk.metadata.startOffset || 0,
        endOffset: chunk.metadata.endOffset || chunk.content.length,
        originalSegmentIndex: 0,
      },
    }));
  }

  // 1. 규칙 기반 1차 분할 (큰 단위)
  const segments = preChunk(content, opts.preChunkSize);
  logger.info('Pre-chunking completed', { segmentCount: segments.length });

  // 2. AI 기반 2차 분할 (배치 처리)
  const allChunks: SemanticChunk[] = [];
  let globalIndex = 0;
  let globalOffset = 0;

  for (let i = 0; i < segments.length; i += opts.batchSize) {
    const batch = segments.slice(i, i + opts.batchSize);

    // 배치 내 병렬 처리
    const batchResults = await Promise.all(
      batch.map((segment, batchIndex) =>
        chunkSegmentWithAI(segment, opts, trackingContext).then((chunks) => ({
          segmentIndex: i + batchIndex,
          segment,
          chunks,
        }))
      )
    );

    // 결과 병합
    for (const { segmentIndex, segment, chunks } of batchResults) {
      let segmentOffset = 0;

      for (const chunk of chunks) {
        allChunks.push({
          content: chunk.content,
          type: chunk.type as SemanticChunk['type'],
          topic: chunk.topic,
          index: globalIndex++,
          metadata: {
            startOffset: globalOffset + segmentOffset,
            endOffset: globalOffset + segmentOffset + chunk.content.length,
            originalSegmentIndex: segmentIndex,
          },
        });
        segmentOffset += chunk.content.length;
      }

      globalOffset += segment.length;
    }

    // 진행 상황 콜백
    onProgress?.(Math.min(i + opts.batchSize, segments.length), segments.length);

    // 배치 간 딜레이 (rate limit 방지)
    if (i + opts.batchSize < segments.length) {
      await new Promise((resolve) => setTimeout(resolve, opts.batchDelayMs));
    }
  }

  // 3. 후처리: 너무 짧은 청크 병합
  const mergedChunks = mergeShortChunks(allChunks, opts.minChunkSize);

  // 4. 인덱스 재정렬
  const finalChunks = mergedChunks.map((chunk, idx) => ({ ...chunk, index: idx }));

  logger.info('Semantic chunking completed', {
    originalSegments: segments.length,
    finalChunks: finalChunks.length,
  });

  return finalChunks;
}

/**
 * 너무 짧은 청크를 이전 청크와 병합
 */
function mergeShortChunks(chunks: SemanticChunk[], minSize: number): SemanticChunk[] {
  if (chunks.length <= 1) return chunks;

  const result: SemanticChunk[] = [];

  for (const chunk of chunks) {
    if (result.length === 0) {
      result.push(chunk);
      continue;
    }

    const lastChunk = result[result.length - 1];

    // 현재 청크가 너무 짧고, 이전 청크와 같은 타입이면 병합
    if (chunk.content.length < minSize && chunk.type === lastChunk.type) {
      lastChunk.content += '\n\n' + chunk.content;
      lastChunk.metadata.endOffset = chunk.metadata.endOffset;
      if (chunk.topic && !lastChunk.topic.includes(chunk.topic)) {
        lastChunk.topic += ', ' + chunk.topic;
      }
    } else {
      result.push(chunk);
    }
  }

  return result;
}

/**
 * 시맨틱 청크 품질 점수 계산
 * 기존 calculateQualityScore와 호환되도록 0-100 점수 반환
 */
export function calculateSemanticQualityScore(chunk: SemanticChunk): number {
  let score = 100;

  // 너무 짧으면 감점
  if (chunk.content.length < 100) score -= 15;

  // 너무 길면 감점
  if (chunk.content.length > 800) score -= 10;

  // Q&A 타입이면 가산점
  if (chunk.type === 'qa') score += 10;

  // 주제가 명확하면 가산점
  if (chunk.topic && chunk.topic.length > 2) score += 5;

  // 의미없는 내용이면 감점 (숫자/공백/특수문자만)
  const meaningfulChars = chunk.content.replace(/[\d\s\W]/g, '');
  if (meaningfulChars.length < chunk.content.length * 0.3) {
    score -= 20;
  }

  // 문장 끝이 자연스러우면 가산점
  const content = chunk.content.trim();
  if (
    content.endsWith('.') ||
    content.endsWith('다') ||
    content.endsWith('요') ||
    content.endsWith('죠') ||
    content.endsWith('!') ||
    content.endsWith('?')
  ) {
    score += 5;
  }

  return Math.max(0, Math.min(100, score));
}
