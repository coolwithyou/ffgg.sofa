# 하이브리드 검색 개선 계획 (Supabase + PGroonga)

> **작성 일자**: 2026-01-10
> **상태**: 계획 단계 (Plan)
> **작성자**: AI Development Team
> **업데이트**: Neon → Supabase 전환 결정 반영

---

## 개요

RAG 파이프라인의 검색 품질을 개선하기 위해 **PGroonga 기반 하이브리드 검색**을 도입하는 계획입니다. 현재 ILIKE 기반의 단순 키워드 매칭을 **PGroonga 전문 검색**으로 교체하고, **Supabase 서울 리전**으로 전환하여 한국어 검색 품질과 레이턴시를 동시에 개선합니다.

### 주요 변경 사항

| 항목 | Before | After |
|------|--------|-------|
| **데이터베이스** | Neon (Singapore) | Supabase (Seoul) |
| **키워드 검색** | ILIKE | PGroonga |
| **한국어 지원** | 미지원 | 완전 지원 |
| **예상 레이턴시** | ~80-120ms | ~10-30ms |

---

## 배경

### 하이브리드 검색이란?

| 검색 방식 | 강점 | 약점 |
|-----------|------|------|
| **키워드 (FTS)** | 정확한 용어, 코드, ID 매칭 | 의미적 유사성 이해 불가 |
| **벡터 (임베딩)** | 의미적 유사성 파악 | 정확한 키워드 매칭 약함 |
| **하이브리드** | 둘 다 커버 | 약간의 복잡성 증가 |

> "2025년 기업용 RAG 시스템의 표준은 하이브리드 검색입니다. 키워드와 벡터 검색을 함께 사용하여 서로의 약점을 보완합니다."

### BM25 vs PGroonga

| 알고리즘 | 특징 | SOFA 환경 적합성 |
|---------|------|-----------------|
| **BM25** | TF-IDF 기반 랭킹, 문서 길이 정규화 | pg_search 필요 (Supabase 미지원) |
| **PGroonga** | Groonga 기반, 다국어 FTS | ✅ Supabase 공식 지원, 한국어 검증됨 |

**SOFA 환경에서 PGroonga가 적합한 이유:**
- 청크 크기가 100-600자로 작아 문서 길이 정규화 효과 감소
- 벡터 검색이 60% 가중치로 의미 파악 담당
- 키워드 검색은 "관련 문서 후보군 확보"가 주목적
- **한국어 토큰화 품질이 랭킹 알고리즘보다 더 중요**

---

## 현재 상태 분석

### 현재 구현 (lib/rag/retrieval.ts)

**하이브리드 검색 아키텍처는 이미 존재:**
```typescript
export async function hybridSearch(...) {
  const [denseResults, sparseResults] = await Promise.all([
    denseSearch(tenantId, query, limit * 2, trackingContext),
    sparseSearch(tenantId, query, limit * 2),
  ]);
  return reciprocalRankFusion(denseResults, sparseResults, limit);
}
```

**문제점 - sparseSearch가 ILIKE 기반:**
```typescript
// 현재 구현 (retrieval.ts:212-262)
const results = await db.execute(sql`
  SELECT id, content,
    CASE WHEN content ILIKE ${'%' + query + '%'} THEN 1.0 ELSE 0.5 END as score
  FROM chunks
  WHERE content ILIKE ${'%' + query + '%'}
`);
```

**현재 방식의 한계:**
1. 한국어 토큰화 미지원 (가장 치명적)
2. 랭킹/가중치 없음 (이진 점수: 1.0 또는 0.5)
3. 부분 문자열 매칭만 가능
4. 레이턴시 (Singapore → 한국 사용자)

---

## 환경 전환 결정

### Neon vs Supabase 비교

