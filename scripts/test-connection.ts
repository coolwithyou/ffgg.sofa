/**
 * Supabase 연결 테스트 스크립트
 */
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import postgres from 'postgres';

async function testConnection() {
  const url = process.env.DATABASE_URL!;
  console.log('Testing connection to:', url.replace(/:[^:@]+@/, ':***@'));

  // SSL 옵션 추가
  const client = postgres(url, { ssl: 'require' });

  try {
    const result = await client`SELECT 1 as test`;
    console.log('✅ Connection successful:', result);
  } catch (e) {
    console.error('❌ Connection failed:', (e as Error).message);
  } finally {
    await client.end();
    process.exit(0);
  }
}

testConnection();
