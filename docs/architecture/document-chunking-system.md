# SOFA 문서 처리 및 청킹 시스템

## 개요

SOFA의 RAG 파이프라인은 업로드된 문서를 챗봇이 검색하고 활용할 수 있는 청크 단위로 분할합니다. 이 문서는 현재 구현된 문서 처리 플로우와 청킹 알고리즘을 상세히 설명합니다.

---

## 1. 문서 처리 파이프라인

### 1.1 전체 플로우

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              문서 처리 파이프라인                                │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│   [업로드]  →  [파싱]  →  [청킹]  →  [컨텍스트 생성]  →  [임베딩]  →  [저장]     │
│      │          │          │              │                 │           │       │
│      ▼          ▼          ▼              ▼                 ▼           ▼       │
│   R2/S3     텍스트       청크         Contextual       벡터화      PostgreSQL   │
│   저장       추출        분할          Retrieval       (OpenAI)    + pgvector   │
│                                        (Claude)                                  │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 처리 단계별 상세

| 단계 | 파일 위치 | 설명 |
|------|-----------|------|
| 업로드 | `app/api/documents/upload/route.ts` | 파일 검증, R2 저장, Inngest 이벤트 발송 |
| 파싱 | `lib/parsers/` | PDF, DOCX, XLSX, TXT, MD, JSON, CSV 지원 |
| 청킹 | `lib/rag/chunking.ts`, `lib/rag/semantic-chunking.ts`, `lib/rag/late-chunking.ts` | 3가지 전략 |
| 컨텍스트 | `lib/rag/context.ts` | Claude로 청크별 컨텍스트 생성 (Contextual Retrieval) |
| 임베딩 | `lib/rag/embedding.ts` | OpenAI text-embedding-3-small |
| 저장 | `inngest/functions/process-document.ts` | chunks 테이블에 배치 저장 |

### 1.3 Inngest 워크플로우

```typescript
// inngest/functions/process-document.ts

Step 0: cleanup-previous-data      // 재처리 시 이전 데이터 정리
Step 1: initialize-processing       // 문서 상태 초기화, 실험 설정 조회
Step 2: parse-document             // 파일 다운로드 → 텍스트 추출
Step 3: chunk-document             // 청킹 전략에 따른 분할
Step 3.5: generate-contexts        // Contextual Retrieval (선택적)
Step 4: generate-embeddings        // 벡터 임베딩 생성
Step 5: save-chunks                // DB 저장 + 품질 점수 기반 자동 승인
Step 6: update-status              // 문서 최종 상태 업데이트
Step 7: update-dataset-stats       // 데이터셋 통계 갱신
Step 7.5: trigger-rag-regeneration // 연결된 챗봇 RAG 인덱스 재생성
Step 8: notify-admin               // 검토 필요 시 알림 발송
```

---

## 2. 청킹 전략

### 2.1 전략 비교 요약

| 전략 | 모델 | 비용 | 특징 | 최적 사용 케이스 |
|------|------|------|------|-----------------|
| **Smart** | 규칙 기반 | 무료 | 한국어 종결어미 인식, 구조 보존 | FAQ, 일반 문서 |
| **Semantic** | Claude Haiku | 포인트 | AI가 의미 단위 분석 | 복잡한 기술 문서 |
| **Late** | 규칙 기반 + 임베딩 | 무료 | 문맥 보존 임베딩 | 연구/실험 목적 |

### 2.2 Smart Chunking (규칙 기반)

**파일**: `lib/rag/chunking.ts`

```typescript
export async function smartChunk(
  content: string,
  options: Partial<ChunkOptions> = {}
): Promise<Chunk[]>
```

#### 핵심 알고리즘

1. **문서 유형 자동 분류** (`classifyDocumentType`)
   ```typescript
   type DocumentType = 'faq' | 'technical' | 'legal' | 'general';

   // 유형별 최적 설정
   faq:       { maxChunkSize: 400, overlap: 30 }   // 짧은 Q&A 단위
   technical: { maxChunkSize: 600, overlap: 80 }   // 맥락 중요
   legal:     { maxChunkSize: 800, overlap: 100 }  // 조항 단위
   general:   { maxChunkSize: 500, overlap: 50 }   // 기본값
   ```

2. **구조 분석** (`analyzeStructure`)
   - 마크다운 헤더 (`^#+\s`)
   - Q&A 쌍 (`Q:...A:`, `질문:...답변:`)
   - 테이블 (`|...|...|`)
   - 목록 (`-`, `*`, `1.`)

3. **의미 단위 분리** (`splitBySemanticUnits`)
   - Q&A 쌍 우선 보존
   - 헤더 기반 섹션 분리
   - 단락 기반 분리 (폴백)

