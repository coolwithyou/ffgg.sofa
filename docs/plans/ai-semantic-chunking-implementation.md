# AI Semantic Chunking 구현 계획

> **작성일**: 2025-01-09
> **상태**: 설계 완료, 구현 대기
> **예상 기간**: 1주

---

## 1. 현재 상태 분석

### 1.1 이미 구현된 기능

| 기능 | 파일 | 상태 |
|------|------|------|
| 규칙 기반 청킹 | `lib/rag/chunking.ts` | ✅ 운영 중 |
| Contextual Retrieval | `lib/rag/context.ts` | ✅ 운영 중 |
| Hybrid Search (Vector + BM25) | `lib/rag/retrieval.ts` | ✅ 운영 중 |
| LLM Reranking | `lib/rag/reranker.ts` | ✅ 운영 중 |
| 임베딩 생성 | `lib/rag/embedding.ts` | ✅ 운영 중 |

### 1.2 추가 필요한 기능

| 기능 | 파일 | 상태 |
|------|------|------|
| **AI Semantic Chunking** | `lib/rag/semantic-chunking.ts` | 🆕 신규 개발 |

---

## 2. 아키텍처 설계

### 2.1 파이프라인 비교

```
[현재]
문서 → smartChunk (규칙) → Contextual → 임베딩 → 저장

[개선]
문서 → preChunk (규칙, 큰 단위) → semanticChunk (AI) → Contextual → 임베딩 → 저장
```

### 2.2 모듈 구조

```
lib/rag/
├── chunking.ts              # 기존 규칙 기반 (유지)
├── semantic-chunking.ts     # 🆕 AI 기반 청킹
├── context.ts               # Contextual Retrieval (유지)
├── embedding.ts             # 임베딩 (유지)
├── retrieval.ts             # Hybrid Search (유지)
└── reranker.ts              # LLM Reranking (유지)
```

---

## 3. 상세 설계

### 3.1 신규 파일: `lib/rag/semantic-chunking.ts`

```typescript
// lib/rag/semantic-chunking.ts

import { createAnthropic } from '@ai-sdk/anthropic';
import { generateText } from 'ai';
import { logger } from '@/lib/logger';
import { trackTokenUsage } from '@/lib/usage/token-tracker';

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
  minChunkSize?: number;      // 최소 청크 크기 (기본: 100자)
  maxChunkSize?: number;      // 최대 청크 크기 (기본: 600자)
  preChunkSize?: number;      // 1차 분할 크기 (기본: 2000자)
  model?: string;             // AI 모델 (기본: claude-3-haiku)
  batchSize?: number;         // 배치 크기 (기본: 5)
  batchDelayMs?: number;      // 배치 간 딜레이 (기본: 100ms)
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

const SEMANTIC_CHUNK_PROMPT_KO = `<segment>
{{SEGMENT}}
</segment>

위 텍스트를 의미적으로 완결된 청크들로 분할하세요.

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
]`;

const SEMANTIC_CHUNK_PROMPT_EN = `<segment>
{{SEGMENT}}
</segment>

