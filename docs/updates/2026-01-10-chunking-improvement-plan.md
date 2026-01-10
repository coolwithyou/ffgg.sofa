# 문서 청킹 알고리즘 개선 계획

> **작성 일자**: 2026-01-10
> **상태**: Phase 2 완료 ✅
> **작성자**: AI Development Team
> **관련 문서**: [하이브리드 검색 개선 계획](./2026-01-10-bm25-hybrid-search-plan.md)

---

## 개요

RAG 파이프라인의 검색 품질은 **청킹 품질**에 크게 의존합니다. 이 문서는 현재 SOFA의 청킹 시스템을 분석하고, Supabase 전환에 맞춰 개선할 수 있는 영역을 정리합니다.

### 핵심 목표

| 목표 | 설명 |
|------|------|
| **검색 정확도 향상** | 의미 단위로 정확하게 분할하여 관련 청크 검색률 향상 |
| **한국어 특화** | 한국어 문서에 최적화된 청킹 전략 |
| **Supabase 호환** | 새로운 DB 환경에서 최적의 성능 발휘 |
| **품질 일관성** | 자동 승인 비율 향상 (현재 85점 기준) |

---

## 현재 시스템 분석

### 아키텍처 개요

```
문서 업로드
    ↓
파싱 (PDF/DOCX/TXT/CSV)
    ↓
┌─────────────────────────────────────────────┐
│           청킹 전략 선택                      │
│  ┌─────────────┐    ┌─────────────────────┐ │
│  │ ANTHROPIC_  │ Y  │ AI Semantic Chunk   │ │
│  │ API_KEY?    │───→│ (Claude Haiku)      │ │
│  └─────────────┘    └─────────────────────┘ │
│         │ N                                  │
│         ↓                                    │
│  ┌─────────────────────┐                    │
│  │ Rule-based Chunk    │                    │
│  │ (smartChunk)        │                    │
│  └─────────────────────┘                    │
└─────────────────────────────────────────────┘
    ↓
Contextual Retrieval (선택)
    ↓
임베딩 생성 (OpenAI/BGE-m3-ko)
    ↓
청크 저장 + 품질 점수 계산
```

### 현재 구현 상세

#### 1. 규칙 기반 청킹 (`lib/rag/chunking.ts`)

```typescript
// 기본 설정
DEFAULT_OPTIONS = {
  maxChunkSize: 500,  // 최대 청크 크기 (자)
  overlap: 50,        // 오버랩 크기 (자)
  preserveStructure: true
}
```

**알고리즘 흐름:**
1. **구조 분석** (`analyzeStructure`)
   - 마크다운 헤더 감지: `/^#+\s/m`
   - Q&A 쌍 감지: `Q:...A:`, `질문:...답변:`
   - 테이블/리스트 감지

2. **의미 단위 분리** (`splitBySemanticUnits`)
   - 우선순위: Q&A 쌍 → 헤더 기반 → 단락 기반
   - Q&A 쌍은 반드시 함께 유지

3. **크기 조절** (`splitWithOverlap`)
   - maxChunkSize 초과 시 분할
   - 문장 경계에서 자르기 시도 (`findLastSentenceEnd`)
   - 오버랩 적용

4. **품질 점수** (`calculateQualityScore`)
   - 기본 100점에서 감/가점
   - 자동 승인 기준: 85점 이상

**품질 점수 규칙:**
| 조건 | 점수 변화 |
|------|----------|
| 100자 미만 | -20 |
| 800자 초과 | -10 |
| 문장 미완성 | -15 |
| Q&A 분리됨 | -30 |
| Q&A 쌍 | +10 |
| 헤더 포함 | +5 |
| 의미 없는 내용 (특수문자 70%↑) | -25 |

#### 2. AI 시맨틱 청킹 (`lib/rag/semantic-chunking.ts`)

```typescript
DEFAULT_OPTIONS = {
  minChunkSize: 100,   // 최소 청크 크기
  maxChunkSize: 600,   // 최대 청크 크기
  preChunkSize: 2000,  // 1차 분할 크기
  model: 'claude-3-haiku-20240307',
  batchSize: 5,
  batchDelayMs: 100
}
```

**3단계 파이프라인:**
1. **Pre-chunking**: 규칙 기반 1차 분할 (2000자 단위)
2. **AI Re-chunking**: Claude Haiku로 의미 단위 재분할
3. **Post-processing**: 짧은 청크 병합 (minChunkSize 미만)

**청크 타입 분류:**
- `paragraph`: 일반 문단
- `qa`: Q&A 쌍
- `list`: 목록
- `table`: 표
- `header`: 제목 + 설명
- `code`: 코드 블록

