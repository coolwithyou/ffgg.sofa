/**
 * Late Chunking 모듈
 *
 * 기존 "Early Chunking" (청크 → 개별 임베딩)과 달리,
 * Late Chunking은 전체 문서를 먼저 임베딩한 후 청크별로 풀링하여
 * 문맥 정보를 보존합니다.
 *
 * 참고: https://jina.ai/news/late-chunking-in-long-context-embedding-models/
 */

import { logger } from '@/lib/logger';
import {
  embedTexts,
  embedText,
  estimateTokenCount,
  splitByTokenLimit,
  cosineSimilarity,
  type EmbeddingTrackingContext,
} from './embedding';
import { smartChunk, type Chunk, type ChunkOptions } from './chunking';

/**
 * Late Chunking 옵션
 */
export interface LateChunkingOptions extends Partial<ChunkOptions> {
  /** 풀링 전략: mean(평균), max(최대), weighted(품질 가중) */
  poolingStrategy?: 'mean' | 'max' | 'weighted';
  /** 최대 토큰 수 (기본: 8000, 안전 마진 포함) */
  maxTokensPerSegment?: number;
  /** 임베딩 기반 품질 검증 활성화 */
  validateWithEmbedding?: boolean;
  /** 임베딩 추적 컨텍스트 */
  trackingContext?: EmbeddingTrackingContext;
}

/**
 * Late Chunk 결과
 */
export interface LateChunk extends Chunk {
  /** 풀링된 임베딩 벡터 */
  embedding: number[];
  /** Late Chunking 메타데이터 */
  lateChunkingMetadata: {
    /** 사용된 풀링 전략 */
    poolingStrategy: 'mean' | 'max' | 'weighted';
    /** 원본 세그먼트 수 (토큰 분할로 인한) */
    sourceSegmentCount: number;
    /** 추정 토큰 수 */
    estimatedTokens: number;
    /** 문서 임베딩과의 유사도 (품질 지표) */
    documentSimilarity?: number;
  };
}

const DEFAULT_MAX_TOKENS = 8000; // 8191 제한에서 안전 마진

/**
 * Late Chunking 수행
 *
 * 1. 문서를 토큰 제한에 맞게 세그먼트로 분할
 * 2. 각 세그먼트 임베딩 생성
 * 3. smartChunk로 청크 경계 결정
 * 4. 청크 범위에 해당하는 세그먼트 임베딩 풀링
 * 5. 임베딩 기반 품질 검증 (선택)
 *
 * @param content - 원본 문서 내용
 * @param options - Late Chunking 옵션
 * @returns 임베딩이 포함된 청크 배열
 */
