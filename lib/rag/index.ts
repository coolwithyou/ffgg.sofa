/**
 * RAG (Retrieval-Augmented Generation) 모듈
 */

export { smartChunk, type ChunkOptions, type Chunk, type DocumentStructure } from './chunking';
export { embedText, embedTexts, type EmbeddingResult } from './embedding';
export {
  estimateTokenCount,
  exceedsTokenLimit,
  splitByTokenLimit,
  cosineSimilarity,
} from './embedding';
export { hybridSearch, type SearchResult } from './retrieval';
export { generateResponse, generateWithFallback, type GenerateOptions } from './generator';
export { rewriteQuery, type QueryRewriteOptions } from './query-rewriter';
export {
  lateChunk,
  addLateChunkingEmbeddings,
  type LateChunkingOptions,
  type LateChunk,
} from './late-chunking';