Split the text above into semantically complete chunks.

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
]`;

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
          currentSegment = currentSegment
            ? currentSegment + '\n\n' + para
            : para;
        } else {
          if (currentSegment) segments.push(currentSegment);
          currentSegment = para;
        }
      }
      if (currentSegment) segments.push(currentSegment);
    }
  }

  return segments.filter(s => s.length > 0);
}

/**
 * AI 응답 파싱
 */
function parseAIResponse(response: string): SemanticChunkResult[] {
  try {
    // JSON 배열 추출
    const jsonMatch = response.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new Error('No JSON array found in response');
    }

    const parsed = JSON.parse(jsonMatch[0]);

    if (!Array.isArray(parsed)) {
      throw new Error('Response is not an array');
    }

    return parsed.map((item: unknown) => {
      const obj = item as Record<string, unknown>;
      return {
        content: String(obj.content || ''),
        type: String(obj.type || 'paragraph'),
        topic: String(obj.topic || ''),
      };
    }).filter(chunk => chunk.content.length > 0);

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
 */
async function chunkSegmentWithAI(
  segment: string,
  options: Required<SemanticChunkOptions>,
  trackingContext?: { tenantId: string }
): Promise<SemanticChunkResult[]> {
  const isKorean = isKoreanDocument(segment);
  const promptTemplate = isKorean ? SEMANTIC_CHUNK_PROMPT_KO : SEMANTIC_CHUNK_PROMPT_EN;
  const prompt = promptTemplate.replace('{{SEGMENT}}', segment);

  try {
    const anthropic = createAnthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    const result = await generateText({
      model: anthropic(options.model),
      prompt,
      maxOutputTokens: 4096,
      temperature: 0,
    });

    // 토큰 사용량 추적
    if (trackingContext?.tenantId) {
      await trackTokenUsage({
        tenantId: trackingContext.tenantId,
        featureType: 'semantic_chunking',
        modelProvider: 'anthropic',
        modelId: options.model,
        inputTokens: result.usage?.inputTokens ?? 0,
        outputTokens: result.usage?.outputTokens ?? 0,
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

    // 에러 시 원본 세그먼트 그대로 반환
    return [{ content: segment, type: 'paragraph', topic: '' }];
  }
}

/**
 * AI 기반 시맨틱 청킹 활성화 여부
 */
export function isSemanticChunkingEnabled(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

/**
 * 메인 시맨틱 청킹 함수
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
    logger.info('Semantic chunking disabled (no API key), using rule-based');
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
        chunkSegmentWithAI(segment, opts, trackingContext)
          .then(chunks => ({ segmentIndex: i + batchIndex, segment, chunks }))
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
      await new Promise(resolve => setTimeout(resolve, opts.batchDelayMs));
    }
  }

  // 3. 후처리: 너무 짧은 청크 병합
  const mergedChunks = mergeShortChunks(allChunks, opts.minChunkSize);

  // 4. 인덱스 재정렬
  return mergedChunks.map((chunk, idx) => ({ ...chunk, index: idx }));
}

/**
 * 너무 짧은 청크를 이전 청크와 병합
 */
function mergeShortChunks(
  chunks: SemanticChunk[],
  minSize: number
): SemanticChunk[] {
  if (chunks.length <= 1) return chunks;

  const result: SemanticChunk[] = [];

  for (const chunk of chunks) {
    if (result.length === 0) {
      result.push(chunk);
      continue;
    }

    const lastChunk = result[result.length - 1];

    // 현재 청크가 너무 짧고, 이전 청크와 같은 타입이면 병합
    if (
      chunk.content.length < minSize &&
      chunk.type === lastChunk.type
    ) {
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
 * 청킹 품질 점수 계산 (기존 호환성)
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

  // 의미없는 내용이면 감점
  const meaningfulChars = chunk.content.replace(/[\d\s\W]/g, '');
  if (meaningfulChars.length < chunk.content.length * 0.3) {
    score -= 20;
  }

  return Math.max(0, Math.min(100, score));
}
```

### 3.2 Inngest 파이프라인 수정

`inngest/functions/process-document.ts` 수정:

```typescript
// 기존 import에 추가
import {
  semanticChunk,
  isSemanticChunkingEnabled,
  calculateSemanticQualityScore,
  type SemanticChunk
} from '@/lib/rag/semantic-chunking';

// Step 3 수정
const chunkResults = await step.run('chunk-document', async () => {
  await updateDocumentProgress(documentId, 'chunking', 0);

  // AI Semantic Chunking 시도, 실패 시 규칙 기반 폴백
  if (isSemanticChunkingEnabled()) {
    const semanticChunks = await semanticChunk(
      parseResult.text,
      {
        minChunkSize: 100,
        maxChunkSize: 600,
        preChunkSize: 2000,
      },
      async (current, total) => {
        const progress = Math.round((current / total) * 100);
        await updateDocumentProgress(documentId, 'chunking', progress);
      },
      { tenantId }
    );

    return semanticChunks.map(chunk => ({
      content: chunk.content,
      index: chunk.index,
      qualityScore: calculateSemanticQualityScore(chunk),
      metadata: {
        ...chunk.metadata,
        type: chunk.type,
        topic: chunk.topic,
      },
    }));
  }

  // 폴백: 기존 규칙 기반
  const chunksData = await smartChunk(parseResult.text, {
    maxChunkSize: 500,
    overlap: 50,
    preserveStructure: true,
  });

  await updateDocumentProgress(documentId, 'chunking', 100);
  return chunksData;
});
```

---

## 4. 환경 변수

```bash
# .env.local

# AI Semantic Chunking (이미 Contextual Retrieval에서 사용 중)
ANTHROPIC_API_KEY=sk-ant-...

# 선택적: Semantic Chunking 강제 비활성화
# DISABLE_SEMANTIC_CHUNKING=true
```

---

## 5. 테스트 계획

### 5.1 단위 테스트

