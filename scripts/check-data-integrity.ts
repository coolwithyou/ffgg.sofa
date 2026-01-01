/**
 * 데이터 무결성 검사 스크립트
 *
 * 청크와 문서의 데이터 일관성을 검사하고 문제점을 보고합니다.
 *
 * 사용법:
 *   pnpm exec dotenv -e .env.local -- npx tsx scripts/check-data-integrity.ts
 *   pnpm exec dotenv -e .env.local -- npx tsx scripts/check-data-integrity.ts --fix
 *
 * 검사 항목:
 *   1. chunks.datasetId와 documents.datasetId 불일치
 *   2. chunks.datasetId가 null인 항목 (검색 불가)
 *   3. embedding이 null인 청크 (Dense 검색 불가)
 *   4. status가 'approved'가 아닌 활성 청크
 *   5. orphan 청크 (document가 삭제된 청크)
 */

import { db } from '../lib/db';
import { documents, chunks, datasets } from '../drizzle/schema';
import { eq, sql, isNull, and, ne } from 'drizzle-orm';

interface IntegrityIssue {
  type: string;
  count: number;
  samples: Array<{
    chunkId: string;
    documentId: string;
    details: string;
  }>;
}

async function checkDataIntegrity(fixIssues: boolean = false) {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('              데이터 무결성 검사 시작');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const issues: IntegrityIssue[] = [];

  // 1. chunks.datasetId와 documents.datasetId 불일치 검사
  console.log('🔍 [1/5] datasetId 불일치 검사...');
  const mismatchedChunks = await db.execute(sql`
    SELECT
      c.id as chunk_id,
      c.document_id,
      c.dataset_id as chunk_dataset_id,
      d.dataset_id as doc_dataset_id,
      LEFT(c.content, 50) as content_preview
    FROM chunks c
    INNER JOIN documents d ON c.document_id = d.id
    WHERE c.dataset_id IS DISTINCT FROM d.dataset_id
    LIMIT 10
  `);

  const [mismatchCount] = await db.execute(sql`
    SELECT COUNT(*)::int as count
    FROM chunks c
    INNER JOIN documents d ON c.document_id = d.id
    WHERE c.dataset_id IS DISTINCT FROM d.dataset_id
  `);

  if ((mismatchCount as any).count > 0) {
    issues.push({
      type: 'datasetId 불일치',
      count: (mismatchCount as any).count,
      samples: (mismatchedChunks.rows as any[]).map((r) => ({
        chunkId: r.chunk_id,
        documentId: r.document_id,
        details: `청크: ${r.chunk_dataset_id || 'null'} ≠ 문서: ${r.doc_dataset_id || 'null'}`,
      })),
    });
    console.log(`   ❌ ${(mismatchCount as any).count}개 불일치 발견`);

    if (fixIssues) {
      console.log('   🔧 자동 수정 중...');
      await db.execute(sql`
        UPDATE chunks c
        SET dataset_id = d.dataset_id, updated_at = NOW()
        FROM documents d
        WHERE c.document_id = d.id
        AND c.dataset_id IS DISTINCT FROM d.dataset_id
      `);
      console.log('   ✅ 수정 완료');
    }
  } else {
    console.log('   ✅ 불일치 없음');
  }

  // 2. datasetId가 null인 청크 검사
  console.log('\n🔍 [2/5] datasetId null 검사...');
  const nullDatasetChunks = await db.execute(sql`
    SELECT
      c.id as chunk_id,
      c.document_id,
      c.status,
      c.is_active,
      d.dataset_id as doc_dataset_id,
      LEFT(c.content, 50) as content_preview
    FROM chunks c
    LEFT JOIN documents d ON c.document_id = d.id
    WHERE c.dataset_id IS NULL
    AND c.is_active = true
    LIMIT 10
  `);

  const [nullDatasetCount] = await db.execute(sql`
    SELECT COUNT(*)::int as count
    FROM chunks c
    WHERE c.dataset_id IS NULL
    AND c.is_active = true
  `);

  if ((nullDatasetCount as any).count > 0) {
    issues.push({
      type: 'datasetId null (검색 불가)',
      count: (nullDatasetCount as any).count,
      samples: (nullDatasetChunks.rows as any[]).map((r) => ({
        chunkId: r.chunk_id,
        documentId: r.document_id,
        details: `문서 datasetId: ${r.doc_dataset_id || 'null'}, 상태: ${r.status}`,
      })),
    });
    console.log(`   ❌ ${(nullDatasetCount as any).count}개 발견 (검색에서 제외됨)`);

    if (fixIssues) {
      console.log('   🔧 자동 수정 중 (documents 테이블에서 datasetId 동기화)...');
      await db.execute(sql`
        UPDATE chunks c
        SET dataset_id = d.dataset_id, updated_at = NOW()
        FROM documents d
        WHERE c.document_id = d.id
        AND c.dataset_id IS NULL
        AND d.dataset_id IS NOT NULL
      `);
      console.log('   ✅ 수정 완료');
    }
  } else {
    console.log('   ✅ 문제 없음');
  }

  // 3. embedding이 null인 청크 검사
  console.log('\n🔍 [3/5] embedding null 검사...');
  const [nullEmbeddingCount] = await db.execute(sql`
    SELECT COUNT(*)::int as count
    FROM chunks
    WHERE embedding IS NULL
    AND is_active = true
  `);

  if ((nullEmbeddingCount as any).count > 0) {
    const nullEmbeddingChunks = await db.execute(sql`
      SELECT id as chunk_id, document_id, status, LEFT(content, 50) as content_preview
      FROM chunks
      WHERE embedding IS NULL
      AND is_active = true
      LIMIT 10
    `);

    issues.push({
      type: 'embedding null (Dense 검색 불가)',
      count: (nullEmbeddingCount as any).count,
      samples: (nullEmbeddingChunks.rows as any[]).map((r) => ({
        chunkId: r.chunk_id,
        documentId: r.document_id,
        details: `상태: ${r.status}, 내용: ${r.content_preview}...`,
      })),
    });
    console.log(`   ⚠️ ${(nullEmbeddingCount as any).count}개 발견 (Dense 검색 불가)`);
    console.log('   💡 수정: 해당 문서 재처리 필요 (scripts/reprocess-documents.ts)');
  } else {
    console.log('   ✅ 문제 없음');
  }

  // 4. 비활성 상태인데 is_active=true인 청크 검사
  console.log('\n🔍 [4/5] 상태 불일치 검사...');
  const [statusMismatchCount] = await db.execute(sql`
    SELECT COUNT(*)::int as count
    FROM chunks
    WHERE status != 'approved'
    AND is_active = true
    AND dataset_id IS NOT NULL
  `);

  if ((statusMismatchCount as any).count > 0) {
    const statusMismatchChunks = await db.execute(sql`
      SELECT id as chunk_id, document_id, status, LEFT(content, 50) as content_preview
      FROM chunks
      WHERE status != 'approved'
      AND is_active = true
      AND dataset_id IS NOT NULL
      LIMIT 10
    `);

    issues.push({
      type: '상태 불일치 (미승인 활성 청크)',
      count: (statusMismatchCount as any).count,
      samples: (statusMismatchChunks.rows as any[]).map((r) => ({
        chunkId: r.chunk_id,
        documentId: r.document_id,
        details: `상태: ${r.status}`,
      })),
    });
    console.log(`   ⚠️ ${(statusMismatchCount as any).count}개 발견 (승인 필요)`);
  } else {
    console.log('   ✅ 문제 없음');
  }

  // 5. Orphan 청크 검사 (document가 삭제됨)
  console.log('\n🔍 [5/5] Orphan 청크 검사...');
  const [orphanCount] = await db.execute(sql`
    SELECT COUNT(*)::int as count
    FROM chunks c
    LEFT JOIN documents d ON c.document_id = d.id
    WHERE d.id IS NULL
  `);

  if ((orphanCount as any).count > 0) {
    const orphanChunks = await db.execute(sql`
      SELECT c.id as chunk_id, c.document_id, LEFT(c.content, 50) as content_preview
      FROM chunks c
      LEFT JOIN documents d ON c.document_id = d.id
      WHERE d.id IS NULL
      LIMIT 10
    `);

    issues.push({
      type: 'Orphan 청크 (문서 삭제됨)',
      count: (orphanCount as any).count,
      samples: (orphanChunks.rows as any[]).map((r) => ({
        chunkId: r.chunk_id,
        documentId: r.document_id,
        details: `문서가 삭제됨`,
      })),
    });
    console.log(`   ⚠️ ${(orphanCount as any).count}개 발견`);

    if (fixIssues) {
      console.log('   🔧 Orphan 청크 삭제 중...');
      await db.execute(sql`
        DELETE FROM chunks c
        WHERE NOT EXISTS (
          SELECT 1 FROM documents d WHERE d.id = c.document_id
        )
      `);
      console.log('   ✅ 삭제 완료');
    }
  } else {
    console.log('   ✅ 문제 없음');
  }

  // 결과 요약
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('                      검사 결과 요약');
  console.log('═══════════════════════════════════════════════════════════════\n');

  if (issues.length === 0) {
    console.log('✅ 모든 검사 통과! 데이터 무결성에 문제가 없습니다.\n');
  } else {
    console.log(`❌ ${issues.length}개 유형의 문제 발견:\n`);

    for (const issue of issues) {
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`🔸 ${issue.type}`);
      console.log(`   총 ${issue.count}건`);
      console.log(`   샘플 (최대 10개):`);
      for (const sample of issue.samples.slice(0, 5)) {
        console.log(`   - [${sample.chunkId.substring(0, 8)}...] ${sample.details}`);
      }
    }

    if (!fixIssues) {
      console.log('\n💡 자동 수정을 원하시면 --fix 옵션을 사용하세요:');
      console.log('   pnpm exec dotenv -e .env.local -- npx tsx scripts/check-data-integrity.ts --fix\n');
    }
  }

  // 전체 통계
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('                      전체 통계');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const [totalStats] = await db.execute(sql`
    SELECT
      (SELECT COUNT(*)::int FROM documents) as total_documents,
      (SELECT COUNT(*)::int FROM chunks) as total_chunks,
      (SELECT COUNT(*)::int FROM chunks WHERE is_active = true) as active_chunks,
      (SELECT COUNT(*)::int FROM chunks WHERE status = 'approved') as approved_chunks,
      (SELECT COUNT(*)::int FROM chunks WHERE dataset_id IS NOT NULL) as searchable_chunks,
      (SELECT COUNT(*)::int FROM datasets) as total_datasets
  `);

  const stats = totalStats as any;
  console.log(`📊 문서: ${stats.total_documents}개`);
  console.log(`📊 청크: ${stats.total_chunks}개 (활성: ${stats.active_chunks})`);
  console.log(`📊 승인된 청크: ${stats.approved_chunks}개`);
  console.log(`📊 검색 가능 청크: ${stats.searchable_chunks}개`);
  console.log(`📊 데이터셋: ${stats.total_datasets}개\n`);

  process.exit(issues.length > 0 && !fixIssues ? 1 : 0);
}

// CLI 인자 처리
const fixIssues = process.argv.includes('--fix');
checkDataIntegrity(fixIssues).catch((e) => {
  console.error('오류 발생:', e);
  process.exit(1);
});