**한국어 프롬프트 사용:**
- `isKoreanDocument()`: 한글 비율 10% 이상 시 한국어 프롬프트 적용

#### 3. Contextual Retrieval (`lib/rag/context.ts`)

각 청크에 문서 맥락을 추가하여 검색 품질 향상:

```typescript
DEFAULT_OPTIONS = {
  maxDocumentLength: 20000,  // 컨텍스트용 문서 최대 길이
  maxContextTokens: 150,     // 컨텍스트 최대 토큰
  batchSize: 5,
  batchDelayMs: 300
}
```

**출력 예시:**
```
[Context: 이 문서는 배송 관련 FAQ입니다. 이 청크는 국제 배송 정책을 설명합니다.]

Q: 해외 배송은 얼마나 걸리나요?
A: 일반적으로 7-14일 소요됩니다.
```

---

## 현재 시스템의 강점

| 강점 | 설명 |
|------|------|
| **듀얼 전략** | AI 실패 시 규칙 기반으로 자동 폴백 |
| **Q&A 보존** | 질문-답변 쌍 분리 방지 |
| **품질 관리** | 자동/수동 승인 시스템 |
| **Contextual Retrieval** | Anthropic 2024 논문 기반 구현 |
| **한국어 지원** | 한국어 프롬프트 및 문장 끝 패턴 |

---

## 개선 가능 영역

### 1. Late Chunking (높은 우선순위)

**현재 방식 (Early Chunking):**
```
문서 → 청킹 → 각 청크별 임베딩
```

**Late Chunking (2024 연구):**
```
문서 → 전체 문서 임베딩 → 토큰 레벨에서 청크 분할 → 청크별 임베딩 풀링
```

**장점:**
- 문맥 정보가 임베딩에 포함됨
- 검색 정확도 15-20% 향상 (논문 결과)
- Contextual Retrieval과 상호 보완

**구현 고려사항:**
- 긴 문서 처리 시 토큰 제한 (OpenAI: 8192 토큰)
- 비용 증가 가능성
- 기존 Contextual Retrieval과의 조합 전략 필요

---

### 2. 한국어 형태소 기반 분할점 개선

**현재 문제:**
```typescript
// 문자 수 기반 분할 (chunking.ts:241)
const lastSentenceEnd = findLastSentenceEnd(content.slice(currentPos, endPos));

// 문장 끝 패턴
const sentenceEndPattern = /[.!?。！？다요죠]\s*/g;
```

- 단순 정규식으로 문장 끝 감지
- 형태소 분석 없이 문자 패턴만 사용
- "~합니다.", "~입니다." 외의 종결어미 누락

**개선 방안:**

```typescript
// 한국어 종결어미 확장
const KOREAN_SENTENCE_END = /(?:
  다|요|죠|니다|입니다|합니다|됩니다|습니다|  // 기본 종결어미
  네요|군요|거든요|잖아요|                      // 구어체
  ㄴ다|는다|ㄹ까|을까                           // 반말
)[.!?]?\s*/gx;
```

**고급 옵션: 형태소 분석기 연동**
- 옵션 1: Kakao Khaiii (경량)
- 옵션 2: 한국어 NLP 서버 (별도 서비스)
- 옵션 3: LLM 기반 분할점 판단 (현재 semantic-chunking과 유사)

---

### 3. 청크 크기 최적화

**현재 설정:**
| 구분 | maxChunkSize | 비고 |
|------|-------------|------|
| 규칙 기반 | 500자 | 고정 |
| AI 시맨틱 | 600자 | 고정 |

**문제점:**
- 문서 유형에 관계없이 동일한 크기 적용
- FAQ vs 기술문서 vs 계약서의 최적 크기가 다름

**개선 방안: 문서 유형별 동적 크기 조절**

```typescript
interface DocumentTypeConfig {
  faq: { maxChunkSize: 400, overlap: 30 },      // 짧은 Q&A
  technical: { maxChunkSize: 600, overlap: 80 }, // 맥락 중요
  legal: { maxChunkSize: 800, overlap: 100 },    // 조항 단위
  general: { maxChunkSize: 500, overlap: 50 }    // 기본값
}

// 문서 분류 후 설정 적용
const docType = classifyDocumentType(content);
const config = DocumentTypeConfig[docType];
```

---

### 4. Overlap 전략 개선

**현재 방식:**
```typescript
// 단순 문자 수 오버랩 (chunking.ts:265)
currentPos = endPos - overlap;  // 50자
```

**문제점:**
- 문장 중간에서 오버랩 시작 가능
- 의미 단위가 아닌 문자 단위

**개선 방안: 문장 단위 오버랩**

