import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from '@/drizzle/schema';

/**
 * Supabase Transaction Pooler (port 6543) 연결 설정
 *
 * 중요: Transaction mode에서는 prepared statements가 지원되지 않음
 * https://github.com/porsager/postgres/issues/93
 * https://supabase.com/docs/guides/database/connecting-to-postgres
 */
const client = postgres(process.env.DATABASE_URL!, {
  ssl: 'require',
  // Supabase Transaction Pooler는 prepared statements를 지원하지 않음
  prepare: false,
  // 연결 타임아웃 설정 (초)
  connect_timeout: 15,
  // 유휴 연결 타임아웃 (초)
  idle_timeout: 20,
  // 최대 연결 수 (서버리스 환경에 적합)
  // 대시보드 병렬 쿼리(15-16개)를 수용하기 위해 20으로 확대
  max: 20,
});

export const db = drizzle(client, { schema });

// Re-export schema for convenience
export * from '@/drizzle/schema';
