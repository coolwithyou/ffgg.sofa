/**
 * 임베딩 생성 모듈
 * BGE-m3-ko 모델 사용 (한국어 최적화, 1024차원)
 */

import { logger } from '@/lib/logger';

export interface EmbeddingResult {
  embedding: number[];
  model: string;
  tokenCount?: number;
}

const EMBEDDING_API_URL = process.env.EMBEDDING_API_URL || 'http://localhost:8000';
const EMBEDDING_DIMENSION = 1024;
const BATCH_SIZE = 32; // 배치 처리 크기

/**
 * 단일 텍스트 임베딩 생성
 */
export async function embedText(text: string): Promise<number[]> {
  const result = await embedTexts([text]);
  return result[0];
}

/**
 * 여러 텍스트 배치 임베딩 생성
 */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) {
    return [];
  }

  const results: number[][] = [];

  // 배치 단위로 처리
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    const batchEmbeddings = await generateEmbeddingsBatch(batch);
    results.push(...batchEmbeddings);
  }

  return results;
}

/**
 * BGE-m3-ko 임베딩 서버 호출
 */
async function generateEmbeddingsBatch(texts: string[]): Promise<number[][]> {
  // 30초 타임아웃 설정 (대용량 배치 처리 고려)
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  try {
    // 텍스트 전처리
    const processedTexts = texts.map((text) => preprocessText(text));

    const response = await fetch(`${EMBEDDING_API_URL}/embed`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        texts: processedTexts,
        normalize: true, // L2 정규화
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Embedding API error: ${response.status}`);
    }

    const data = (await response.json()) as { embeddings: number[][] };
    const embeddings = data.embeddings;

    // 차원 검증
    for (const embedding of embeddings) {
      if (embedding.length !== EMBEDDING_DIMENSION) {
        throw new Error(
          `Invalid embedding dimension: expected ${EMBEDDING_DIMENSION}, got ${embedding.length}`
        );
      }
    }

    return embeddings;
  } catch (error) {
    // AbortError를 타임아웃 에러로 변환
    if (error instanceof Error && error.name === 'AbortError') {
      const timeoutError = new Error('Embedding API request timed out after 30 seconds');
      logger.error('Embedding generation timed out', timeoutError, { textCount: texts.length });
      throw timeoutError;
    }

    logger.error(
      'Embedding generation failed',
      error instanceof Error ? error : undefined,
      { textCount: texts.length }
    );

    // 폴백: 더미 임베딩 (개발/테스트용)
    if (process.env.NODE_ENV === 'development') {
      logger.warn('Using fallback dummy embeddings');
      return texts.map(() => generateDummyEmbedding());
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * 텍스트 전처리
 */
function preprocessText(text: string): string {
  return (
    text
      // 연속 공백 제거
      .replace(/\s+/g, ' ')
      // 앞뒤 공백 제거
      .trim()
      // 최대 길이 제한 (8192 토큰 ~= 16000자)
      .slice(0, 16000)
  );
}

/**
 * 개발용 더미 임베딩 생성
 */
function generateDummyEmbedding(): number[] {
  const embedding = new Array(EMBEDDING_DIMENSION);
  for (let i = 0; i < EMBEDDING_DIMENSION; i++) {
    embedding[i] = (Math.random() - 0.5) * 2;
  }
  // L2 정규화
  const norm = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
  return embedding.map((val) => val / norm);
}

/**
 * 임베딩 서버 상태 확인
 */
export async function checkEmbeddingServerHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${EMBEDDING_API_URL}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * 두 임베딩 간 코사인 유사도 계산
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Embedding dimensions must match');
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}