4. **한국어 문장 경계 감지**
   ```typescript
   // 종결어미 패턴
   const KOREAN_SENTENCE_END_PATTERN =
     /(?:습니다|입니다|됩니다|합니다|습니까|입니까|네요|군요|거든요|
        잖아요|나요|가요|을까요|ㄹ까요|세요|어요|아요|죠|요|다|냐|니|자)[.!?。！？]?\s+/g;
   ```

5. **문장 단위 오버랩**
   - 단순 문자 수 중복 대신 완전한 문장 보존
   - 마지막 1-2 문장을 다음 청크 시작으로 사용

#### 품질 점수 계산 (0-100)

```typescript
function calculateQualityScore(chunk: Chunk): number {
  let score = 100;

  // 1. 길이 평가
  if (content.length < 50) score -= 30;      // 매우 짧음
  if (content.length > 1000) score -= 15;    // 매우 긺

  // 2. 문장 완결성
  if (!endsWithCompleteSentence) score -= 15;

  // 3. Q&A 쌍 무결성
  if (hasQuestion && !hasAnswer) score -= 30; // Q만 있음
  if (!hasQuestion && hasAnswer) score -= 20; // A만 있음

  // 4. 의미 있는 콘텐츠 비율
  if (meaningfulRatio < 0.2) score -= 30;    // 20% 미만

  // 5. 구조적 요소 가산점
  if (isQAPair) score += 10;
  if (hasHeader) score += 5;
  if (isList) score += 3;
  if (isTable) score += 3;

  // 6. 가독성 점수 반영
  if (readabilityScore < 50) score -= 10;
  if (readabilityScore >= 90) score += 5;

  return Math.max(0, Math.min(100, score));
}
```

#### 자동 필터링

```typescript
// isHeaderOrSeparatorOnly(): 다음 청크는 자동 제외
// - 마크다운 헤더만 있는 청크 (## 제목)
// - 구분자만 있는 청크 (---, ***, ===)
// - 의미 있는 내용이 20자 미만인 청크
```

### 2.3 Semantic Chunking (AI 기반)

**파일**: `lib/rag/semantic-chunking.ts`

```typescript
export async function semanticChunk(
  content: string,
  options: SemanticChunkOptions = {},
  onProgress?: (current: number, total: number) => void,
  trackingContext?: { tenantId: string }
): Promise<SemanticChunk[]>
```

#### 3단계 파이프라인

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Semantic Chunking 파이프라인                      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  [1. Pre-chunking]  →  [2. AI Re-chunking]  →  [3. Post-processing] │
│        │                      │                        │             │
│        ▼                      ▼                        ▼             │
│   규칙 기반             Claude Haiku              짧은 청크          │
│   2000자 단위          의미 단위 분석             병합               │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

#### 1단계: Pre-chunking (`preChunk`)

```typescript
// 마크다운 문서: 헤더(#) 기준 분할
if (hasMarkdownHeaders) {
  majorSplits = content.split(/(?=^#{1,3}\s)/gm);
}

// 일반 텍스트: 빈 줄 기준 분할
else {
  majorSplits = content.split(/\n\n+/);
}

// 큰 세그먼트는 문장 경계 기반 재분할
if (segment.length > preChunkSize) {
  subSegments = splitByNaturalBoundaries(segment, preChunkSize);
}
```

#### 2단계: AI Re-chunking (`chunkSegmentWithAI`)

**시스템 프롬프트** (Prompt Caching 적용으로 90% 비용 절감):
```
당신은 텍스트를 의미적으로 완결된 청크들로 분할하는 전문가입니다.

## 분할 규칙
1. 각 청크는 하나의 완결된 개념/주제를 담아야 함
2. Q&A 쌍(질문+답변)은 반드시 함께 유지
3. 목록은 가능한 한 단위로 유지
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
JSON 배열만 출력
[
  {"content": "청크 내용", "type": "paragraph", "topic": "주제 키워드"}
]
```

**API 호출**:
```typescript
const result = await generateWithCache({
  model: 'claude-3-haiku-20240307',
  systemPrompt,  // 캐싱됨
  userPrompt: `<segment>\n${segment}\n</segment>`,  // 캐싱되지 않음
  maxOutputTokens: 4096,
  temperature: 0,
});
```

**폴백 로직**:
- AI 응답 파싱 실패 → `smartChunk()` 호출
- API 에러 → `smartChunk()` 호출

#### 3단계: Post-processing (`mergeShortChunks`)

```typescript
// 너무 짧은 청크(minChunkSize 미만)를 이전 청크와 병합
// 같은 타입인 경우에만 병합
if (chunk.content.length < minSize && chunk.type === lastChunk.type) {
  lastChunk.content += '\n\n' + chunk.content;
}
```

#### 청크 타입 및 토픽

