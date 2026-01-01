import { db } from '../lib/db';
import { chatbotDatasets, datasets, chunks, chatbots } from '../drizzle/schema';
import { eq, and, or, ilike } from 'drizzle-orm';

async function check() {
  const chatbotId = '5884a67c-6a1e-4962-abdd-772d77072c62';
  const tenantId = 'a87d0bc2-b3d1-4592-b6a5-7abaf5cd77fe';

  // 1. 챗봇 정보 확인
  const chatbot = await db.select({
    id: chatbots.id,
    name: chatbots.name,
    tenantId: chatbots.tenantId
  }).from(chatbots).where(eq(chatbots.id, chatbotId));
  console.log('=== 1. 챗봇 정보 ===');
  console.log(JSON.stringify(chatbot, null, 2));

  // 2. 챗봇에 연결된 데이터셋 확인
  const linkedDatasets = await db
    .select({
      linkId: chatbotDatasets.id,
      datasetId: chatbotDatasets.datasetId,
      weight: chatbotDatasets.weight,
      datasetName: datasets.name
    })
    .from(chatbotDatasets)
    .innerJoin(datasets, eq(chatbotDatasets.datasetId, datasets.id))
    .where(eq(chatbotDatasets.chatbotId, chatbotId));

  console.log('\n=== 2. 챗봇에 연결된 데이터셋 ===');
  console.log(linkedDatasets.length > 0 ? JSON.stringify(linkedDatasets, null, 2) : '❌ 연결된 데이터셋 없음');

  // 3. 테넌트의 모든 데이터셋
  const allDatasets = await db
    .select({
      id: datasets.id,
      name: datasets.name,
      documentCount: datasets.documentCount,
      chunkCount: datasets.chunkCount
    })
    .from(datasets)
    .where(eq(datasets.tenantId, tenantId));

  console.log('\n=== 3. 테넌트의 모든 데이터셋 ===');
  console.log(JSON.stringify(allDatasets, null, 2));

  // 4. 문희/출산 관련 청크 검색
  const relatedChunks = await db
    .select({
      id: chunks.id,
      datasetId: chunks.datasetId,
      datasetName: datasets.name,
      content: chunks.content,
      status: chunks.status,
      isActive: chunks.isActive
    })
    .from(chunks)
    .innerJoin(datasets, eq(chunks.datasetId, datasets.id))
    .where(
      and(
        eq(chunks.tenantId, tenantId),
        or(
          ilike(chunks.content, '%문희%'),
          ilike(chunks.content, '%출산%')
        )
      )
    )
    .limit(10);

  console.log('\n=== 4. 문희/출산 관련 청크 ===');
  if (relatedChunks.length === 0) {
    console.log('❌ 관련 청크 없음');
  } else {
    relatedChunks.forEach((chunk, i) => {
      console.log(`\n[청크 ${i+1}] 데이터셋: ${chunk.datasetName} | 상태: ${chunk.status} | 활성: ${chunk.isActive}`);
      console.log(`내용: ${chunk.content?.substring(0, 200)}...`);
    });
  }

  process.exit(0);
}

check().catch(e => { console.error(e); process.exit(1); });