| 항목 | Neon (현재) | Supabase (전환 대상) |
|------|-------------|---------------------|
| **한국 리전** | ❌ 없음 (Singapore) | ✅ 서울 |
| **pg_search (BM25)** | ✅ 지원 | ❌ 미지원 |
| **PGroonga** | ❌ 미지원 | ✅ 공식 지원 |
| **한국어 FTS** | ICU/Lindera (미검증) | PGroonga (검증됨) |
| **예상 레이턴시** | ~80-120ms | ~10-30ms |
| **pgvector** | ✅ 지원 | ✅ 지원 |

### 전환 결정 근거

1. **레이턴시 4배 개선**: 서울 리전으로 실제 사용자 경험 향상
2. **검증된 한국어 FTS**: PGroonga는 일본/한국 기업에서 프로덕션 검증됨
3. **BM25 vs PGroonga 차이 희석**: RRF 하이브리드에서 정확한 랭킹보다 토큰화 품질이 중요
4. **공식 하이브리드 검색 가이드**: Supabase에서 RRF 패턴 공식 문서화

---

## PostgreSQL 내장 FTS의 한국어 한계

Supabase도 PostgreSQL 기반이지만, **내장 FTS는 한국어를 지원하지 않습니다**:

| 문제 | 설명 |
|------|------|
| **CJK 파서 미지원** | 영어, 독일어, 프랑스어 등은 지원하지만 CJK 언어 설정 없음 |
| **띄어쓰기 기반** | 한국어는 띄어쓰기가 단어 경계가 아니므로 토큰화 실패 |
| **단일 단어 처리** | "안녕하세요"를 하나의 토큰으로 처리 → 검색 불가 |

```sql
-- 이렇게 하면 한국어 검색이 제대로 안 됨
SELECT * FROM documents
WHERE to_tsvector('simple', content) @@ to_tsquery('simple', '배송');
```

**→ PGroonga 확장이 필수**

---

## PGroonga 소개

**PGroonga**는 PostgreSQL 확장으로, Groonga 전문 검색 엔진을 기반으로 합니다.

### 주요 특징

| 특징 | 설명 |
|------|------|
| **다국어 지원** | 한국어, 일본어, 중국어 완전 지원 |
| **대소문자 무시** | 자동으로 case-insensitive 검색 |
| **고급 쿼리** | AND, OR, NOT, 구문 검색 지원 |
| **빠른 인덱싱** | GIN보다 빠른 Groonga 인덱스 |

### 쿼리 문법

```sql
-- 기본 검색
SELECT * FROM chunks WHERE content &@~ '배송';

-- AND 검색 (둘 다 포함)
SELECT * FROM chunks WHERE content &@~ '배송 완료';

-- OR 검색 (하나라도 포함)
SELECT * FROM chunks WHERE content &@~ '배송 OR 반품';

-- NOT 검색 (제외)
SELECT * FROM chunks WHERE content &@~ '배송 -취소';

-- 구문 검색 (정확한 구문)
SELECT * FROM chunks WHERE content &@~ '"무료 배송"';
```

---

## 구현 계획

### Phase 1: Supabase 프로젝트 생성 및 스키마 마이그레이션

**난이도**: ★★☆☆☆ | **소요**: 1-2시간

1. Supabase 프로젝트 생성 (Seoul 리전)
2. 기존 Drizzle 스키마를 Supabase로 마이그레이션
3. pgvector 확장 활성화 (벡터 검색용)
4. PGroonga 확장 활성화

```sql
-- 1. 확장 활성화
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pgroonga;

-- 2. chunks 테이블 생성 (기존 스키마 유지)
CREATE TABLE chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL,
  document_id UUID NOT NULL REFERENCES documents(id),
  content TEXT NOT NULL,
  embedding VECTOR(1536),
  metadata JSONB DEFAULT '{}',
  status TEXT DEFAULT 'pending',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. PGroonga 인덱스 생성 (한국어 FTS)
CREATE INDEX chunks_pgroonga_idx ON chunks USING pgroonga (content);

-- 4. 벡터 인덱스 생성 (HNSW)
CREATE INDEX chunks_embedding_idx ON chunks
USING hnsw (embedding vector_cosine_ops);

-- 5. 기존 인덱스들
CREATE INDEX chunks_tenant_idx ON chunks (tenant_id);
CREATE INDEX chunks_document_idx ON chunks (document_id);
CREATE INDEX chunks_status_idx ON chunks (status) WHERE is_active = true;
```

