-- PGroonga 한국어 전문 검색 확장 설정
-- Supabase에서 공식 지원하는 다국어 FTS 확장
-- 한국어, 일본어, 중국어 등 비라틴 문자 검색 지원

-- ============================================
-- 1. PGroonga 확장 활성화
-- ============================================
-- Supabase에서는 extensions 스키마에 설치하는 것이 권장됨
CREATE EXTENSION IF NOT EXISTS pgroonga WITH SCHEMA extensions;

-- ============================================
-- 2. PGroonga 인덱스 생성 (content 컬럼)
-- ============================================
-- 기존 ILIKE 검색을 PGroonga 전문 검색으로 대체
-- PGroonga는 자동으로 한국어 토큰화 수행
-- CONCURRENTLY: 테이블 락 없이 인덱스 생성 (운영 중 적용 가능)

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chunks_content_pgroonga
ON chunks USING pgroonga (content);

-- ============================================
-- 3. 복합 조건용 인덱스 (tenant + dataset + content)
-- ============================================
-- Hybrid Search 쿼리 패턴 최적화
-- WHERE tenant_id = ? AND dataset_id = ANY(?) AND content &@~ ?

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chunks_pgroonga_composite
ON chunks USING pgroonga (content)
WHERE status = 'approved' AND is_active = true;

-- ============================================
-- 4. 기존 GIN 인덱스 정리 (선택적)
-- ============================================
-- content_tsv 컬럼의 GIN 인덱스는 현재 사용되지 않음
-- PGroonga가 더 효율적이므로 제거 가능
-- 주의: 롤백이 필요할 수 있으므로 주석 처리 유지

-- DROP INDEX IF EXISTS idx_chunks_content_tsv_gin;

-- ============================================
-- 참고: PGroonga 연산자
-- ============================================
-- &@~  : 웹 검색 스타일 쿼리 (AND/OR/NOT 지원)
-- &@   : 단순 키워드 매칭
-- pgroonga_score(tableoid, ctid) : 관련성 점수 반환
