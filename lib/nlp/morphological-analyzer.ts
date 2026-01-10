/**
 * 형태소 분석기 모듈
 *
 * Claude API를 활용하여 한국어 문장 경계를 정확하게 분석합니다.
 * 규칙 기반 폴백을 포함하여 API 실패 시에도 안정적으로 동작합니다.
 *
 * 주요 기능:
 * - 문장 경계 분석 (95%+ 정확도 목표)
 * - 복합 문장, 인용문, 괄호 처리
 * - 결과 캐싱으로 비용 최적화
 */

import { createAnthropic } from '@ai-sdk/anthropic';
import { generateText } from 'ai';
import { logger } from '@/lib/logger';
import { trackTokenUsage } from '@/lib/usage/token-tracker';

/**
 * 형태소 분석 결과
 */
export interface MorphologicalResult {
  /** 분리된 문장들 */
  sentences: string[];
  /** 각 문장의 끝 위치 (원본 텍스트 기준) */
  sentenceBoundaries: number[];
  /** 분석 메타데이터 */
  metadata: {
    /** 사용된 분석 방법 */
    method: 'claude' | 'rule-based';
    /** 분석 소요 시간 (ms) */
    processingTime: number;
    /** 캐시 적중 여부 */
    cached: boolean;
  };
}

/**
 * 형태소 분석 옵션
 */
export interface MorphologicalOptions {
  /** 분석 제공자 (기본: claude) */
  provider?: 'claude' | 'rule-based';
  /** 캐싱 사용 여부 (기본: true) */
  useCache?: boolean;
  /** 토큰 추적 컨텍스트 */
  trackingContext?: { tenantId: string };
}

// 간단한 메모리 캐시 (TTL: 10분)
const analysisCache = new Map<string, { result: MorphologicalResult; timestamp: number }>();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10분

// Claude 모델
const MORPHOLOGICAL_MODEL = 'claude-3-5-haiku-20241022';

// 한국어 문장 경계 분석 프롬프트
const SENTENCE_BOUNDARY_PROMPT = `한국어 텍스트의 문장 경계를 분석하세요.

입력 텍스트:
"{{TEXT}}"

다음 규칙을 따르세요:
1. 완전한 문장 단위로 분리 (종결어미 -다, -요, -죠, -네요 등)
2. 인용문 내부의 문장 끝은 분리하지 않음
3. 괄호 () 또는 [] 내부는 문맥 유지
4. 불완전한 문장은 다음 문장과 병합
5. 짧은 감탄사/접속사는 다음 문장에 포함

JSON 형식으로만 응답:
{
  "sentences": ["문장1", "문장2", ...]
}`;

/**
 * 캐시 키 생성
 */
function createCacheKey(text: string): string {
  // 간단한 해시 생성 (첫 100자 + 길이)
  const prefix = text.slice(0, 100);
  return `${prefix.length}_${text.length}_${prefix.replace(/\s/g, '')}`;
}

/**
 * 캐시 정리 (만료된 항목 삭제)
 */
function cleanupCache(): void {
  const now = Date.now();
  for (const [key, value] of analysisCache) {
    if (now - value.timestamp > CACHE_TTL_MS) {
      analysisCache.delete(key);
    }
  }
}

/**
 * Claude API를 사용한 문장 경계 분석
 */
