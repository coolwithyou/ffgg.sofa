-- 벡터 검색 성능 최적화 인덱스
-- 데이터셋 크기 증가에 대비한 인덱스 추가
-- 실행 시간: 데이터 크기에 따라 수 분 소요될 수 있음

-- ============================================
-- 1. pgvector HNSW 인덱스 (Dense Search 최적화)
-- ============================================
-- HNSW (Hierarchical Navigable Small World) 인덱스
-- - 장점: 매우 빠른 검색 속도 (O(log n))
-- - 단점: 빌드 시간 길고, 메모리 사용량 높음
-- - 권장: 10,000+ 청크에서 필수

-- 코사인 유사도용 HNSW 인덱스 (vector_cosine_ops)
-- m=16: 연결 수 (높을수록 정확하지만 메모리 증가)
-- ef_construction=64: 빌드 시 탐색 폭 (높을수록 정확하지만 빌드 느림)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chunks_embedding_hnsw
ON chunks USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- ============================================
-- 2. GIN 인덱스 (Sparse/BM25 Search 최적화)
-- ============================================
-- content_tsv 컬럼에 대한 전문 검색 인덱스
-- PostgreSQL의 한국어 형태소 분석(Nori) 활용

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chunks_content_tsv_gin
ON chunks USING GIN (content_tsv);

-- ============================================
-- 3. 복합 인덱스 (필터링 최적화)
-- ============================================
-- 자주 사용되는 WHERE 조건을 위한 복합 인덱스
-- tenant_id + status + is_active 조합

-- Partial Index: approved + active 청크만 (가장 빈번한 쿼리 패턴)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chunks_tenant_approved_active
ON chunks (tenant_id, dataset_id)
WHERE status = 'approved' AND is_active = true;

-- ============================================
-- 4. response_cache 테이블 인덱스
-- ============================================
-- 캐시 조회 최적화 (해시 기반 정확 매칭)
-- 참고: NOW()는 IMMUTABLE하지 않아 Partial Index에 사용 불가
-- 만료 시간 필터링은 쿼리 레벨에서 처리

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_response_cache_lookup
ON response_cache (tenant_id, query_hash);