### Phase 2: sparseSearch를 PGroonga 기반으로 교체

**난이도**: ★★☆☆☆ | **소요**: 30분-1시간

```typescript
// lib/rag/retrieval.ts - PGroonga 버전

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function sparseSearch(
  tenantId: string,
  query: string,
  limit: number
): Promise<SearchResult[]> {
  try {
    // PGroonga 검색 (RPC 함수 사용)
    const { data, error } = await supabase.rpc('pgroonga_search', {
      search_query: query,
      tenant: tenantId,
      result_limit: limit
    });

    if (error) throw error;

    return (data as Array<{
      id: string;
      document_id: string;
      content: string;
      metadata: Record<string, unknown>;
      score: number;
    }>).map((row) => ({
      id: row.id,
      chunkId: row.id,
      documentId: row.document_id,
      content: row.content,
      score: Number(row.score),
      metadata: row.metadata || {},
      source: 'sparse' as const,
    }));
  } catch (error) {
    logger.error('PGroonga search failed', error instanceof Error ? error : undefined, { tenantId });
    // 폴백: 기존 ILIKE 검색
    return sparseSearchFallback(tenantId, query, limit);
  }
}
```

### Phase 2.1: Supabase RPC 함수 생성

```sql
-- supabase/migrations/XXXXXX_pgroonga_search.sql

CREATE OR REPLACE FUNCTION pgroonga_search(
  search_query TEXT,
  tenant TEXT,
  result_limit INT DEFAULT 20
)
RETURNS TABLE (
  id UUID,
  document_id UUID,
  content TEXT,
  metadata JSONB,
  score FLOAT8
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.document_id,
    c.content,
    c.metadata,
    pgroonga_score(tableoid, ctid)::FLOAT8 as score
  FROM chunks c
  WHERE c.tenant_id = tenant
    AND c.status = 'approved'
    AND c.is_active = true
    AND c.content &@~ search_query
  ORDER BY score DESC
  LIMIT result_limit;
END;
$$;
```

### Phase 3: 하이브리드 검색 가중치 최적화

**난이도**: ★☆☆☆☆ | **소요**: 15분

```typescript
// lib/rag/retrieval.ts - RRF 가중치 조정

const RRF_K = 60;

// 한국어 환경에서 권장 가중치
const WEIGHTS = {
  dense: 0.6,   // 벡터 검색 (의미적 유사성)
  sparse: 0.4,  // PGroonga 검색 (정확한 용어 매칭)
};

function reciprocalRankFusion(
  denseResults: SearchResult[],
  sparseResults: SearchResult[],
  limit: number
): SearchResult[] {
  const scores = new Map<string, RankedResult>();

  denseResults.forEach((result, rank) => {
    const rrfScore = WEIGHTS.dense * (1 / (RRF_K + rank + 1));
    scores.set(result.id, {
      chunk: { ...result, source: 'hybrid' },
      score: rrfScore,
      denseScore: result.score,
    });
  });

  sparseResults.forEach((result, rank) => {
    const rrfScore = WEIGHTS.sparse * (1 / (RRF_K + rank + 1));
    const existing = scores.get(result.id);
    if (existing) {
      existing.score += rrfScore;
    } else {
      scores.set(result.id, {
        chunk: { ...result, source: 'hybrid' },
        score: rrfScore,
      });
    }
  });

  return Array.from(scores.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((item) => ({
      ...item.chunk,
      score: item.score,
      denseScore: item.denseScore,
    }));
}
```