```typescript
interface SemanticChunk {
  content: string;
  type: 'paragraph' | 'qa' | 'list' | 'table' | 'header' | 'code';
  topic: string;  // AI가 추론한 주제 키워드
  index: number;
  metadata: {
    startOffset: number;
    endOffset: number;
    originalSegmentIndex: number;
  };
}
```

### 2.4 Late Chunking (문맥 보존 임베딩)

**파일**: `lib/rag/late-chunking.ts`

**참고**: [Jina AI Late Chunking 논문](https://jina.ai/news/late-chunking-in-long-context-embedding-models/)

```typescript
export async function lateChunk(
  content: string,
  options: LateChunkingOptions = {}
): Promise<LateChunk[]>
```

#### 기존 방식 vs Late Chunking

```
┌─────────────────────────────────────────────────────────────────────┐
│                      Early Chunking (기존)                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  문서 → [청크1, 청크2, 청크3] → [임베딩1, 임베딩2, 임베딩3]         │
│                                                                      │
│  문제: 각 청크가 독립적으로 임베딩되어 문맥 손실                     │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                      Late Chunking (신규)                           │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  문서 → [세그먼트1, 세그먼트2] → [전체 임베딩] → 청크별 풀링        │
│                                                                      │
│  장점: 전체 문맥을 반영한 임베딩 생성                                │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

#### 처리 플로우

```typescript
// 1. 토큰 제한에 맞게 세그먼트 분할 (8000 토큰)
const segments = splitByTokenLimit(content, maxTokensPerSegment);

// 2. 세그먼트별 임베딩 생성
const segmentEmbeddings = await embedTexts(segments);

// 3. 전체 문서 대표 임베딩 (평균 풀링)
const documentEmbedding = poolEmbeddings(segmentEmbeddings, 'mean');

// 4. smartChunk로 청크 경계 결정
const chunks = await smartChunk(content);

// 5. 각 청크에 해당하는 세그먼트 임베딩 풀링
for (const chunk of chunks) {
  const { relevantEmbeddings, weights } = findRelevantSegmentEmbeddings(chunk);
  chunkEmbedding = weightedPoolEmbeddings(relevantEmbeddings, weights);
}
```

#### 풀링 전략

| 전략 | 설명 |
|------|------|
| `mean` | 관련 세그먼트 임베딩의 평균 |
| `max` | 각 차원의 최대값 |
| `weighted` (기본) | 겹침 비율 × 품질 점수로 가중 평균 |

#### 임베딩 기반 품질 보정

```typescript
function adjustQualityWithEmbedding(baseScore, documentSimilarity): number {
  // 문서 전체와의 유사도가 낮으면 문맥 이탈로 판단
  if (documentSimilarity < 0.5) return baseScore - 15;  // 문맥 이탈
  if (documentSimilarity < 0.7) return baseScore - 5;   // 약한 연관
  if (documentSimilarity > 0.9) return baseScore + 5;   // 강한 연관
}
```

---

## 3. 전략 선택 로직

### 3.1 우선순위

```
┌─────────────────────────────────────────────────────────────────────┐
│                       전략 결정 우선순위                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  1. user_selected    ← 사용자가 UI에서 명시적 선택 (최우선)         │
│          ↓                                                           │
│  2. ab_test          ← A/B 테스트 활성화 시 트래픽 분배              │
│          ↓                                                           │
│  3. fixed_strategy   ← 챗봇 experimentConfig 설정                   │
│          ↓                                                           │
│  4. global_setting   ← 환경변수 기본 설정                            │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 3.2 전략 결정 함수

**파일**: `lib/rag/experiment.ts`

```typescript
export function determineChunkingStrategy(
  chatbotId: string,
  experimentConfig: ExperimentConfig | null,
  documentId?: string
): ChunkingStrategyResult {
  // 1. experimentConfig 없으면 글로벌 설정
  if (!experimentConfig) {
    return {
      strategy: isSemanticChunkingEnabled() ? 'semantic' : 'smart',
      variant: null,
      reason: 'global_setting',
    };
  }

  // 2. A/B 테스트 활성화 시
  if (experimentConfig.abTestEnabled) {
    const isSemanticVariant = documentId
      ? getConsistentVariant(documentId, semanticPercent) === 'treatment'
      : Math.random() * 100 < semanticPercent;

    return {
      strategy: isSemanticVariant ? 'semantic' : 'smart',
      variant: isSemanticVariant ? 'treatment' : 'control',
      reason: 'ab_test',
    };
  }

  // 3. 고정 전략
  return {
    strategy: experimentConfig.chunkingStrategy,
    variant: null,
    reason: 'fixed_strategy',
  };
}
```

### 3.3 A/B 테스트 일관된 분배

```typescript
// FNV-1a 해시로 동일 문서가 항상 같은 그룹에 배정
export function getConsistentVariant(
  documentId: string,
  semanticTrafficPercent: number
): ExperimentVariant {
  let hash = 2166136261; // FNV offset basis
  for (let i = 0; i < documentId.length; i++) {
    hash ^= documentId.charCodeAt(i);
    hash = Math.imul(hash, 16777619); // FNV prime
  }
  const bucket = Math.abs(hash) % 100;
  return bucket < semanticTrafficPercent ? 'treatment' : 'control';
}
```

### 3.4 ExperimentConfig 타입

**파일**: `types/experiment.ts`

```typescript
export interface ExperimentConfig {
  chunkingStrategy: ChunkingStrategy;      // 'smart' | 'semantic' | 'late' | 'auto'
  abTestEnabled: boolean;                   // A/B 테스트 활성화
  semanticTrafficPercent?: number;          // semantic 트래픽 비율 (0-100)
  experimentStartedAt?: string;             // 실험 시작일 (ISO 8601)
  experimentEndedAt?: string;               // 실험 종료일 (ISO 8601)
  experimentNote?: string;                  // 실험 메모
}

export type ChunkingStrategyReason =
  | 'global_setting'    // 환경변수/기본 설정
  | 'ab_test'           // A/B 테스트 분배
  | 'fixed_strategy'    // 챗봇 고정 전략
  | 'user_selected';    // 사용자 UI 선택
```

---

## 4. 청크 메타데이터

### 4.1 저장 구조

```typescript
// chunks 테이블 metadata JSONB 필드
{
  // 위치 정보
  startOffset: number;
  endOffset: number;

  // 구조 정보
  hasHeader: boolean;
  isQAPair: boolean;
  isTable: boolean;
  isList: boolean;

  // Smart Chunking 추가 정보
  documentType?: 'faq' | 'technical' | 'legal' | 'general';
  sentenceCount?: number;
  avgSentenceLength?: number;
  language?: 'ko' | 'en' | 'mixed';
  readabilityScore?: number;

  // Semantic Chunking 추가 정보
  chunkType?: 'paragraph' | 'qa' | 'list' | 'table' | 'header' | 'code';
  topic?: string;

  // 실험 정보 (A/B 테스트)
  chunkingStrategy: 'smart' | 'semantic' | 'late';
  experimentVariant: 'control' | 'treatment' | null;
  strategyReason: ChunkingStrategyReason;

  // Contextual Retrieval
  contextPrefix?: string;
  contextPrompt?: string;
  hasContext?: boolean;
}
```

### 4.2 품질 점수 기반 자동 승인

```typescript
// 85점 이상: 자동 승인 (approved)
// 85점 미만: 검토 대기 (pending)
status: chunk.qualityScore >= 85 ? 'approved' : 'pending',
autoApproved: chunk.qualityScore >= 85,
```

---

## 5. 환경 변수

| 변수 | 설명 | 기본값 |
|------|------|--------|
| `ANTHROPIC_API_KEY` | Semantic Chunking + Contextual Retrieval | - |
| `DISABLE_SEMANTIC_CHUNKING` | Semantic Chunking 비활성화 | `false` |
| `OPENAI_API_KEY` | 임베딩 생성 (text-embedding-3-small) | - |

---

## 6. 향후 개선 방향

### 6.1 현재 한계점

1. **물리적 문서 구조 의존**: 페이지 브레이크, 줄바꿈으로 인한 의미 단절
2. **헤더-본문 분리**: 공백/줄바꿈으로 헤더가 분리되면 연결 관계 손실
3. **원본 텍스트 보존**: 모든 전략이 원본 텍스트를 그대로 사용 (재구성 없음)

### 6.2 검토 중인 개선안

- **Document Restructuring**: LLM이 문서 전체를 이해하고 RAG에 최적화된 형태로 재구성
- **연락처/목록 통합**: 페이지에 걸쳐 분리된 항목을 의미 단위로 병합
- **헤더-본문 연결**: 문맥 기반으로 헤더와 관련 본문 연결

---

## 관련 파일

| 파일 | 설명 |
|------|------|
| `lib/rag/chunking.ts` | Smart Chunking 알고리즘 |
| `lib/rag/semantic-chunking.ts` | Semantic Chunking 알고리즘 |
| `lib/rag/late-chunking.ts` | Late Chunking 알고리즘 |
| `lib/rag/experiment.ts` | A/B 테스트 및 전략 결정 로직 |
| `types/experiment.ts` | 실험 관련 타입 정의 |
| `inngest/functions/process-document.ts` | 문서 처리 워크플로우 |
| `inngest/client.ts` | Inngest 이벤트 타입 정의 |
| `app/api/documents/upload/route.ts` | 문서 업로드 API |
| `app/api/documents/preview/chunk/route.ts` | 청킹 미리보기 API |