```typescript
function getOverlapContent(
  previousChunk: string,
  overlapSize: number
): string {
  // 마지막 N개 문장 추출
  const sentences = previousChunk.split(/[.!?다요죠]\s+/);
  const overlapSentences = sentences.slice(-2);  // 마지막 2문장
  return overlapSentences.join('. ');
}
```

---

### 5. 청크 품질 검증 고도화

**현재 방식:**
- 규칙 기반 휴리스틱 (길이, 문장 완결성 등)
- 85점 이상 자동 승인

**개선 방안: 임베딩 기반 품질 검증**

```typescript
async function validateChunkQuality(
  chunk: string,
  document: string
): Promise<number> {
  // 1. 청크 임베딩
  const chunkEmbedding = await embedText(chunk);

  // 2. 문서 전체 임베딩 (요약 또는 대표 부분)
  const docEmbedding = await embedText(document.slice(0, 2000));

  // 3. 유사도 계산 - 너무 낮으면 문맥에서 벗어난 청크
  const similarity = cosineSimilarity(chunkEmbedding, docEmbedding);

  // 4. 인접 청크와의 일관성 검증
  // ...

  return adjustedQualityScore;
}
```

---

### 6. 청크 메타데이터 강화

**현재 메타데이터:**
```typescript
metadata: {
  startOffset: number,
  endOffset: number,
  hasHeader: boolean,
  isQAPair: boolean,
  isTable: boolean,
  isList: boolean,
  // semantic-chunking 추가
  chunkType: string,
  topic: string,
  // contextual retrieval 추가
  contextPrefix: string,
  hasContext: boolean
}
```

**추가 제안:**
```typescript
metadata: {
  // 기존 필드...

  // 문서 구조 정보
  sectionPath: string[],      // ["1장", "1.2절", "주요 기능"]
  headingLevel: number,       // 1-6

  // 의미 정보
  entities: string[],         // 추출된 엔티티
  keywords: string[],         // 핵심 키워드
  language: 'ko' | 'en',      // 언어

  // 품질 정보
  sentenceCount: number,
  avgSentenceLength: number,
  readabilityScore: number,

  // 검색 최적화
  searchableTerms: string[]   // PGroonga용 검색어 목록
}
```

---

## Supabase 전환 시 고려사항

### PGroonga 최적화

```sql
-- 청크 테이블에 PGroonga 인덱스
CREATE INDEX chunks_pgroonga_idx ON chunks USING pgroonga (content);

-- 메타데이터 검색용 인덱스 (keywords, entities 등)
CREATE INDEX chunks_metadata_pgroonga_idx ON chunks
USING pgroonga ((metadata->>'keywords'));
```

### 벡터 인덱스 최적화

```sql
-- HNSW 인덱스 (Supabase pgvector)
CREATE INDEX chunks_embedding_idx ON chunks
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);
```

### RPC 함수 최적화

```sql
-- 청크 통계 함수
CREATE OR REPLACE FUNCTION get_chunk_stats(tenant TEXT)
RETURNS TABLE (
  total_chunks BIGINT,
  avg_length FLOAT,
  approved_count BIGINT,
  pending_count BIGINT,
  avg_quality_score FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT,
    AVG(LENGTH(content))::FLOAT,
    COUNT(*) FILTER (WHERE status = 'approved')::BIGINT,
    COUNT(*) FILTER (WHERE status = 'pending')::BIGINT,
    AVG(quality_score)::FLOAT
  FROM chunks
  WHERE tenant_id = tenant AND is_active = true;
END;
$$;
```

---

## 구현 우선순위

### Phase 1: 즉시 개선 ✅ 완료

| 항목 | 난이도 | 영향도 | 상태 |
|------|--------|--------|------|
| 한국어 종결어미 패턴 확장 | ★☆☆ | ★★☆ | ✅ 완료 |
| 문장 단위 오버랩 | ★★☆ | ★★☆ | ✅ 완료 |
| PGroonga 인덱스 설정 | ★☆☆ | ★★★ | ✅ 완료 |

**구현 내용:**
- `lib/rag/chunking.ts`: 한국어 종결어미 패턴 (합쇼체, 해요체, 해체) 추가
- `lib/rag/chunking.ts`: `calculateSentenceOverlap()` 함수로 문장 단위 오버랩 구현
- `drizzle/migrations/0024_pgroonga_korean_fts.sql`: PGroonga 확장 및 인덱스 설정
- `lib/rag/retrieval.ts`: PGroonga 기반 Sparse Search 구현

### Phase 2: 단기 개선 ✅ 완료

| 항목 | 난이도 | 영향도 | 상태 |
|------|--------|--------|------|
| 문서 유형별 청크 크기 | ★★☆ | ★★★ | ✅ 완료 |
| 메타데이터 강화 | ★★☆ | ★★☆ | ✅ 완료 |
| 품질 점수 규칙 정교화 | ★★☆ | ★★☆ | ✅ 완료 |