### Phase 4: 벡터 검색 함수 (Supabase 버전)

**난이도**: ★★☆☆☆ | **소요**: 30분

```sql
-- supabase/migrations/XXXXXX_vector_search.sql

CREATE OR REPLACE FUNCTION vector_search(
  query_embedding VECTOR(1536),
  tenant TEXT,
  result_limit INT DEFAULT 20
)
RETURNS TABLE (
  id UUID,
  document_id UUID,
  content TEXT,
  metadata JSONB,
  similarity FLOAT8
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.document_id,
    c.content,
    c.metadata,
    1 - (c.embedding <=> query_embedding) as similarity
  FROM chunks c
  WHERE c.tenant_id = tenant
    AND c.status = 'approved'
    AND c.is_active = true
  ORDER BY c.embedding <=> query_embedding
  LIMIT result_limit;
END;
$$;
```

```typescript
// lib/rag/retrieval.ts - denseSearch Supabase 버전

async function denseSearch(
  tenantId: string,
  query: string,
  limit: number,
  trackingContext?: TrackingContext
): Promise<SearchResult[]> {
  // 1. 쿼리 임베딩 생성
  const embedding = await generateEmbedding(query, trackingContext);

  // 2. Supabase 벡터 검색
  const { data, error } = await supabase.rpc('vector_search', {
    query_embedding: embedding,
    tenant: tenantId,
    result_limit: limit
  });

  if (error) throw error;

  return (data as Array<{
    id: string;
    document_id: string;
    content: string;
    metadata: Record<string, unknown>;
    similarity: number;
  }>).map((row) => ({
    id: row.id,
    chunkId: row.id,
    documentId: row.document_id,
    content: row.content,
    score: row.similarity,
    metadata: row.metadata || {},
    source: 'dense' as const,
  }));
}
```

### Phase 5: 전체 하이브리드 검색 통합

```typescript
// lib/rag/retrieval.ts - 최종 통합

export async function hybridSearch(
  tenantId: string,
  query: string,
  limit: number = 10,
  trackingContext?: TrackingContext
): Promise<SearchResult[]> {
  const [denseResults, sparseResults] = await Promise.all([
    denseSearch(tenantId, query, limit * 2, trackingContext),
    sparseSearch(tenantId, query, limit * 2),
  ]);

  return reciprocalRankFusion(denseResults, sparseResults, limit);
}
```

---

## 폴백 전략

PGroonga 검색 실패 시 ILIKE 기반 폴백:

```typescript
// lib/rag/retrieval.ts - 폴백 구현

async function sparseSearchFallback(
  tenantId: string,
  query: string,
  limit: number
): Promise<SearchResult[]> {
  const { data, error } = await supabase
    .from('chunks')
    .select('id, document_id, content, metadata')
    .eq('tenant_id', tenantId)
    .eq('status', 'approved')
    .eq('is_active', true)
    .ilike('content', `%${query}%`)
    .limit(limit);

  if (error) throw error;

  return (data || []).map((row, index) => ({
    id: row.id,
    chunkId: row.id,
    documentId: row.document_id,
    content: row.content,
    score: 1 - (index * 0.05), // 순서 기반 점수
    metadata: row.metadata || {},
    source: 'sparse' as const,
  }));
}
```

---

## 비용 분석

| 항목 | Neon (현재) | Supabase (전환 후) | 차이 |
|------|-------------|-------------------|------|
| **Free Tier** | 0.5GB storage | 500MB storage | 유사 |
| **Pro Tier** | $19/mo | $25/mo | +$6/mo |
| **레이턴시 개선** | - | ~4배 향상 | 가치 있음 |
| **추가 확장** | pg_search 무료 | PGroonga 무료 | 동일 |

---

## 마이그레이션 체크리스트

