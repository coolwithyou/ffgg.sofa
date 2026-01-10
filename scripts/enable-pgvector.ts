/* eslint-disable no-console */
/**
 * pgvector 확장 활성화 스크립트
 * 이 스크립트는 CLI 도구이므로 console 사용 허용
 */
import postgres from 'postgres';

async function enablePgVector() {
  const sql = postgres(process.env.DATABASE_URL!);

  try {
    await sql`CREATE EXTENSION IF NOT EXISTS vector`;
    console.log('✓ pgvector extension enabled successfully');
  } catch (error) {
    console.error('Failed to enable pgvector:', error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

enablePgVector();
