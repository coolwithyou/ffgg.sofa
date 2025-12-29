/**
 * Contextual Retrieval - Context 생성 모듈
 * Anthropic Claude를 사용하여 청크에 컨텍스트 추가
 *
 * @see https://www.anthropic.com/news/contextual-retrieval
 */

import { generateText } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { logger } from '@/lib/logger';

export interface ContextResult {
  chunkIndex: number;
  contextPrefix: string;
  prompt?: string; // 디버깅/리뷰용 프롬프트 저장
}

export interface ContextGenerationOptions {
  maxDocumentLength?: number; // 문서 최대 길이 (기본 20000자)
  maxContextTokens?: number; // 컨텍스트 최대 토큰 (기본 100)
  batchSize?: number; // 동시 처리 수 (기본 10)
  batchDelayMs?: number; // 배치 간 딜레이 (기본 200ms)
  savePrompt?: boolean; // 프롬프트 저장 여부 (기본 false)
}

const DEFAULT_OPTIONS: Required<ContextGenerationOptions> = {
  maxDocumentLength: 20000,
  maxContextTokens: 150,
  batchSize: 10,
  batchDelayMs: 200,
  savePrompt: true, // 리뷰 UI에서 확인하기 위해 기본값 true
};

// 한글 프롬프트 (문서가 한글인 경우 더 좋은 품질)
const CONTEXT_PROMPT_KO = `<document>
{{WHOLE_DOCUMENT}}
</document>

다음은 위 문서에서 추출한 청크입니다:
<chunk>
{{CHUNK_CONTENT}}
</chunk>

이 청크가 전체 문서에서 어떤 맥락에 있는지 간결하게 설명해주세요.
검색 시 이 청크를 더 잘 찾을 수 있도록 도움이 되는 컨텍스트만 작성하세요.
컨텍스트만 응답하고 다른 설명은 하지 마세요.`;

// 영문 프롬프트 (Anthropic 권장)
const CONTEXT_PROMPT_EN = `<document>
{{WHOLE_DOCUMENT}}
</document>

Here is the chunk we want to situate within the whole document:
<chunk>
{{CHUNK_CONTENT}}
</chunk>

Please give a short succinct context to situate this chunk within the overall document for the purposes of improving search retrieval of the chunk. Answer only with the succinct context and nothing else.`;

// 비용 효율적인 모델 사용
const CONTEXT_MODEL = 'claude-3-haiku-20240307';

/**
 * Anthropic API 사용 가능 여부 확인
 */
export function isContextGenerationEnabled(): boolean {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  return !!(apiKey && apiKey.length > 20 && !apiKey.includes('your-'));
}

/**
 * 문서가 주로 한글인지 감지
 */
function isKoreanDocument(text: string): boolean {
  const koreanChars = text.match(/[가-힣]/g)?.length || 0;
  const totalChars = text.replace(/\s/g, '').length;
  return totalChars > 0 && koreanChars / totalChars > 0.3;
}

/**
 * 프롬프트 생성
 */
function buildPrompt(
  fullDocument: string,
  chunkContent: string,
  maxDocLength: number
): string {
  const isKorean = isKoreanDocument(fullDocument);
  const template = isKorean ? CONTEXT_PROMPT_KO : CONTEXT_PROMPT_EN;

  // 문서가 너무 길면 청크 주변 컨텍스트만 포함
  let docToUse = fullDocument;
  if (fullDocument.length > maxDocLength) {
    const chunkPos = fullDocument.indexOf(chunkContent);
    if (chunkPos !== -1) {
      // 청크 주변 텍스트 추출
      const halfLength = Math.floor(maxDocLength / 2);
      const start = Math.max(0, chunkPos - halfLength);
      const end = Math.min(fullDocument.length, chunkPos + chunkContent.length + halfLength);
      docToUse = fullDocument.slice(start, end);

      if (start > 0) docToUse = '...' + docToUse;
      if (end < fullDocument.length) docToUse = docToUse + '...';
    } else {
      // 청크를 찾지 못하면 앞부분만 사용
      docToUse = fullDocument.slice(0, maxDocLength) + '...';
    }
  }

  return template
    .replace('{{WHOLE_DOCUMENT}}', docToUse)
    .replace('{{CHUNK_CONTENT}}', chunkContent);
}

/**
 * 단일 청크에 대한 컨텍스트 생성
 */
export async function generateChunkContext(
  fullDocument: string,
  chunkContent: string,
  options: ContextGenerationOptions = {}
): Promise<{ contextPrefix: string; prompt: string }> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const prompt = buildPrompt(fullDocument, chunkContent, opts.maxDocumentLength);

  try {
    const anthropic = createAnthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    const result = await generateText({
      model: anthropic(CONTEXT_MODEL),
      prompt,
      maxOutputTokens: opts.maxContextTokens,
      temperature: 0,
    });

    return {
      contextPrefix: result.text.trim(),
      prompt: opts.savePrompt ? prompt : '',
    };
  } catch (error) {
    logger.warn('Context generation failed', {
      error: error instanceof Error ? error.message : 'Unknown',
      chunkPreview: chunkContent.slice(0, 100),
    });
    return { contextPrefix: '', prompt: opts.savePrompt ? prompt : '' };
  }
}

/**
 * 여러 청크에 대한 컨텍스트 배치 생성
 */
export async function generateContextsBatch(
  fullDocument: string,
  chunks: Array<{ index: number; content: string }>,
  options: ContextGenerationOptions = {},
  onProgress?: (current: number, total: number) => void
): Promise<ContextResult[]> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const results: ContextResult[] = [];

  logger.info('Starting context generation batch', {
    totalChunks: chunks.length,
    model: CONTEXT_MODEL,
    batchSize: opts.batchSize,
  });

  // 배치 처리 (rate limit 고려)
  for (let i = 0; i < chunks.length; i += opts.batchSize) {
    const batch = chunks.slice(i, i + opts.batchSize);

    const batchResults = await Promise.all(
      batch.map(async (chunk) => {
        const { contextPrefix, prompt } = await generateChunkContext(
          fullDocument,
          chunk.content,
          opts
        );
        return {
          chunkIndex: chunk.index,
          contextPrefix,
          prompt: opts.savePrompt ? prompt : undefined,
        };
      })
    );

    results.push(...batchResults);

    // 진행률 콜백
    if (onProgress) {
      onProgress(Math.min(i + opts.batchSize, chunks.length), chunks.length);
    }

    // Rate limit 대응 (배치 간 딜레이)
    if (i + opts.batchSize < chunks.length) {
      await new Promise((resolve) => setTimeout(resolve, opts.batchDelayMs));
    }
  }

  const successCount = results.filter((r) => r.contextPrefix.length > 0).length;
  const avgLength = results.length > 0
    ? Math.round(results.reduce((sum, r) => sum + r.contextPrefix.length, 0) / results.length)
    : 0;

  logger.info('Context generation completed', {
    totalChunks: chunks.length,
    successCount,
    failureCount: chunks.length - successCount,
    avgContextLength: avgLength,
  });

  return results;
}

/**
 * 컨텍스트가 포함된 청크 텍스트 생성 (임베딩용)
 */
export function buildContextualContent(content: string, contextPrefix?: string): string {
  if (!contextPrefix || contextPrefix.length === 0) {
    return content;
  }
  return `${contextPrefix}\n\n${content}`;
}