```typescript
// __tests__/lib/rag/semantic-chunking.test.ts

describe('semanticChunk', () => {
  it('should split Q&A pairs correctly', async () => {
    const content = `
Q: 배송은 얼마나 걸리나요?
A: 일반 배송은 2-3일, 특급 배송은 당일 도착합니다.

Q: 반품은 어떻게 하나요?
A: 7일 이내 반품 가능하며, 고객센터에 연락하시면 됩니다.
    `;

    const chunks = await semanticChunk(content);

    expect(chunks).toHaveLength(2);
    expect(chunks[0].type).toBe('qa');
    expect(chunks[0].content).toContain('배송');
    expect(chunks[1].type).toBe('qa');
    expect(chunks[1].content).toContain('반품');
  });

  it('should not split short content', async () => {
    const content = '짧은 내용입니다.';
    const chunks = await semanticChunk(content);

    expect(chunks).toHaveLength(1);
  });

  it('should fallback to rule-based when API key missing', async () => {
    const originalKey = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;

    const chunks = await semanticChunk('테스트 내용입니다.');

    expect(chunks.length).toBeGreaterThan(0);

    process.env.ANTHROPIC_API_KEY = originalKey;
  });
});
```

### 5.2 통합 테스트

```typescript
// __tests__/integration/semantic-chunking.test.ts

describe('Semantic Chunking Pipeline', () => {
  it('should process document with semantic chunking', async () => {
    // 1. 테스트 문서 업로드
    // 2. Inngest 이벤트 트리거
    // 3. 청크 결과 검증
  });

  it('should track token usage correctly', async () => {
    // 토큰 사용량 추적 검증
  });
});
```

### 5.3 A/B 테스트 계획

| 그룹 | 청킹 방식 | 측정 지표 |
|------|-----------|-----------|
| A (Control) | 규칙 기반 | 검색 정확도, 청크 수 |
| B (Treatment) | AI Semantic | 검색 정확도, 청크 수 |

측정 지표:
- 검색 정확도 (Precision@K)
- 평균 청크 수 (문서당)
- 의미없는 청크 비율
- 처리 시간
- 비용

---

## 6. 마이그레이션 전략

### 6.1 Phase 1: 신규 문서만 적용
- 기존 문서는 그대로 유지
- 신규 업로드 문서에만 Semantic Chunking 적용

### 6.2 Phase 2: 점진적 마이그레이션
- 특정 데이터셋/테넌트 선택적 재처리
- 관리자 UI에서 "재처리" 버튼으로 트리거

### 6.3 Phase 3: 전체 마이그레이션
- 성능 검증 후 전체 문서 재처리
- 기존 청크 삭제 → 새 청크 생성

---

## 7. 비용 예측

### 7.1 Semantic Chunking 비용

| 항목 | 계산 |
|------|------|
| 평균 문서 크기 | 10,000자 |
| Pre-chunk 세그먼트 수 | 5개 (2000자씩) |
| Haiku 입력 토큰 | ~3000 tokens/세그먼트 |
| Haiku 출력 토큰 | ~500 tokens/세그먼트 |
| **문서당 비용** | ~$0.004 |

### 7.2 기존 대비 비용 변화

| 단계 | 현재 | 제안 | 변화 |
|------|------|------|------|
| 청킹 | $0 | $0.004 | +$0.004 |
| Contextual | $0.008 | $0.006 (청크 감소) | -$0.002 |
| 임베딩 | $0.002 | $0.0015 (청크 감소) | -$0.0005 |
| **총계** | $0.010 | $0.0115 | +15% |

---

## 8. 롤백 계획

### 8.1 즉시 롤백
```typescript
// 환경 변수로 즉시 비활성화
DISABLE_SEMANTIC_CHUNKING=true
```

### 8.2 코드 롤백
- `isSemanticChunkingEnabled()` 반환값 false로 변경
- Inngest 파이프라인이 자동으로 규칙 기반 폴백

---

## 9. 체크리스트

### 구현 전
- [ ] 리서치 문서 검토 완료
- [ ] 설계 승인

### 구현
- [ ] `lib/rag/semantic-chunking.ts` 작성
- [ ] Inngest 파이프라인 수정
- [ ] 토큰 사용량 추적 추가
- [ ] 단위 테스트 작성

### 테스트
- [ ] 로컬 테스트 통과
- [ ] 스테이징 배포 및 테스트
- [ ] A/B 테스트 실행

### 배포
- [ ] 프로덕션 배포
- [ ] 모니터링 설정
- [ ] 롤백 계획 준비