### 준비 단계
- [ ] Supabase 프로젝트 생성 (Seoul 리전)
- [ ] 환경변수 준비 (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`)
- [ ] 기존 데이터 백업

### 스키마 마이그레이션
- [ ] pgvector 확장 활성화
- [ ] PGroonga 확장 활성화
- [ ] 테이블 스키마 생성
- [ ] PGroonga 인덱스 생성
- [ ] HNSW 벡터 인덱스 생성
- [ ] RPC 함수 생성 (pgroonga_search, vector_search)

### 코드 변경
- [ ] Supabase 클라이언트 설정 추가
- [ ] sparseSearch 함수 PGroonga 버전으로 교체
- [ ] denseSearch 함수 Supabase RPC 버전으로 교체
- [ ] 환경변수 교체 (Vercel)

### 데이터 마이그레이션
- [ ] 기존 데이터 export (pg_dump 또는 수동)
- [ ] Supabase로 import
- [ ] 데이터 무결성 검증

### 테스트 및 검증
- [ ] 한국어 검색 품질 테스트
- [ ] 하이브리드 검색 동작 확인
- [ ] 레이턴시 측정
- [ ] 에러 핸들링 확인

### 배포
- [ ] Staging 환경 테스트
- [ ] Production 환경변수 교체
- [ ] 모니터링 설정

---

## 연구 기록: Neon pg_search 한국어 지원 조사

> 이 섹션은 Supabase 전환 결정 이전에 조사한 내용입니다. 참고용으로 보존합니다.

### pg_search 한국어 토크나이저 (2026-01-10 조사)

| 토크나이저 | 지원 상태 | 특징 | 적합성 |
|-----------|----------|------|--------|
| **ICU** | ✅ pg_search 내장 | 유니코드 규칙 기반, 형태소 분석 아님 | 테스트 필요 |
| **Lindera** | ✅ pg_search 지원 | 한국어 형태소 분석 (ko-dic) | Neon 호환성 불확실 |
| **pg_cjk_parser** | ⚠️ 별도 확장 | 2-gram 토큰화 | 폴백용 |

**알려진 이슈:**
- ICU 토크나이저: `snippet()` 함수에서 비ASCII 문자 버그 존재 (ParadeDB Issue #1747)
- Lindera: ko-dic 사전 크기가 크며, Neon 환경 호환성 미확인

**결론:** pg_search 한국어 지원이 불확실하여 Supabase + PGroonga로 전환 결정

---

## 참고 자료

### Supabase
- [Supabase Full Text Search](https://supabase.com/docs/guides/database/full-text-search)
- [PGroonga: Multilingual Full Text Search](https://supabase.com/docs/guides/database/extensions/pgroonga)
- [Supabase Hybrid Search](https://supabase.com/docs/guides/ai/hybrid-search)
- [Supabase pgvector](https://supabase.com/docs/guides/ai/vector-columns)

### 일반
- [Optimizing RAG with Hybrid Search & Reranking](https://superlinked.com/vectorhub/articles/optimizing-rag-with-hybrid-search-reranking)
- [pg_cjk_parser GitHub](https://github.com/huangjimmy/pg_cjk_parser)

### Neon (참고용)
- [pg_search on Neon](https://neon.com/docs/extensions/pg_search)
- [PostgreSQL Full-Text Search - VectorChord Blog](https://blog.vectorchord.ai/postgresql-full-text-search-fast-when-done-right-debunking-the-slow-myth)

---

## 다음 단계

1. ~~**pg_search 한국어 토크나이저 지원 여부 조사**~~ ✅ 완료
2. ~~**Neon vs Supabase 비교 분석**~~ ✅ 완료 → Supabase 선택
3. **Supabase 프로젝트 생성** (Seoul 리전)
4. **스키마 마이그레이션 및 PGroonga 설정**
5. **sparseSearch/denseSearch 함수 교체**
6. **하이브리드 검색 테스트 및 가중치 튜닝**
7. **데이터 마이그레이션 및 배포**
