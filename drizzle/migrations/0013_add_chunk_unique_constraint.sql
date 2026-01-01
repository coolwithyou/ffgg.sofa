-- 중복 청크 방지를 위한 UNIQUE 제약조건 추가
-- 동일 문서 내에서 chunk_index가 중복되는 것을 방지합니다.

-- 먼저 기존 중복 데이터가 있는지 확인하고 정리
-- (중복이 있으면 마이그레이션이 실패하므로 먼저 정리 필요)
DELETE FROM chunks a USING chunks b
WHERE a.id < b.id
  AND a.document_id = b.document_id
  AND a.chunk_index = b.chunk_index;

-- UNIQUE 인덱스 추가
CREATE UNIQUE INDEX IF NOT EXISTS unique_document_chunk_index
ON chunks (document_id, chunk_index);