export async function lateChunk(
  content: string,
  options: LateChunkingOptions = {}
): Promise<LateChunk[]> {
  const {
    poolingStrategy = 'weighted',
    maxTokensPerSegment = DEFAULT_MAX_TOKENS,
    validateWithEmbedding = true,
    trackingContext,
    ...chunkOptions
  } = options;

  if (!content || content.trim().length === 0) {
    return [];
  }

  logger.debug('[LateChunking] 시작', {
    contentLength: content.length,
    estimatedTokens: estimateTokenCount(content),
    poolingStrategy,
  });

  // 1. 토큰 제한에 맞게 세그먼트 분할
  const segments = splitByTokenLimit(content, maxTokensPerSegment);
  logger.debug('[LateChunking] 세그먼트 분할 완료', {
    segmentCount: segments.length,
  });

  // 2. 세그먼트별 임베딩 생성
  const segmentEmbeddings = await embedTexts(
    segments,
    trackingContext
  );

  // 3. 전체 문서 대표 임베딩 계산 (평균 풀링)
  const documentEmbedding = poolEmbeddings(segmentEmbeddings, 'mean');

  // 4. smartChunk로 청크 경계 결정
  const chunks = await smartChunk(content, chunkOptions);
  logger.debug('[LateChunking] 청크 분할 완료', {
    chunkCount: chunks.length,
  });

  // 5. 각 청크에 대해 임베딩 풀링 및 메타데이터 생성
  const lateChunks: LateChunk[] = [];

  for (const chunk of chunks) {
    // 청크가 속한 세그먼트 찾기
    const { relevantEmbeddings, weights } = findRelevantSegmentEmbeddings(
      chunk,
      segments,
      segmentEmbeddings,
      chunks
    );

    // 풀링 전략에 따라 임베딩 생성
    let chunkEmbedding: number[];
    if (relevantEmbeddings.length === 0) {
      // 관련 세그먼트가 없으면 청크 직접 임베딩
      chunkEmbedding = await embedText(chunk.content, trackingContext);
    } else if (poolingStrategy === 'weighted' && weights) {
      chunkEmbedding = weightedPoolEmbeddings(relevantEmbeddings, weights);
    } else {
      // 'weighted'가 아닌 경우 'mean' 또는 'max'만 가능
      const strategy = poolingStrategy === 'max' ? 'max' : 'mean';
      chunkEmbedding = poolEmbeddings(relevantEmbeddings, strategy);
    }

    // 문서 임베딩과의 유사도 계산
    const documentSimilarity = cosineSimilarity(chunkEmbedding, documentEmbedding);

    // 임베딩 기반 품질 조정
    let adjustedQualityScore = chunk.qualityScore;
    if (validateWithEmbedding) {
      adjustedQualityScore = adjustQualityWithEmbedding(
        chunk.qualityScore,
        documentSimilarity
      );
    }

    lateChunks.push({
      ...chunk,
      qualityScore: adjustedQualityScore,
      embedding: chunkEmbedding,
      lateChunkingMetadata: {
        poolingStrategy,
        sourceSegmentCount: relevantEmbeddings.length,
        estimatedTokens: estimateTokenCount(chunk.content),
        documentSimilarity,
      },
    });
  }

  logger.debug('[LateChunking] 완료', {
    totalChunks: lateChunks.length,
    avgDocumentSimilarity:
      lateChunks.reduce((sum, c) => sum + (c.lateChunkingMetadata.documentSimilarity || 0), 0) /
      lateChunks.length,
  });

  return lateChunks;
}

/**
 * 청크가 속한 세그먼트의 임베딩과 가중치 찾기
 */
function findRelevantSegmentEmbeddings(
  chunk: Chunk,
  segments: string[],
  segmentEmbeddings: number[][],
  allChunks: Chunk[]
): { relevantEmbeddings: number[][]; weights?: number[] } {
  const chunkStart = chunk.metadata.startOffset;
  const chunkEnd = chunk.metadata.endOffset;

  // 세그먼트별 시작/끝 오프셋 계산
  let currentOffset = 0;
  const segmentRanges: Array<{ start: number; end: number; embedding: number[] }> = [];

  for (let i = 0; i < segments.length; i++) {
    const segmentEnd = currentOffset + segments[i].length;
    segmentRanges.push({
      start: currentOffset,
      end: segmentEnd,
      embedding: segmentEmbeddings[i],
    });
    currentOffset = segmentEnd + 2; // \n\n 구분자 고려
  }

  // 청크와 겹치는 세그먼트 찾기
  const relevantEmbeddings: number[][] = [];
  const weights: number[] = [];

  for (const range of segmentRanges) {
    // 겹침 영역 계산
    const overlapStart = Math.max(chunkStart, range.start);
    const overlapEnd = Math.min(chunkEnd, range.end);
    const overlap = Math.max(0, overlapEnd - overlapStart);

    if (overlap > 0) {
      relevantEmbeddings.push(range.embedding);
      // 가중치: 겹침 비율 * 청크 품질
      const overlapRatio = overlap / (chunkEnd - chunkStart);
      weights.push(overlapRatio * (chunk.qualityScore / 100));
    }
  }

  return { relevantEmbeddings, weights };
}

/**
 * 여러 임베딩을 풀링
 */
function poolEmbeddings(
  embeddings: number[][],
  strategy: 'mean' | 'max'
): number[] {
  if (embeddings.length === 0) {
    throw new Error('No embeddings to pool');
  }

  if (embeddings.length === 1) {
    return embeddings[0];
  }

  const dimension = embeddings[0].length;
  const result = new Array(dimension).fill(0);

  if (strategy === 'mean') {
    // 평균 풀링
    for (const embedding of embeddings) {
      for (let i = 0; i < dimension; i++) {
        result[i] += embedding[i];
      }
    }
    for (let i = 0; i < dimension; i++) {
      result[i] /= embeddings.length;
    }
  } else {
    // 최대 풀링
    for (let i = 0; i < dimension; i++) {
      result[i] = Math.max(...embeddings.map((e) => e[i]));
    }
  }

  return result;
}

