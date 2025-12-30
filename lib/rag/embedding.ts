/**
 * 임베딩 생성 모듈
 * 기본: OpenAI text-embedding-3-small (1536차원)
 * 옵션: BGE-m3-ko 서버 (1024차원, EMBEDDING_API_URL 설정 시)
 */

import { logger } from '@/lib/logger';
import { trackTokenUsage } from '@/lib/usage/token-tracker';

export interface EmbeddingResult {
  embedding: number[];
  model: string;
  tokenCount?: number;
}

export interface EmbeddingTrackingContext {
  tenantId: string;
  chatbotId?: string;
}

const EMBEDDING_API_URL = process.env.EMBEDDING_API_URL;
const BGE_EMBEDDING_DIMENSION = 1024; // BGE-m3-ko 차원
const OPENAI_EMBEDDING_DIMENSION = 1536; // OpenAI text-embedding-3-small 차원
const BGE_BATCH_SIZE = 32; // BGE 배치 처리 크기
const OPENAI_BATCH_SIZE = 100; // OpenAI 배치 크기

/**
 * 현재 임베딩 차원 반환 (DB 스키마와 일치해야 함)
 */
export function getEmbeddingDimension(): number {
  return OPENAI_EMBEDDING_DIMENSION;
}

/**
 * OpenAI API 키 설정 여부 확인
 */
function isOpenAIConfigured(): boolean {
  const apiKey = process.env.OPENAI_API_KEY;
  return !!(apiKey && !apiKey.startsWith('sk-your-') && apiKey.length > 20);
}

/**
 * BGE 임베딩 서버 설정 여부 확인
 */
function isBGEServerConfigured(): boolean {
  return !!(EMBEDDING_API_URL && !EMBEDDING_API_URL.includes('localhost:8000'));
}

/**
 * 단일 텍스트 임베딩 생성
 */
export async function embedText(
  text: string,
  trackingContext?: EmbeddingTrackingContext
): Promise<number[]> {
  const result = await embedTexts([text], trackingContext);
  return result[0];
}

/**
 * 여러 텍스트 배치 임베딩 생성
 */
export async function embedTexts(
  texts: string[],
  trackingContext?: EmbeddingTrackingContext
): Promise<number[][]> {
  if (texts.length === 0) {
    return [];
  }

  // OpenAI 사용 (기본)
  if (isOpenAIConfigured()) {
    return generateOpenAIEmbeddingsBatch(texts, trackingContext);
  }

  // BGE 서버 사용 (설정된 경우)
  if (isBGEServerConfigured()) {
    return generateBGEEmbeddingsBatch(texts);
  }

  // 개발 환경 더미 임베딩
  if (process.env.NODE_ENV === 'development') {
    logger.warn('Using dummy embeddings (no embedding service configured)');
    return texts.map(() => generateDummyEmbedding());
  }

  throw new Error('No embedding service configured. Set OPENAI_API_KEY or EMBEDDING_API_URL.');
}

/**
 * OpenAI 임베딩 배치 생성
 */
async function generateOpenAIEmbeddingsBatch(
  texts: string[],
  trackingContext?: EmbeddingTrackingContext
): Promise<number[][]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OpenAI API key not configured');
  }

  const results: number[][] = [];
  let totalTokensUsed = 0;

  for (let i = 0; i < texts.length; i += OPENAI_BATCH_SIZE) {
    const batch = texts.slice(i, i + OPENAI_BATCH_SIZE);
    const processedTexts = batch.map((text) => preprocessText(text));

    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: processedTexts,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`OpenAI Embedding API error: ${response.status} - ${errorBody}`);
    }

    const data = (await response.json()) as {
      data: Array<{ embedding: number[]; index: number }>;
      usage: { prompt_tokens: number; total_tokens: number };
    };

    const sortedEmbeddings = data.data
      .sort((a, b) => a.index - b.index)
      .map((item) => item.embedding);

    results.push(...sortedEmbeddings);
    totalTokensUsed += data.usage.total_tokens;

    logger.info('OpenAI embeddings generated', {
      batchIndex: Math.floor(i / OPENAI_BATCH_SIZE),
      batchSize: batch.length,
      tokens: data.usage.total_tokens,
    });
  }

  // 토큰 사용량 추적 (비동기, 전체 배치 완료 후)
  if (trackingContext?.tenantId && totalTokensUsed > 0) {
    trackTokenUsage({
      tenantId: trackingContext.tenantId,
      chatbotId: trackingContext.chatbotId,
      modelProvider: 'openai',
      modelId: 'text-embedding-3-small',
      featureType: 'embedding',
      inputTokens: totalTokensUsed,
      outputTokens: 0, // 임베딩은 output 토큰 없음
    }).catch((err) => {
      logger.warn('Failed to track embedding token usage', { error: err });
    });
  }

  return results;
}

/**
 * BGE-m3-ko 임베딩 서버 호출
 */
async function generateBGEEmbeddingsBatch(texts: string[]): Promise<number[][]> {
  if (!EMBEDDING_API_URL) {
    throw new Error('BGE embedding server URL not configured');
  }

  const results: number[][] = [];

  for (let i = 0; i < texts.length; i += BGE_BATCH_SIZE) {
    const batch = texts.slice(i, i + BGE_BATCH_SIZE);
    const processedTexts = batch.map((text) => preprocessText(text));

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
      const response = await fetch(`${EMBEDDING_API_URL}/embed`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          texts: processedTexts,
          normalize: true,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`BGE Embedding API error: ${response.status}`);
      }

      const data = (await response.json()) as { embeddings: number[][] };
      const embeddings = data.embeddings;

      // 차원 검증
      for (const embedding of embeddings) {
        if (embedding.length !== BGE_EMBEDDING_DIMENSION) {
          throw new Error(
            `Invalid BGE embedding dimension: expected ${BGE_EMBEDDING_DIMENSION}, got ${embedding.length}`
          );
        }
      }

      results.push(...embeddings);

      logger.info('BGE embeddings generated', {
        batchIndex: Math.floor(i / BGE_BATCH_SIZE),
        batchSize: batch.length,
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('BGE Embedding API request timed out after 30 seconds');
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  return results;
}

/**
 * 텍스트 전처리
 */
function preprocessText(text: string): string {
  return (
    text
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 16000) // 최대 길이 제한
  );
}

/**
 * 개발용 더미 임베딩 생성 (1536차원, OpenAI와 동일)
 */
function generateDummyEmbedding(): number[] {
  const embedding = new Array(OPENAI_EMBEDDING_DIMENSION);
  for (let i = 0; i < OPENAI_EMBEDDING_DIMENSION; i++) {
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
  // OpenAI는 항상 사용 가능하다고 가정
  if (isOpenAIConfigured()) {
    return true;
  }

  // BGE 서버 상태 확인
  if (EMBEDDING_API_URL) {
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

  return false;
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
