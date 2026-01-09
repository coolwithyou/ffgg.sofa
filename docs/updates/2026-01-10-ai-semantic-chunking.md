# AI Semantic Chunking 도입

> **업데이트 일자**: 2026-01-10
> **커밋**: `adf67a3`
> **작성자**: AI Development Team

---

## 개요

RAG 파이프라인의 문서 청킹 품질을 개선하기 위해 **AI 기반 Semantic Chunking**을 도입했습니다. 기존 규칙 기반 청킹의 한계(의미 단위 무시, Q&A 쌍 분리)를 해결하고, 업계 최신 트렌드(Agentic Chunking, Contextual Retrieval)에 맞춰 파이프라인을 업그레이드했습니다.

---

## 변경 사항

### Before (규칙 기반 청킹)

```
문서 → smartChunk() → 임베딩
         ↓
    - 500자 고정 분할
    - 50자 오버랩
    - 정규식 기반 Q&A 감지
```

**문제점:**
- 문자 수 기반 분할로 의미 단위 무시
- Q&A 쌍이 분리되어 답변 누락 가능
- 의미없는 청크 다수 생성 → 검색 노이즈 증가

### After (AI Semantic Chunking)

```
문서 → Pre-chunk (2000자) → AI Re-chunk (100-600자) → 임베딩
         규칙 기반              Claude Haiku
                                    ↓
                          - 의미 완결성 우선
                          - Q&A 쌍 자동 유지
                          - 주제별 분류 (topic)
```

**개선점:**
- LLM이 문맥을 이해하여 적절한 지점에서 분할
- Q&A, 목록, 표, 코드 블록 등 구조 유지
- 청크별 타입/주제 메타데이터 자동 추출

---

## 파일 변경 내역

### 신규 파일

| 파일 | 설명 |
|------|------|
| `lib/rag/semantic-chunking.ts` | AI Semantic Chunking 핵심 모듈 (459줄) |
| `docs/research/semantic-chunking-research.md` | RAG 청킹 트렌드 리서치 문서 |
| `docs/plans/ai-semantic-chunking-implementation.md` | 구현 계획서 |

### 수정 파일

| 파일 | 변경 내용 |
|------|----------|
| `lib/usage/types.ts` | `FeatureType`에 `'semantic_chunking'` 추가 |
| `inngest/functions/process-document.ts` | Step 3 청킹 로직에 AI Semantic Chunking 통합 |

---

## 주요 코드 변경

### 1. FeatureType 확장

```typescript
// lib/usage/types.ts
export type FeatureType =
  | 'chat'
  | 'embedding'
  | 'rewrite'
  | 'context_generation'
  | 'rerank'
  | 'semantic_chunking';  // 신규 추가
```

### 2. 청킹 파이프라인 분기

```typescript
// inngest/functions/process-document.ts
if (isSemanticChunkingEnabled()) {
  // AI Semantic Chunking
  const semanticChunks = await semanticChunk(
    parseResult.text,
    { minChunkSize: 100, maxChunkSize: 600, preChunkSize: 2000 },
    progressCallback,
    { tenantId }
  );
  // ...
} else {
  // 폴백: 기존 규칙 기반 청킹
  const chunksData = await smartChunk(/* ... */);
}
```

### 3. Semantic Chunking 모듈 핵심 함수

```typescript
// lib/rag/semantic-chunking.ts

// 활성화 여부 확인
export function isSemanticChunkingEnabled(): boolean;

// 메인 청킹 함수
export async function semanticChunk(
  content: string,
  options?: SemanticChunkOptions,
  onProgress?: (current: number, total: number) => void,
  trackingContext?: { tenantId: string }
): Promise<SemanticChunk[]>;

// 품질 점수 계산
export function calculateSemanticQualityScore(chunk: SemanticChunk): number;
```

---

## 활성화 방법

### 환경변수 설정

```bash
# .env.local

# AI Semantic Chunking 활성화 (필수)
ANTHROPIC_API_KEY=sk-ant-xxxxx

# 강제 비활성화 (선택)
# DISABLE_SEMANTIC_CHUNKING=true
```

### 활성화 조건 표

| 환경변수 | 값 | 결과 |
|----------|-----|------|
| `ANTHROPIC_API_KEY` | 설정됨 | ✅ AI Semantic Chunking 활성화 |
| `ANTHROPIC_API_KEY` | 미설정 | ⚠️ 규칙 기반 폴백 |
| `DISABLE_SEMANTIC_CHUNKING` | `true` | ❌ 강제 비활성화 |

---

## 청크 타입 분류

AI가 자동으로 분류하는 청크 타입:

| 타입 | 설명 | 예시 |
|------|------|------|
| `paragraph` | 일반 문단 | 설명문, 본문 텍스트 |
| `qa` | Q&A 쌍 | FAQ, 질문-답변 세트 |
| `list` | 목록 | 순서/비순서 목록 |
| `table` | 표 | 데이터 테이블 |
| `header` | 제목 + 설명 | 섹션 헤더와 도입부 |
| `code` | 코드 블록 | 소스 코드 스니펫 |

---

## 성능 및 비용

### 예상 효과

| 지표 | Before | After (예상) | 근거 |
|------|--------|--------------|------|
| 검색 정확도 | Baseline | **+70%** | Firecrawl 2025 가이드 |
| 의미없는 청크 | 다수 | **30-50% 감소** | 의미 단위 분할 |
| Q&A 쌍 손상 | 발생 가능 | **거의 없음** | LLM 문맥 이해 |

### 비용 분석

| 항목 | 비용 |
|------|------|
| 청킹 비용 (Haiku) | ~$0.005/문서 |
| 모델 | Claude 3 Haiku |
| 입력 토큰 | ~$0.25/1M tokens |
| 출력 토큰 | ~$1.25/1M tokens |

> **참고**: 기존 Contextual Retrieval 대비 청크 수 감소로 전체 파이프라인 비용 절감 가능

---

## 기술 스택

- **LLM**: Claude 3 Haiku (`claude-3-haiku-20240307`)
- **AI SDK**: Vercel AI SDK (`@ai-sdk/anthropic`)
- **워크플로우**: Inngest (이벤트 기반 백그라운드 처리)

---

## 참고 문서

- [리서치 문서](../research/semantic-chunking-research.md) - RAG 청킹 트렌드 조사
- [구현 계획서](../plans/ai-semantic-chunking-implementation.md) - 상세 설계 및 코드 템플릿

### 외부 참고 자료

- [Anthropic - Contextual Retrieval](https://www.anthropic.com/news/contextual-retrieval)
- [NVIDIA - Finding the Best Chunking Strategy](https://developer.nvidia.com/blog/finding-the-best-chunking-strategy-for-accurate-ai-responses/)
- [Firecrawl - Best Chunking Strategies for RAG in 2025](https://www.firecrawl.dev/blog/best-chunking-strategies-rag-2025)

---

## 다음 단계 (로드맵)

리서치 문서에서 제안된 후속 작업:

- [ ] **Phase 2**: Hybrid Indexing (Vector + BM25)
- [ ] **Phase 3**: Reranking 도입
- [ ] **Phase 4**: Prompt Caching 비용 최적화
- [ ] **Phase 5**: A/B 테스트 및 품질 검증

---

## 문의

구현 관련 질문이나 이슈는 `lib/rag/semantic-chunking.ts` 파일의 주석 또는 Slack #dev-sofa 채널을 참고해주세요.
