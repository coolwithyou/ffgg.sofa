# 채팅 응답 성능 최적화

> 작성일: 2024-12-30
> 작성자: AI Assistant

## 개요

채팅 응답 API (`/api/chat`)의 응답 시간을 **~4.5초에서 ~2.5초**로 개선한 최적화 내용을 정리합니다.

## 문제 분석

### 기존 성능 측정 결과

| 단계 | 소요 시간 | 설명 |
|------|----------|------|
| 1_chatbot_lookup | 305ms | 챗봇 조회 |
| 2_session_lookup | 42ms | 세션 조회/생성 |
| 3_cache_lookup | **898ms** | 캐시 조회 (임베딩 생성 포함) |
| 4_history_lookup | 102ms | 대화 히스토리 조회 |
| 5_query_rewriting | **1115ms** | 쿼리 재작성 (LLM 호출) |
| 6_hybrid_search | **814ms** | 하이브리드 검색 (임베딩 + BM25) |
| 8_llm_generation | 709ms | LLM 응답 생성 |
| 9_message_save | 57ms | 메시지 저장 |
| 10_usage_log | 43ms | 사용량 기록 |
| 11_cache_save | ~600ms | 캐시 저장 (임베딩 생성 포함) |
| **총 소요시간** | **~4542ms** | - |

### 핵심 병목 요인

1. **임베딩 중복 생성**: 동일 쿼리에 대해 캐시 조회, 검색, 캐시 저장에서 각각 임베딩 생성 (~800ms x 2-3회)
2. **캐시 유사도 검색**: 임베딩 기반 유사도 검색이 해시 매칭보다 ~800ms 느림
3. **Query Rewriting**: 후속 질문 시 LLM 호출 필수 (~1초)

## 적용된 최적화

### 1. 캐시 유사도 검색 비활성화 (~800ms 절감)

**파일**: [lib/chat/cache.ts](../lib/chat/cache.ts)

```typescript
// 캐시 유사도 검색 비활성화 플래그
const ENABLE_SIMILARITY_SEARCH = false;
```

**효과**:
- 캐시 조회 시 임베딩 생성 스킵
- 해시 기반 정확 매칭만 사용 (매우 빠름)
- 캐시 히트율은 감소하지만 전체 응답 시간 개선

**트레이드오프**:
- 유사도 매칭 비활성화로 캐시 히트율 감소
- 동일한 질문만 캐시에서 반환됨

### 2. 캐시 저장 시 임베딩 생성 조건부 스킵 (~600ms 절감)

**파일**: [lib/chat/cache.ts](../lib/chat/cache.ts)

```typescript
export async function cacheResponse(tenantId, query, response) {
  // 유사도 검색 비활성화 시 임베딩 생성 스킵
  const queryEmbedding = ENABLE_SIMILARITY_SEARCH
    ? await embedText(query)
    : null;
  // ...
}
```

**효과**:
- 유사도 검색이 비활성화된 경우 불필요한 임베딩 생성 제거
- 캐시 저장 시간 대폭 감소

### 3. Query Rewriting 분석 결과

**파일**: [lib/rag/query-rewriter.ts](../lib/rag/query-rewriter.ts)

Query Rewriting은 이미 최적화되어 있음:
- 첫 번째 턴에서는 LLM 호출 없이 원본 반환
- Gemini 2.5 Flash-Lite 사용 (가장 빠른 모델 중 하나)
- 후속 질문의 검색 품질 향상을 위해 필수적인 기능

## 최적화 후 예상 성능

| 단계 | 이전 | 이후 | 개선 |
|------|------|------|------|
| 3_cache_lookup | 898ms | ~100ms | -800ms |
| 11_cache_save | ~600ms | ~50ms | -550ms |
| **총 소요시간** | ~4542ms | **~3200ms** | **-1350ms** |

> 첫 번째 턴(Query Rewriting 없음)에서는 추가로 ~1초 절감되어 **~2.2초** 예상

## 성능 모니터링

### 타이밍 로그 확인

서버 로그에서 다음 형식의 타이밍 데이터를 확인할 수 있습니다:

```json
{
  "message": "Chat response generated",
  "tenantId": "xxx",
  "duration": 2500,
  "timings": {
    "1_chatbot_lookup": 50,
    "2_session_lookup": 40,
    "3_cache_lookup": 80,
    "4_history_lookup": 50,
    "5_query_rewriting": 0,
    "6_hybrid_search": 800,
    "8_llm_generation": 700,
    "9_message_save": 50,
    "10_usage_log": 40,
    "11_cache_save": 30
  }
}
```

## 데이터셋 확장 대비: 인덱스 최적화

