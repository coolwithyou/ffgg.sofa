/**
 * LLM 모델 가격 정보 시드 스크립트
 *
 * 토큰 추적 기능이 작동하려면 llm_models 테이블에 가격 정보가 있어야 합니다.
 * 이 스크립트는 사용 중인 모델들의 가격 정보를 추가합니다.
 */
import 'dotenv/config';
import { db } from '../lib/db';
import { llmModels } from '../drizzle/schema';

const MODELS = [
  {
    provider: 'google',
    modelId: 'gemini-2.5-flash-lite',
    displayName: 'Gemini 2.5 Flash-Lite',
    inputPricePerMillion: 0.075, // $0.075 per 1M input tokens
    outputPricePerMillion: 0.30, // $0.30 per 1M output tokens
    isEmbedding: false,
    isActive: true,
    isDefault: true,
  },
  {
    provider: 'openai',
    modelId: 'gpt-4o-mini',
    displayName: 'GPT-4o Mini',
    inputPricePerMillion: 0.15, // $0.15 per 1M input tokens
    outputPricePerMillion: 0.60, // $0.60 per 1M output tokens
    isEmbedding: false,
    isActive: true,
    isDefault: false,
  },
  {
    provider: 'openai',
    modelId: 'text-embedding-3-small',
    displayName: 'Text Embedding 3 Small',
    inputPricePerMillion: 0.02, // $0.02 per 1M tokens
    outputPricePerMillion: 0.0, // 임베딩은 output 없음
    isEmbedding: true,
    isActive: true,
    isDefault: false,
  },
];

async function seed() {
  console.log('🌱 Seeding LLM models...\n');

  for (const model of MODELS) {
    try {
      await db
        .insert(llmModels)
        .values(model)
        .onConflictDoUpdate({
          target: [llmModels.provider, llmModels.modelId],
          set: {
            displayName: model.displayName,
            inputPricePerMillion: model.inputPricePerMillion,
            outputPricePerMillion: model.outputPricePerMillion,
            isEmbedding: model.isEmbedding,
            isActive: model.isActive,
            isDefault: model.isDefault,
            updatedAt: new Date(),
          },
        });

      console.log(`  ✅ ${model.provider}/${model.modelId} - input: $${model.inputPricePerMillion}/M, output: $${model.outputPricePerMillion}/M`);
    } catch (e) {
      console.error(`  ❌ ${model.provider}/${model.modelId} - Error:`, e);
    }
  }

  console.log('\n✨ Seeding complete!');
  process.exit(0);
}

seed();
