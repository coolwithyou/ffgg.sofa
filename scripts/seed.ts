/* eslint-disable no-console */
/**
 * SOFA 초기 데이터 시드 스크립트
 *
 * 모든 시드 데이터를 한 번에 추가합니다:
 * - LLM 모델 가격 정보
 * - 예약 슬러그 목록
 * - 초기 관리자 계정 (ADMIN_PASSWORD 환경변수 필요)
 *
 * 사용법:
 *   pnpm seed                    # 전체 시드 (관리자 제외)
 *   pnpm seed:all                # 전체 시드 + 관리자 생성
 *   ADMIN_PASSWORD=xxx pnpm seed # 관리자 포함 시드
 *
 * 환경변수:
 *   DATABASE_URL - 데이터베이스 연결 문자열 (필수)
 *   ADMIN_EMAIL - 관리자 이메일 (기본값: admin@sofa.app)
 *   ADMIN_PASSWORD - 관리자 비밀번호 (8자 이상, 영문+숫자+특수문자)
 *   ADMIN_COMPANY - 회사명 (기본값: SOFA Admin)
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcrypt';
import * as schema from '../drizzle/schema';

const { llmModels, reservedSlugs, tenants, users } = schema;

// ============================================================
// LLM Models Seed Data
// ============================================================
const LLM_MODELS = [
  {
    provider: 'google',
    modelId: 'gemini-2.5-flash-lite',
    displayName: 'Gemini 2.5 Flash-Lite',
    inputPricePerMillion: 0.075,
    outputPricePerMillion: 0.30,
    isEmbedding: false,
    isActive: true,
    isDefault: true,
  },
  {
    provider: 'openai',
    modelId: 'gpt-4o-mini',
    displayName: 'GPT-4o Mini',
    inputPricePerMillion: 0.15,
    outputPricePerMillion: 0.60,
    isEmbedding: false,
    isActive: true,
    isDefault: false,
  },
  {
    provider: 'openai',
    modelId: 'text-embedding-3-small',
    displayName: 'Text Embedding 3 Small',
    inputPricePerMillion: 0.02,
    outputPricePerMillion: 0.0,
    isEmbedding: true,
    isActive: true,
    isDefault: false,
  },
  {
    provider: 'anthropic',
    modelId: 'claude-3-haiku-20240307',
    displayName: 'Claude 3 Haiku',
    inputPricePerMillion: 0.25,
    outputPricePerMillion: 1.25,
    isEmbedding: false,
    isActive: true,
    isDefault: false,
  },
];

// ============================================================
// Reserved Slugs Seed Data (imported from existing file)
// ============================================================
import { reservedSlugsSeed } from '../drizzle/seed/reserved-slugs';

// ============================================================
// Types
// ============================================================
interface SeedStats {
  added: number;
  skipped: number;
  errors: number;
}

// ============================================================
// Seed Functions
// ============================================================

/**
 * LLM 모델 가격 정보 시드
 */
async function seedLlmModels(
  db: ReturnType<typeof drizzle>
): Promise<SeedStats> {
  console.log('\n📊 LLM 모델 시드 중...');
  const stats: SeedStats = { added: 0, skipped: 0, errors: 0 };

  for (const model of LLM_MODELS) {
    try {
      // Check if exists
      const existing = await db
        .select({ id: llmModels.id })
        .from(llmModels)
        .where(eq(llmModels.modelId, model.modelId))
        .limit(1);

      if (existing.length > 0) {
        // Update existing
        await db
          .update(llmModels)
          .set({
            displayName: model.displayName,
            inputPricePerMillion: model.inputPricePerMillion,
            outputPricePerMillion: model.outputPricePerMillion,
            isEmbedding: model.isEmbedding,
            isActive: model.isActive,
            isDefault: model.isDefault,
            updatedAt: new Date(),
          })
          .where(eq(llmModels.modelId, model.modelId));
        stats.skipped++;
        console.log(`   ⏭️  ${model.provider}/${model.modelId} (업데이트)`);
      } else {
        // Insert new
        await db.insert(llmModels).values(model);
        stats.added++;
        console.log(`   ✅ ${model.provider}/${model.modelId}`);
      }
    } catch (e) {
      stats.errors++;
      console.error(`   ❌ ${model.provider}/${model.modelId}:`, e);
    }
  }

  return stats;
}

/**
 * 예약 슬러그 시드
 */
async function seedReservedSlugsData(
  db: ReturnType<typeof drizzle>
): Promise<SeedStats> {
  console.log(`\n🔒 예약 슬러그 시드 중... (총 ${reservedSlugsSeed.length}개)`);
  const stats: SeedStats = { added: 0, skipped: 0, errors: 0 };

  for (const item of reservedSlugsSeed) {
    try {
      // Check if exists
      const existing = await db
        .select({ id: reservedSlugs.id })
        .from(reservedSlugs)
        .where(eq(reservedSlugs.slug, item.slug))
        .limit(1);

      if (existing.length > 0) {
        stats.skipped++;
        continue;
      }

      // Insert new
      await db.insert(reservedSlugs).values({
        slug: item.slug,
        category: item.category,
        reason: item.reason,
      });
      stats.added++;
    } catch (e) {
      stats.errors++;
      console.error(`   ❌ "${item.slug}":`, e);
    }
  }

  console.log(`   ✅ 추가: ${stats.added}개, ⏭️ 건너뜀: ${stats.skipped}개`);
  return stats;
}

/**
 * 초기 관리자 계정 생성
 */
