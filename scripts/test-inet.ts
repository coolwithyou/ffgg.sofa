import postgres from 'postgres';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function test() {
  const client = postgres(process.env.DATABASE_URL!, { ssl: 'require' });
  
  // inet 타입에 'unknown' 값 삽입 테스트
  try {
    await client`INSERT INTO access_logs (user_id, action, ip_address, result) VALUES ('e2781428-367d-4695-a71c-1445f4393085', 'test', 'unknown', 'success')`;
    console.log('✓ Success with "unknown"');
  } catch (e: any) {
    console.error('✗ Failed with "unknown":', e.message);
  }
  
  // 유효한 IP로 테스트
  try {
    await client`INSERT INTO access_logs (user_id, action, ip_address, result) VALUES ('e2781428-367d-4695-a71c-1445f4393085', 'test_valid', '127.0.0.1', 'success')`;
    console.log('✓ Success with "127.0.0.1"');
  } catch (e: any) {
    console.error('✗ Failed with "127.0.0.1":', e.message);
  }
  
  // null로 테스트
  try {
    await client`INSERT INTO access_logs (user_id, action, ip_address, result) VALUES ('e2781428-367d-4695-a71c-1445f4393085', 'test_null', NULL, 'success')`;
    console.log('✓ Success with NULL');
  } catch (e: any) {
    console.error('✗ Failed with NULL:', e.message);
  }
  
  // 테스트 데이터 삭제
  await client`DELETE FROM access_logs WHERE action LIKE 'test%'`;
  console.log('Test data cleaned up');
  
  await client.end();
}

test().catch(console.error);