async function analyzeWithClaude(
  text: string,
  trackingContext?: { tenantId: string }
): Promise<MorphologicalResult> {
  const startTime = Date.now();
  const prompt = SENTENCE_BOUNDARY_PROMPT.replace('{{TEXT}}', text);

  try {
    const anthropic = createAnthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    const result = await generateText({
      model: anthropic(MORPHOLOGICAL_MODEL),
      prompt,
      maxOutputTokens: 2048,
      temperature: 0,
    });

    // 토큰 사용량 추적
    if (trackingContext?.tenantId) {
      await trackTokenUsage({
        tenantId: trackingContext.tenantId,
        featureType: 'morphological_analysis',
        modelProvider: 'anthropic',
        modelId: MORPHOLOGICAL_MODEL,
        inputTokens: result.usage?.inputTokens ?? 0,
        outputTokens: result.usage?.outputTokens ?? 0,
      });
    }

    // JSON 파싱
    const jsonMatch = result.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Invalid JSON response from Claude');
    }

    const parsed = JSON.parse(jsonMatch[0]) as { sentences: string[] };
    const sentences = parsed.sentences.filter((s) => s.trim().length > 0);

    // 문장 경계 위치 계산
    const sentenceBoundaries = calculateBoundaries(text, sentences);

    return {
      sentences,
      sentenceBoundaries,
      metadata: {
        method: 'claude',
        processingTime: Date.now() - startTime,
        cached: false,
      },
    };
  } catch (error) {
    logger.warn('Claude morphological analysis failed, falling back to rule-based', {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * 문장 경계 위치 계산
 */
function calculateBoundaries(originalText: string, sentences: string[]): number[] {
  const boundaries: number[] = [];
  let currentPos = 0;

  for (const sentence of sentences) {
    // 문장 시작 위치 찾기
    const trimmedSentence = sentence.trim();
    const sentenceStart = originalText.indexOf(trimmedSentence, currentPos);

    if (sentenceStart !== -1) {
      const sentenceEnd = sentenceStart + trimmedSentence.length;
      boundaries.push(sentenceEnd);
      currentPos = sentenceEnd;
    } else {
      // 정확히 일치하지 않으면 현재 위치에서 문장 길이만큼 이동
      currentPos += trimmedSentence.length;
      boundaries.push(currentPos);
    }
  }

  return boundaries;
}

/**
 * 규칙 기반 문장 경계 분석 (폴백)
 */
function analyzeWithRules(text: string): MorphologicalResult {
  const startTime = Date.now();

  // 한국어 문장 끝 패턴 (chunking.ts의 KOREAN_SENTENCE_END_PATTERN 확장)
  const sentenceEndPattern = /(?<=[.!?。！？])\s+|(?<=(?:다|요|죠|네요|해요|습니다|입니다|합니다|됩니다|있습니다|없습니다|했습니다|될까요|할까요|있나요|없나요|한다|된다|있다|없다|했다|한다고요|된다고요))(?:\s|$)/g;

  const sentences: string[] = [];
  let lastIndex = 0;

  // 정규식으로 문장 분리
  const matches = text.matchAll(sentenceEndPattern);

  for (const match of matches) {
    if (match.index !== undefined) {
      const sentence = text.slice(lastIndex, match.index + (match[0].length - 1)).trim();
      if (sentence.length > 0) {
        sentences.push(sentence);
      }
      lastIndex = match.index + match[0].length;
    }
  }

  // 마지막 문장 처리
  const remaining = text.slice(lastIndex).trim();
  if (remaining.length > 0) {
    sentences.push(remaining);
  }

  // 빈 결과면 원본 반환
  if (sentences.length === 0) {
    sentences.push(text.trim());
  }

  // 문장 경계 위치 계산
  const sentenceBoundaries = calculateBoundaries(text, sentences);

  return {
    sentences,
    sentenceBoundaries,
    metadata: {
      method: 'rule-based',
      processingTime: Date.now() - startTime,
      cached: false,
    },
  };
}

/**
 * 형태소 분석 수행
 *
 * Claude API를 우선 사용하고, 실패 시 규칙 기반으로 폴백합니다.
 * 결과는 캐싱되어 동일 텍스트 재분석 시 비용을 절감합니다.
 *
 * @param text - 분석할 텍스트
 * @param options - 분석 옵션
 * @returns 문장 분리 결과
 */
export async function analyzeMorphology(
  text: string,
  options: MorphologicalOptions = {}
): Promise<MorphologicalResult> {
  const { provider = 'claude', useCache = true, trackingContext } = options;

  if (!text || text.trim().length === 0) {
    return {
      sentences: [],
      sentenceBoundaries: [],
      metadata: {
        method: 'rule-based',
        processingTime: 0,
        cached: false,
      },
    };
  }

  // 캐시 정리 (주기적)
  if (Math.random() < 0.1) {
    cleanupCache();
  }

  // 캐시 확인
  if (useCache) {
    const cacheKey = createCacheKey(text);
    const cached = analysisCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return {
        ...cached.result,
        metadata: {
          ...cached.result.metadata,
          cached: true,
        },
      };
    }
  }

  let result: MorphologicalResult;

  if (provider === 'rule-based') {
    result = analyzeWithRules(text);
  } else {
    // Claude 우선, 실패 시 규칙 기반 폴백
    try {
      result = await analyzeWithClaude(text, trackingContext);
    } catch {
      result = analyzeWithRules(text);
    }
  }

  // 캐시 저장
  if (useCache) {
    const cacheKey = createCacheKey(text);
    analysisCache.set(cacheKey, { result, timestamp: Date.now() });
  }

  logger.debug('[MorphologicalAnalyzer] 분석 완료', {
    method: result.metadata.method,
    sentenceCount: result.sentences.length,
    processingTime: result.metadata.processingTime,
    cached: result.metadata.cached,
  });

  return result;
}

/**
 * 문장 경계 위치만 추출 (chunking 통합용)
 *
 * @param text - 분석할 텍스트
 * @param options - 분석 옵션
 * @returns 문장 끝 위치 배열
 */
export async function findSentenceBoundariesWithNLP(
  text: string,
  options: MorphologicalOptions = {}
): Promise<number[]> {
  const result = await analyzeMorphology(text, options);
  return result.sentenceBoundaries;
}

/**
 * 캐시 통계 조회 (디버깅용)
 */
export function getCacheStats(): { size: number; oldestAge: number | null } {
  const now = Date.now();
  let oldestTimestamp = Infinity;

  for (const value of analysisCache.values()) {
    if (value.timestamp < oldestTimestamp) {
      oldestTimestamp = value.timestamp;
    }
  }

  return {
    size: analysisCache.size,
    oldestAge: oldestTimestamp === Infinity ? null : now - oldestTimestamp,
  };
}

/**
 * 캐시 초기화 (테스트용)
 */
export function clearCache(): void {
  analysisCache.clear();
}