async function seedAdmin(
  db: ReturnType<typeof drizzle>
): Promise<SeedStats> {
  const stats: SeedStats = { added: 0, skipped: 0, errors: 0 };

  const email = process.env.ADMIN_EMAIL || 'admin@sofa.app';
  const password = process.env.ADMIN_PASSWORD;
  const companyName = process.env.ADMIN_COMPANY || 'SOFA Admin';

  if (!password) {
    console.log('\n👤 관리자 시드 건너뜀 (ADMIN_PASSWORD 미설정)');
    console.log('   관리자 생성하려면: ADMIN_PASSWORD=xxx pnpm seed');
    return stats;
  }

  console.log(`\n👤 관리자 계정 시드 중... (${email})`);

  // Validate password
  if (password.length < 8) {
    console.error('   ❌ 비밀번호는 8자 이상이어야 합니다.');
    stats.errors++;
    return stats;
  }
  if (!/[A-Za-z]/.test(password)) {
    console.error('   ❌ 비밀번호에 영문자를 포함해야 합니다.');
    stats.errors++;
    return stats;
  }
  if (!/\d/.test(password)) {
    console.error('   ❌ 비밀번호에 숫자를 포함해야 합니다.');
    stats.errors++;
    return stats;
  }
  if (!/[@$!%*#?&]/.test(password)) {
    console.error('   ❌ 비밀번호에 특수문자(@$!%*#?&)를 포함해야 합니다.');
    stats.errors++;
    return stats;
  }

  try {
    // Check if admin exists
    const existingUser = await db.query.users.findFirst({
      where: (users, { eq }) => eq(users.email, email),
    });

    if (existingUser) {
      console.log(`   ⏭️  관리자 계정이 이미 존재합니다 (${email})`);
      stats.skipped++;
      return stats;
    }

    // Create tenant
    const tenantId = uuidv4();
    const userId = uuidv4();

    await db.insert(tenants).values({
      id: tenantId,
      name: companyName,
      email: email,
      tier: 'premium',
      usageLimits: { monthlyConversations: -1, documents: -1 },
      settings: {
        contactName: 'Administrator',
        isInternal: true,
      },
      status: 'active',
    });

    // Create user
    const passwordHash = await bcrypt.hash(password, 12);

    await db.insert(users).values({
      id: userId,
      email,
      passwordHash,
      tenantId,
      role: 'internal_operator',
      emailVerified: true,
      passwordChangedAt: new Date(),
    });

    console.log(`   ✅ 관리자 생성 완료`);
    console.log(`      테넌트 ID: ${tenantId}`);
    console.log(`      사용자 ID: ${userId}`);
    console.log(`      권한: internal_operator`);
    stats.added++;
  } catch (e) {
    console.error('   ❌ 관리자 생성 실패:', e);
    stats.errors++;
  }

  return stats;
}

// ============================================================
// Main
// ============================================================
async function main() {
  console.log('');
  console.log('╔════════════════════════════════════════════╗');
  console.log('║       SOFA 초기 데이터 시드 스크립트       ║');
  console.log('╚════════════════════════════════════════════╝');

  // Check environment
  if (!process.env.DATABASE_URL) {
    console.error('\n❌ ERROR: DATABASE_URL 환경변수가 설정되지 않았습니다.');
    console.error('   .env.local 파일에 DATABASE_URL을 설정해주세요.');
    process.exit(1);
  }

  // Connect to database (Supabase SSL required)
  const client = postgres(process.env.DATABASE_URL!, { ssl: 'require' });
  const db = drizzle(client, { schema });

  const results: Record<string, SeedStats> = {};

  try {
    // 1. LLM Models
    results.llmModels = await seedLlmModels(db);

    // 2. Reserved Slugs
    results.reservedSlugs = await seedReservedSlugsData(db);

    // 3. Admin (optional)
    results.admin = await seedAdmin(db);

    // Summary
    console.log('\n');
    console.log('╔════════════════════════════════════════════╗');
    console.log('║              📊 시드 결과 요약              ║');
    console.log('╠════════════════════════════════════════════╣');
    console.log(`║ LLM 모델      : +${results.llmModels.added} / ⏭${results.llmModels.skipped} / ❌${results.llmModels.errors}`.padEnd(45) + '║');
    console.log(`║ 예약 슬러그   : +${results.reservedSlugs.added} / ⏭${results.reservedSlugs.skipped} / ❌${results.reservedSlugs.errors}`.padEnd(45) + '║');
    console.log(`║ 관리자 계정   : +${results.admin.added} / ⏭${results.admin.skipped} / ❌${results.admin.errors}`.padEnd(45) + '║');
    console.log('╚════════════════════════════════════════════╝');
    console.log('');

    const hasErrors = Object.values(results).some((r) => r.errors > 0);
    if (hasErrors) {
      console.log('⚠️  일부 시드에서 오류가 발생했습니다.');
    } else {
      console.log('✨ 모든 시드가 성공적으로 완료되었습니다!');
    }

    if (results.admin.added > 0) {
      console.log('\n📋 관리자 로그인 정보:');
      console.log(`   이메일: ${process.env.ADMIN_EMAIL || 'admin@sofa.app'}`);
      console.log('   비밀번호: (설정한 비밀번호)');
      console.log('\n다음 단계:');
      console.log('   1. pnpm dev');
      console.log('   2. http://localhost:3060/login 에서 로그인');
    }

    await client.end();
  } catch (error) {
    console.error('\n❌ 시드 실행 중 오류 발생:', error);
    await client.end();
    process.exit(1);
  }

  process.exit(0);
}

main();
