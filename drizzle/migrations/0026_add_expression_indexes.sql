-- Admin 대시보드 성능 개선: Expression Index 추가
-- DATE() 및 EXTRACT() 함수 사용 시 인덱스를 활용할 수 있도록 Expression Index 생성
--
-- 문제: GROUP BY DATE(created_at) 쿼리는 B-tree 인덱스를 사용할 수 없어 Full Table Scan 발생
-- 해결: 함수 결과를 인덱싱하는 Expression Index 추가

-- ============================================
-- token_usage_logs 테이블 Expression Indexes
-- ============================================

-- DATE(created_at) 인덱스: 일별 집계 쿼리 최적화
-- 사용처: getUsageTrend(), 일별 사용량 통계
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_token_usage_created_date"
ON "token_usage_logs" (DATE("created_at"));

-- EXTRACT(DOW) + EXTRACT(HOUR) 복합 인덱스: 요일/시간별 히트맵 쿼리 최적화
-- 사용처: getUsageByDayHour()
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_token_usage_dow_hour"
ON "token_usage_logs" (
  EXTRACT(DOW FROM "created_at"),
  EXTRACT(HOUR FROM "created_at")
);

-- ============================================
-- response_time_logs 테이블 Expression Indexes
-- ============================================

-- DATE(created_at) 인덱스: 일별 집계 쿼리 최적화
-- 사용처: getCacheHitRateTrend(), getUsageByChannel()
CREATE INDEX CONCURRENTLY IF NOT EXISTS "idx_response_time_created_date"
ON "response_time_logs" (DATE("created_at"));

-- ============================================
-- 참고사항
-- ============================================
-- CONCURRENTLY 옵션: 테이블 락 없이 인덱스 생성 (프로덕션 환경 안전)
-- IF NOT EXISTS: 중복 실행 시 에러 방지
--
-- 인덱스 사용 확인:
-- EXPLAIN ANALYZE SELECT DATE(created_at), COUNT(*)
-- FROM token_usage_logs
-- WHERE created_at >= NOW() - INTERVAL '30 days'
-- GROUP BY DATE(created_at);
