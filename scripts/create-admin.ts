/* eslint-disable no-console */
/**
 * 초기 어드민 사용자 생성 스크립트
 *
 * 사용법:
 *   npx tsx scripts/create-admin.ts
 *
 * 환경변수:
 *   ADMIN_EMAIL - 어드민 이메일 (기본값: admin@sofa.app)
 *   ADMIN_PASSWORD - 어드민 비밀번호 (필수, 8자 이상)
 *   ADMIN_COMPANY - 회사명 (기본값: SOFA Admin)
 */

import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcrypt';
import * as schema from '../drizzle/schema';

// 환경변수 로드
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const { tenants, users } = schema;

async function createAdmin() {
  // 환경변수 확인
  if (!process.env.DATABASE_URL) {
    console.error('ERROR: DATABASE_URL 환경변수가 설정되지 않았습니다.');
    console.error('       .env.local 파일에 DATABASE_URL을 설정해주세요.');
    process.exit(1);
  }

  // 어드민 정보
  const email = process.env.ADMIN_EMAIL || 'admin@sofa.app';
  const password = process.env.ADMIN_PASSWORD;
  const companyName = process.env.ADMIN_COMPANY || 'SOFA Admin';

  if (!password) {
    console.error('ERROR: ADMIN_PASSWORD 환경변수가 설정되지 않았습니다.');
    console.error('');
    console.error('사용법:');
    console.error('  ADMIN_PASSWORD=your-secure-password npx tsx scripts/create-admin.ts');
    console.error('');
    console.error('또는 .env.local에 추가:');
    console.error('  ADMIN_EMAIL=admin@your-domain.com');
    console.error('  ADMIN_PASSWORD=YourSecurePassword123!');
    process.exit(1);
  }

  // 비밀번호 복잡성 검사
  if (password.length < 8) {
    console.error('ERROR: 비밀번호는 8자 이상이어야 합니다.');
    process.exit(1);
  }
  if (!/[A-Za-z]/.test(password)) {
    console.error('ERROR: 비밀번호에 영문자를 포함해야 합니다.');
    process.exit(1);
  }
  if (!/\d/.test(password)) {
    console.error('ERROR: 비밀번호에 숫자를 포함해야 합니다.');
    process.exit(1);
  }
  if (!/[@$!%*#?&]/.test(password)) {
    console.error('ERROR: 비밀번호에 특수문자(@$!%*#?&)를 포함해야 합니다.');
    process.exit(1);
  }

  console.log('');
  console.log('========================================');
  console.log('  SOFA - 초기 어드민 사용자 생성');
  console.log('========================================');
  console.log('');
  console.log(`이메일: ${email}`);
  console.log(`회사명: ${companyName}`);
  console.log('');

  try {
    // DB 연결 (Supabase SSL 필수)
    const client = postgres(process.env.DATABASE_URL!, { ssl: 'require' });
    const db = drizzle(client, { schema });

    // 이메일 중복 확인 (사용자)
    const existingUser = await db.query.users.findFirst({
      where: (users, { eq }) => eq(users.email, email),
    });

    if (existingUser) {
      console.error(`ERROR: 이미 ${email} 이메일로 등록된 사용자가 있습니다.`);
      console.error('');
      console.error('기존 계정의 비밀번호를 변경하려면:');
      console.error('  pnpm admin:reset-password');
      console.error('');
      console.error('다른 이메일로 새 어드민을 생성하려면:');
      console.error('  ADMIN_EMAIL=new@example.com ADMIN_PASSWORD=... pnpm admin:create');
      process.exit(1);
    }

    // 이메일 중복 확인 (테넌트)
    const existingTenant = await db.query.tenants.findFirst({
      where: (tenants, { eq }) => eq(tenants.email, email),
    });

    // 테넌트 ID 결정 (기존 테넌트 사용 또는 새로 생성)
    let tenantId: string;
    const userId = uuidv4();

    if (existingTenant) {
      // 기존 테넌트가 있으면 재사용
      tenantId = existingTenant.id;
      console.log('1. 기존 테넌트 사용...');
      console.log(`   ✓ 테넌트 발견 (ID: ${tenantId}, 이름: ${existingTenant.name})`);
    } else {
      // 새 테넌트 생성
      tenantId = uuidv4();
      console.log('1. 테넌트 생성 중...');
      await db.insert(tenants).values({
        id: tenantId,
        name: companyName,
        email: email,
        tier: 'premium', // 어드민은 premium 티어
        usageLimits: { monthlyConversations: -1, documents: -1 }, // 무제한
        settings: {
          contactName: 'Administrator',
          isInternal: true,
        },
        status: 'active',
      });
      console.log(`   ✓ 테넌트 생성 완료 (ID: ${tenantId})`);
    }

    // 비밀번호 해시
    console.log('2. 사용자 생성 중...');
    const passwordHash = await bcrypt.hash(password, 12);

    await db.insert(users).values({
      id: userId,
      email,
      passwordHash,
      tenantId,
      role: 'internal_operator', // 플랫폼 관리자 역할
      emailVerified: true, // 이메일 인증 완료 상태
      passwordChangedAt: new Date(),
      // 플랫폼 관리자 설정
      isPlatformAdmin: true,
      adminRole: 'SUPER_ADMIN', // 최고 관리자 권한
    });
    console.log(`   ✓ 사용자 생성 완료 (ID: ${userId})`);

    console.log('');
    console.log('========================================');
    console.log('  초기 어드민 생성 완료!');
    console.log('========================================');
    console.log('');
    console.log('로그인 정보:');
    console.log(`  이메일: ${email}`);
    console.log(`  비밀번호: (설정한 비밀번호)`);
    console.log('');
    console.log('권한:');
    console.log('  - 테넌트 역할: internal_operator (내부 운영자)');
    console.log('  - 플랫폼 역할: SUPER_ADMIN (최고 관리자)');
    console.log('  - isPlatformAdmin: true');
    console.log('');
    console.log('접근 가능 영역:');
    console.log('  - /console - 테넌트 콘솔 (챗봇 관리)');
    console.log('  - /admin - 플랫폼 관리자 대시보드');
    console.log('  - 모든 테넌트/사용자 관리 가능');
    console.log('');
    console.log('다음 단계:');
    console.log('  1. pnpm dev 로 개발 서버 실행');
    console.log('  2. http://localhost:3060/login 에서 로그인');
    console.log('  3. http://localhost:3060/admin 에서 플랫폼 관리');
    console.log('');
  } catch (error) {
    console.error('어드민 생성 중 오류 발생:', error);
    process.exit(1);
  }
}

createAdmin();
