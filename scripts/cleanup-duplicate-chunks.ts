/**
 * 중복 청크 정리 및 UNIQUE 인덱스 생성 스크립트
 * 동일 document_id + chunk_index 조합의 중복 제거
 */

import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';

async function main() {
  console.log('=== 중복 청크 정리 스크립트 ===\n');

  // 1. 현재 중복 현황 확인
  console.log('1. 중복 청크 현황 확인 중...');
  const duplicates = await db.execute(sql`
    SELECT document_id, chunk_index, COUNT(*) as cnt
    FROM chunks
    GROUP BY document_id, chunk_index
    HAVING COUNT(*) > 1
    ORDER BY cnt DESC
    LIMIT 10
  `);

  console.log(`   중복 발견: ${duplicates.rows.length}개 조합\n`);

  if (duplicates.rows.length > 0) {
    console.log('   상위 중복 현황:');
    for (const row of duplicates.rows.slice(0, 5)) {
      console.log(`   - document: ${(row as { document_id: string }).document_id.slice(0, 8)}..., chunk_index: ${(row as { chunk_index: number }).chunk_index}, count: ${(row as { cnt: number }).cnt}`);
    }
    console.log('');
  }

  // 2. 중복 청크 삭제 (오래된 것 삭제, 최신 것 유지)
  console.log('2. 중복 청크 삭제 중...');
  const deleteResult = await db.execute(sql`
    DELETE FROM chunks a USING chunks b
    WHERE a.id < b.id
      AND a.document_id = b.document_id
      AND a.chunk_index = b.chunk_index
  `);

  console.log(`   삭제된 중복 청크: ${deleteResult.rowCount}개\n`);

  // 3. 삭제 후 검증
  console.log('3. 삭제 후 검증...');
  const remaining = await db.execute(sql`
    SELECT COUNT(*) as cnt
    FROM (
      SELECT document_id, chunk_index
      FROM chunks
      GROUP BY document_id, chunk_index
      HAVING COUNT(*) > 1
    ) sub
  `);

  const remainingCount = (remaining.rows[0] as { cnt: number })?.cnt || 0;
  console.log(`   남은 중복: ${remainingCount}개\n`);

  if (remainingCount > 0) {
    console.error('   경고: 여전히 중복이 존재합니다!');
    process.exit(1);
  }

  // 4. UNIQUE 인덱스 생성
  console.log('4. UNIQUE 인덱스 생성 중...');
  try {
    await db.execute(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS unique_document_chunk_index
      ON chunks (document_id, chunk_index)
    `);
    console.log('   인덱스 생성 완료!\n');
  } catch (error) {
    if (error instanceof Error && error.message.includes('already exists')) {
      console.log('   인덱스가 이미 존재합니다.\n');
    } else {
      throw error;
    }
  }

  // 5. 인덱스 확인
  console.log('5. 인덱스 확인...');
  const indexes = await db.execute(sql`
    SELECT indexname, indexdef
    FROM pg_indexes
    WHERE tablename = 'chunks'
    AND indexname LIKE '%unique%'
  `);

  for (const idx of indexes.rows) {
    console.log(`   - ${(idx as { indexname: string }).indexname}`);
  }

  console.log('\n=== 완료 ===');
}

main().catch((error) => {
  console.error('에러 발생:', error);
  process.exit(1);
});
