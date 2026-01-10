-- Admin 대시보드 성능 개선: token_usage_logs.created_at 단독 인덱스 추가
-- 어드민 대시보드의 AI 사용량 통계 쿼리가 tenantId 없이 created_at으로만 필터링하므로
-- 기존 복합 인덱스(tenant_id, created_at)로는 효율적인 검색이 불가능했음

CREATE INDEX IF NOT EXISTS "idx_token_usage_created" ON "token_usage_logs" ("created_at");
