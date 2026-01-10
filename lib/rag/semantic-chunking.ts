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
 * 한국어 문서인지 판별
 */
function isKoreanDocument(text: string): boolean {
  const koreanChars = text.match(/[가-힣]/g) || [];
  return koreanChars.length > text.length * 0.1;
}

/**
 * 1차 규칙 기반 분할 (큰 단위)
 * 헤더와 빈 줄을 기준으로 먼저 분할하고, 여전히 큰 세그먼트는 단락 단위로 재분할
 */
function preChunk(content: string, maxSize: number): string[] {
  const segments: string[] = [];

  // 1. 먼저 큰 구분자로 분할 시도 (헤더, 빈 줄 2개 이상)
  const majorSplits = content.split(/\n{3,}|(?=^#{1,3}\s)/gm);

  for (const split of majorSplits) {
    const trimmed = split.trim();
    if (!trimmed) continue;

    if (trimmed.length <= maxSize) {
      segments.push(trimmed);
    } else {
      // 큰 세그먼트는 단락 단위로 재분할
      const paragraphs = trimmed.split(/\n{2,}/);
      let currentSegment = '';

      for (const para of paragraphs) {
        if ((currentSegment + '\n\n' + para).length <= maxSize) {
          currentSegment = currentSegment ? currentSegment + '\n\n' + para : para;
        } else {
          if (currentSegment) segments.push(currentSegment);
          currentSegment = para;
        }
      }
      if (currentSegment) segments.push(currentSegment);
    }
  }

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

    // 빈 결과면 원본 반환
    if (chunks.length === 0) {
      return [{ content: segment, type: 'paragraph', topic: '' }];
    }

    return chunks;
  } catch (error) {
    logger.error('AI semantic chunking failed', error as Error, {
      segmentLength: segment.length,
    });

    // 에러 시 원본 세그먼트 그대로 반환 (graceful fallback)
    return [{ content: segment, type: 'paragraph', topic: '' }];
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