**구현 내용:**

#### 1. 문서 유형별 청크 크기 동적 조절
- `classifyDocumentType()`: FAQ/기술문서/법률문서/일반문서 자동 분류
- 문서 유형별 최적 청크 크기 설정:
  - FAQ: 400자 / 오버랩 30자
  - 기술문서: 600자 / 오버랩 80자
  - 법률문서: 800자 / 오버랩 100자
  - 일반문서: 500자 / 오버랩 50자

#### 2. 청크 메타데이터 강화
- `detectLanguage()`: 단어 기반 한국어/영어/혼합 감지
- `calculateReadabilityScore()`: 가독성 점수 (0-100)
  - 문장 길이, 어휘 다양성, 문장 완결성 기반 평가
- `sentenceCount`, `avgSentenceLength`: 문장 통계 추가

#### 3. 품질 점수 규칙 정교화
8개 평가 기준으로 정밀화:
| 기준 | 점수 변화 |
|------|----------|
| 50자 미만 | -30 |
| 100자 미만 | -20 |
| 1000자 초과 | -15 |
| 문장 미완성 | -15 |
| Q만 있음 | -30 |
| A만 있음 | -20 |
| 의미 있는 문자 20% 미만 | -30 |
| Q&A 완전한 쌍 | +10 |
| 헤더 포함 | +5 |
| 리스트/테이블 | +3 |
| 적정 문장 수 (3-10) | +3 |
| 가독성 우수 (90+) | +5 |
| 가독성 부족 (<50) | -10 |

### Phase 3: 중장기 개선 (1개월+)

| 항목 | 난이도 | 영향도 | 예상 소요 |
|------|--------|--------|----------|
| Late Chunking 구현 | ★★★ | ★★★ | 1주 |
| 임베딩 기반 품질 검증 | ★★★ | ★★☆ | 3일 |
| 형태소 분석기 연동 | ★★★ | ★★☆ | 1주 |

---

## 테스트 계획

### 청킹 품질 평가 지표

| 지표 | 설명 | 목표 |
|------|------|------|
| **자동 승인율** | qualityScore ≥ 85 비율 | 80% 이상 |
| **평균 청크 길이** | 문자 수 기준 | 300-500자 |
| **Q&A 보존율** | Q&A 쌍이 함께 있는 비율 | 95% 이상 |
| **문장 완결성** | 문장 끝으로 종료되는 비율 | 90% 이상 |

### 검색 품질 평가

| 지표 | 설명 | 측정 방법 |
|------|------|----------|
| **Recall@K** | 상위 K개에 정답 포함 | 테스트셋 |
| **MRR** | Mean Reciprocal Rank | 테스트셋 |
| **사용자 만족도** | 챗봇 응답 품질 | A/B 테스트 |

---

## 참고 자료

### 논문 및 연구
- [Late Chunking: Contextual Chunk Embeddings (2024)](https://jina.ai/news/late-chunking-in-long-context-embedding-models/)
- [Anthropic Contextual Retrieval (2024)](https://www.anthropic.com/news/contextual-retrieval)
- [Chunking 2.0: Better LLM RAG Techniques (2024)](https://www.rungalileo.io/blog/mastering-rag-8-chunking-techniques)

### 현재 코드 위치
- 규칙 기반 청킹: [lib/rag/chunking.ts](../../lib/rag/chunking.ts)
- AI 시맨틱 청킹: [lib/rag/semantic-chunking.ts](../../lib/rag/semantic-chunking.ts)
- Contextual Retrieval: [lib/rag/context.ts](../../lib/rag/context.ts)
- 문서 처리 워크플로우: [inngest/functions/process-document.ts](../../inngest/functions/process-document.ts)
- 청킹 테스트: [__tests__/lib/rag/chunking.test.ts](../../__tests__/lib/rag/chunking.test.ts)

---

## 다음 단계

1. ~~현재 청킹 시스템 분석~~ ✅ 완료
2. ~~개선 가능 영역 도출~~ ✅ 완료
3. ~~Phase 1 개선 착수~~ ✅ 완료 (한국어 패턴, 오버랩, PGroonga)
4. ~~Phase 2 개선 착수~~ ✅ 완료 (문서 유형별 크기, 메타데이터, 품질 점수)
5. **A/B 테스트 설계** ⏳ 대기 (개선 전/후 비교)
6. **Phase 3 상세 설계** ⏳ 대기
   - Late Chunking 구현
   - 임베딩 기반 품질 검증
   - 형태소 분석기 연동