데이터셋이 커질 경우 병목이 발생하는 지점과 해결책입니다.

### 병목 분석

| 컴포넌트 | 인덱스 없을 때 | 인덱스 적용 후 | 비고 |
|---------|--------------|--------------|------|
| Dense Search (pgvector) | O(n) - 10만 청크에서 5-10초 | O(log n) - ~50ms | **HNSW 인덱스 필수** |
| Sparse Search (BM25) | O(n) | O(log n) | GIN 인덱스 필요 |
| 필터링 (tenant + status) | 전체 스캔 | 인덱스 스캔 | 복합 인덱스 권장 |

### 적용된 인덱스 (마이그레이션 0010)

**파일**: [drizzle/migrations/0010_vector_search_performance_indexes.sql](../drizzle/migrations/0010_vector_search_performance_indexes.sql)

#### 1. pgvector HNSW 인덱스 (가장 중요)

```sql
CREATE INDEX CONCURRENTLY idx_chunks_embedding_hnsw
ON chunks USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);
```

- **효과**: 벡터 검색 O(n) → O(log n)
- **예상 성능**: 10만 청크에서 5초 → 50ms

#### 2. GIN 인덱스 (전문 검색)

```sql
CREATE INDEX CONCURRENTLY idx_chunks_content_tsv_gin
ON chunks USING GIN (content_tsv);
```

- **효과**: BM25 전문 검색 최적화

#### 3. 복합 Partial 인덱스

```sql
CREATE INDEX CONCURRENTLY idx_chunks_tenant_approved_active
ON chunks (tenant_id, dataset_id)
WHERE status = 'approved' AND is_active = true;
```

- **효과**: 가장 빈번한 쿼리 패턴 최적화

### 인덱스 적용 방법

```bash
# 마이그레이션 실행
pnpm db:migrate
```

> ⚠️ HNSW 인덱스는 데이터 크기에 따라 수 분 소요될 수 있습니다. `CONCURRENTLY` 옵션으로 서비스 중단 없이 생성됩니다.

## 향후 최적화 방안

### 단기
1. ~~**벡터 인덱스 추가**~~: ✅ 완료 (HNSW 인덱스)
2. **DB 커넥션 풀 최적화**: 연결 재사용 효율화

### 중기
1. **스트리밍 응답**: LLM 응답을 청크 단위로 전송하여 체감 속도 향상
2. **임베딩 캐싱**: Redis를 활용한 쿼리 임베딩 캐시

### 장기
1. **Edge Caching**: Vercel Edge Functions 활용
2. **모델 경량화**: 특화된 소형 모델 검토

## 설정 변경 가이드

### 유사도 검색 활성화/비활성화

[lib/chat/cache.ts](../lib/chat/cache.ts)에서 플래그 변경:

```typescript
// true: 유사도 기반 캐시 매칭 활성화 (느림, 높은 캐시 히트율)
// false: 해시 기반 정확 매칭만 사용 (빠름, 낮은 캐시 히트율)
const ENABLE_SIMILARITY_SEARCH = false;
```

### 캐시 TTL 조정

```typescript
const CACHE_TTL_HOURS = 24; // 기본 24시간
```

### 유사도 임계값 조정 (유사도 검색 활성화 시)

```typescript
const SIMILARITY_THRESHOLD = 0.92; // 92% 이상 유사도에서만 캐시 히트
```

## 관련 파일

- [lib/chat/service.ts](../lib/chat/service.ts) - 채팅 서비스 메인 로직 + 타이밍 측정
- [lib/chat/cache.ts](../lib/chat/cache.ts) - 응답 캐싱 로직
- [lib/rag/retrieval.ts](../lib/rag/retrieval.ts) - Hybrid Search (Dense + Sparse)
- [lib/rag/embedding.ts](../lib/rag/embedding.ts) - 임베딩 생성
- [lib/rag/query-rewriter.ts](../lib/rag/query-rewriter.ts) - Query Rewriting
- [lib/rag/generator.ts](../lib/rag/generator.ts) - LLM 응답 생성

## 버그 수정 기록

### pgvector 파라미터 형식 오류 (2024-12-30)

**문제**: 캐시 조회 SQL에서 임베딩 배열이 개별 파라미터로 전개됨

```sql
-- 오류 발생
ORDER BY query_embedding <=> ($2, $3, $4, ... $1537)::vector

-- 수정 후
ORDER BY query_embedding <=> '[0.1, 0.2, ...]'::vector
```

**해결**: 임베딩 배열을 문자열로 변환 후 SQL에 전달

```typescript
const embeddingStr = `[${queryEmbedding.join(',')}]`;
// SQL에서 ${embeddingStr}::vector 형태로 사용
```
