/**
 * 미처리 문서 재처리 스크립트
 *
 * 사용법:
 *   pnpm db:reprocess              # uploaded, failed 상태 문서 재처리
 *   pnpm db:reprocess --all        # processing 포함 모든 미완료 문서
 *   pnpm db:reprocess --id <uuid>  # 특정 문서만 재처리
 */

import 'dotenv/config';
import { db, documents } from '../lib/db';
import { eq, inArray } from 'drizzle-orm';
import { inngest } from '../inngest/client';

async function main() {
  const args = process.argv.slice(2);
  const includeProcessing = args.includes('--all');
  const specificId = args.includes('--id') ? args[args.indexOf('--id') + 1] : null;

  console.log('🔄 미처리 문서 재처리 스크립트\n');

  let targetDocuments;

  if (specificId) {
    // 특정 문서만 조회
    targetDocuments = await db
      .select()
      .from(documents)
      .where(eq(documents.id, specificId));

    if (targetDocuments.length === 0) {
      console.log(`❌ 문서를 찾을 수 없습니다: ${specificId}`);
      process.exit(1);
    }
  } else {
    // 상태별 조회
    const statuses = includeProcessing
      ? ['uploaded', 'failed', 'processing']
      : ['uploaded', 'failed'];

    targetDocuments = await db
      .select()
      .from(documents)
      .where(inArray(documents.status, statuses));
  }

  if (targetDocuments.length === 0) {
    console.log('✅ 재처리가 필요한 문서가 없습니다.');
    process.exit(0);
  }

  console.log(`📋 재처리 대상 문서: ${targetDocuments.length}개\n`);

  // 문서 목록 출력
  for (const doc of targetDocuments) {
    console.log(`  - [${doc.status}] ${doc.filename} (${doc.id})`);
    if (doc.errorMessage) {
      console.log(`    에러: ${doc.errorMessage}`);
    }
  }

  console.log('\n🚀 이벤트 발송 시작...\n');

  let successCount = 0;
  let errorCount = 0;

  for (const doc of targetDocuments) {
    try {
      // 문서 상태를 uploaded로 리셋
      await db
        .update(documents)
        .set({
          status: 'uploaded',
          progressStep: null,
          progressPercent: 0,
          errorMessage: null,
          updatedAt: new Date(),
        })
        .where(eq(documents.id, doc.id));

      // Inngest 이벤트 발송
      await inngest.send({
        name: 'document/uploaded',
        data: {
          documentId: doc.id,
          tenantId: doc.tenantId,
          userId: 'system', // 시스템에서 재처리
          filename: doc.filename,
          fileType: doc.fileType || 'unknown',
          filePath: doc.filePath,
        },
      });

      console.log(`  ✅ ${doc.filename}`);
      successCount++;
    } catch (error) {
      console.log(`  ❌ ${doc.filename}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      errorCount++;
    }
  }

  console.log(`\n📊 결과: 성공 ${successCount}개, 실패 ${errorCount}개`);

  if (successCount > 0) {
    console.log('\n💡 Inngest 대시보드에서 처리 상태를 확인하세요:');
    console.log('   - Cloud: https://app.inngest.com');
    console.log('   - Local: http://localhost:8288 (pnpm dev:inngest 실행 시)');
  }

  process.exit(errorCount > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error('스크립트 실행 실패:', error);
  process.exit(1);
});