/**
 * 가중치 기반 임베딩 풀링
 */
function weightedPoolEmbeddings(embeddings: number[][], weights: number[]): number[] {
  if (embeddings.length === 0 || embeddings.length !== weights.length) {
    throw new Error('Invalid embeddings or weights');
  }

  if (embeddings.length === 1) {
    return embeddings[0];
  }

  const dimension = embeddings[0].length;
  const result = new Array(dimension).fill(0);
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);

  // 가중치 정규화
  const normalizedWeights = weights.map((w) => w / totalWeight);

  for (let i = 0; i < embeddings.length; i++) {
    for (let j = 0; j < dimension; j++) {
      result[j] += embeddings[i][j] * normalizedWeights[i];
    }
  }

  return result;
}

/**
 * 임베딩 유사도 기반 품질 점수 조정
 *
 * 문서 전체와의 유사도가 낮으면 문맥에서 벗어난 청크로 판단하여 감점
 */
function adjustQualityWithEmbedding(
  baseScore: number,
  documentSimilarity: number
): number {
  let adjustment = 0;

  if (documentSimilarity < 0.5) {
    // 유사도 0.5 미만: 문맥 이탈 (-15점)
    adjustment = -15;
  } else if (documentSimilarity < 0.7) {
    // 유사도 0.5-0.7: 약한 연관 (-5점)
    adjustment = -5;
  } else if (documentSimilarity > 0.9) {
    // 유사도 0.9 초과: 강한 연관 (+5점)
    adjustment = 5;
  }

  return Math.max(0, Math.min(100, baseScore + adjustment));
}

/**
 * 기존 청크에 Late Chunking 임베딩 추가
 *
 * 이미 smartChunk로 생성된 청크 배열에 임베딩을 추가할 때 사용
 */
export async function addLateChunkingEmbeddings(
  chunks: Chunk[],
  originalContent: string,
  options: Omit<LateChunkingOptions, 'maxChunkSize' | 'overlap' | 'preserveStructure'> = {}
): Promise<LateChunk[]> {
  const {
    poolingStrategy = 'weighted',
    maxTokensPerSegment = DEFAULT_MAX_TOKENS,
    validateWithEmbedding = true,
    trackingContext,
  } = options;

  // 세그먼트 분할 및 임베딩
  const segments = splitByTokenLimit(originalContent, maxTokensPerSegment);
  const segmentEmbeddings = await embedTexts(segments, trackingContext);
  const documentEmbedding = poolEmbeddings(segmentEmbeddings, 'mean');

  const lateChunks: LateChunk[] = [];

  for (const chunk of chunks) {
    const { relevantEmbeddings, weights } = findRelevantSegmentEmbeddings(
      chunk,
      segments,
      segmentEmbeddings,
      chunks
    );

    let chunkEmbedding: number[];
    if (relevantEmbeddings.length === 0) {
      chunkEmbedding = await embedText(chunk.content, trackingContext);
    } else if (poolingStrategy === 'weighted' && weights) {
      chunkEmbedding = weightedPoolEmbeddings(relevantEmbeddings, weights);
    } else {
      // 'weighted'가 아닌 경우 'mean' 또는 'max'만 가능
      const strategy = poolingStrategy === 'max' ? 'max' : 'mean';
      chunkEmbedding = poolEmbeddings(relevantEmbeddings, strategy);
    }

    const documentSimilarity = cosineSimilarity(chunkEmbedding, documentEmbedding);

    let adjustedQualityScore = chunk.qualityScore;
    if (validateWithEmbedding) {
      adjustedQualityScore = adjustQualityWithEmbedding(
        chunk.qualityScore,
        documentSimilarity
      );
    }

    lateChunks.push({
      ...chunk,
      qualityScore: adjustedQualityScore,
      embedding: chunkEmbedding,
      lateChunkingMetadata: {
        poolingStrategy,
        sourceSegmentCount: relevantEmbeddings.length,
        estimatedTokens: estimateTokenCount(chunk.content),
        documentSimilarity,
      },
    });
  }

  return lateChunks;
}
